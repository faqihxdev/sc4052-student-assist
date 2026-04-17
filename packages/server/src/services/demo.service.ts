import { google, calendar_v3 } from "googleapis";
import { config } from "../lib/config";
import { getSetting } from "./settings.service";
import { seedDemoTasks } from "../db/seed";
import { db } from "../db";
import { tasks } from "../db/schema";

/**
 * ── Demo state management ───────────────────────────────────────────────
 *
 * Live demos need reproducible starting state. The complication is that
 * the Calendar lives in the user's real Google account, so we can't do a
 * blanket wipe.
 *
 * Every fixture event we create carries a private extended property
 *
 *     extendedProperties.private.studentassist_demo = "1"
 *
 * This is Google Calendar's official "invisible metadata" channel — it
 * never renders in the UI and is queryable server-side via the
 * `privateExtendedProperty` filter on `events.list`. All calendar
 * operations here are scoped to events matching this property, so the
 * user's real events are never touched.
 *
 * For backwards compatibility with older demo events created before this
 * switch, we also match any event whose description begins with the
 * legacy text marker `[StudentAssist demo]` — one Remove cycle will
 * clean those up.
 *
 * Two entry points:
 *
 *   configureDemoState()  — idempotent. Computes the target set of
 *     fixtures, diffs against existing marker-tagged events, and issues
 *     only the minimum API writes to reconcile. Safe to re-run.
 *
 *   removeDemoState()     — deletes every marker-tagged event and clears
 *     the local task DB. Leaves the user's calendar as if the demo never
 *     ran.
 *
 * Tasks live entirely in our own SQLite so they're handled unconditionally
 * by both operations (configure = wipe+reseed canonical set; remove =
 * wipe). No marker needed.
 * ───────────────────────────────────────────────────────────────────────
 */

const DEMO_PROP_KEY = "studentassist_demo";
const DEMO_PROP_VALUE = "1";
const LEGACY_MARKER = "[StudentAssist demo]";

type FixtureSpec = {
  summary: string;
  description: string;
  location?: string;
  dayOffset: number;
  startHour: number;
  startMinute: number;
  durationMinutes: number;
};

const DEMO_EVENTS: FixtureSpec[] = [
  {
    summary: "Algorithms Lecture",
    description: "Weekly lecture on dynamic programming and DP tables.",
    location: "LT19",
    dayOffset: 0,
    startHour: 10,
    startMinute: 0,
    durationMinutes: 90,
  },
  {
    summary: "Group Standup",
    description: "Daily sync with project groupmates.",
    location: "The Hive",
    dayOffset: 0,
    startHour: 14,
    startMinute: 0,
    durationMinutes: 30,
  },
  {
    summary: "Study Group: Dynamic Programming",
    description: "Discussion session to rehash tutorial problems.",
    location: "CCDS Lab 2",
    dayOffset: 1,
    startHour: 9,
    startMinute: 0,
    durationMinutes: 60,
  },
  {
    summary: "Outdoor Run",
    description: "Park run, reschedulable if the weather turns.",
    location: "NTU Sports Centre",
    dayOffset: 1,
    startHour: 15,
    startMinute: 0,
    durationMinutes: 60,
  },
  {
    summary: "Review Meeting",
    description: "End-of-day project review, a good candidate to reschedule.",
    dayOffset: 1,
    startHour: 20,
    startMinute: 0,
    durationMinutes: 30,
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────

function useMockCalendar(): boolean {
  if (config.mockMode) return true;
  if (!getSetting("google_oauth_token")) return true;
  if (!config.googleClientId || !config.googleClientSecret) return true;
  return false;
}

function getAuthenticatedCalendar(): calendar_v3.Calendar | null {
  const tokenJson = getSetting("google_oauth_token");
  if (!tokenJson || !config.googleClientId || !config.googleClientSecret) {
    return null;
  }
  const oauth2Client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
    config.googleRedirectUri
  );
  oauth2Client.setCredentials(JSON.parse(tokenJson));
  return google.calendar({ version: "v3", auth: oauth2Client });
}

function isoLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:00`;
}

type Target = {
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  key: string; // identity for diffing: `summary@YYYY-MM-DDTHH:MM`
};

/**
 * Materialise the fixture spec into concrete events with absolute
 * datetimes relative to "now". Each target carries a `key` that is the
 * canonical identity used when diffing against existing calendar events.
 */
function computeTargetEvents(): Target[] {
  return DEMO_EVENTS.map((ev) => {
    const start = new Date();
    start.setDate(start.getDate() + ev.dayOffset);
    start.setHours(ev.startHour, ev.startMinute, 0, 0);
    const end = new Date(start.getTime() + ev.durationMinutes * 60_000);
    const startIso = isoLocal(start);
    const endIso = isoLocal(end);
    return {
      summary: ev.summary,
      description: ev.description,
      location: ev.location,
      start: { dateTime: startIso, timeZone: config.defaultTimezone },
      end: { dateTime: endIso, timeZone: config.defaultTimezone },
      key: `${ev.summary}@${startIso.slice(0, 16)}`,
    };
  });
}

type ExistingMarked = {
  id: string;
  summary: string;
  startDateTime: string;
  key: string;
};

/**
 * List every event on the primary calendar (over a widish window around
 * "now") that is tagged as a demo fixture.
 *
 * An event qualifies if EITHER:
 *   (a) it has `extendedProperties.private.studentassist_demo = "1"`
 *       — the current tagging scheme, invisible in the Google UI; or
 *   (b) its description starts with `[StudentAssist demo]` — the legacy
 *       tagging scheme, kept here so one Remove cycle after upgrading
 *       cleans up pre-existing test data.
 *
 * Window is a 3-day lookback + 14-day lookahead, which comfortably
 * covers all fixtures and any stale events from previous demo runs.
 */
async function listMarkedEvents(
  calendar: calendar_v3.Calendar
): Promise<ExistingMarked[]> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  const byId = new Map<string, ExistingMarked>();

  const toEntry = (e: calendar_v3.Schema$Event): ExistingMarked | null => {
    if (!e.id || !e.summary) return null;
    const startDateTime = e.start?.dateTime ?? "";
    // Normalise to local minutes — Google sometimes returns an offset
    // suffix like `+08:00`, which we strip so keys match the target side.
    const localMinutes =
      startDateTime.length >= 16 ? startDateTime.slice(0, 16) : startDateTime;
    return {
      id: e.id,
      summary: e.summary,
      startDateTime,
      key: `${e.summary}@${localMinutes}`,
    };
  };

  // 1) New-style: server-side filter on the private extended property.
  const newStyle = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    timeMin: windowStart.toISOString(),
    timeMax: windowEnd.toISOString(),
    maxResults: 250,
    privateExtendedProperty: [`${DEMO_PROP_KEY}=${DEMO_PROP_VALUE}`],
  });
  for (const e of newStyle.data.items ?? []) {
    const entry = toEntry(e);
    if (entry) byId.set(entry.id, entry);
  }

  // 2) Legacy cleanup: scan the window for events whose description still
  //    carries the old text marker. Dedupe against the new-style set.
  const legacy = await calendar.events.list({
    calendarId: "primary",
    singleEvents: true,
    timeMin: windowStart.toISOString(),
    timeMax: windowEnd.toISOString(),
    maxResults: 250,
  });
  for (const e of legacy.data.items ?? []) {
    if (!(e.description ?? "").includes(LEGACY_MARKER)) continue;
    const entry = toEntry(e);
    if (entry && !byId.has(entry.id)) byId.set(entry.id, entry);
  }

  return [...byId.values()];
}

// ── Public API ──────────────────────────────────────────────────────────

export interface ConfigureResult {
  tasks: { reseeded: number };
  calendar: {
    applied: boolean;
    reason?: string;
    /** Events already present and matching the target — no API call made. */
    kept: number;
    /** Events created because they were missing. */
    added: number;
    /** Demo-marked events deleted because they no longer matched the target (e.g. stale dates from a prior day). */
    removed: number;
  };
}

export interface RemoveResult {
  tasks: { wiped: number };
  calendar: {
    applied: boolean;
    reason?: string;
    removed: number;
  };
}

/**
 * Idempotent: safe to call any number of times. First call creates the
 * fixtures; subsequent calls on the same day are no-ops against the
 * calendar. Calls on a new day will automatically clean up yesterday's
 * stale fixtures and create today-dated replacements.
 */
export async function configureDemoState(): Promise<ConfigureResult> {
  seedDemoTasks(true);
  const result: ConfigureResult = {
    tasks: { reseeded: 6 },
    calendar: { applied: false, kept: 0, added: 0, removed: 0 },
  };

  if (useMockCalendar()) {
    result.calendar.reason =
      "Calendar is in mock mode; events are static fixtures, no configuration needed.";
    return result;
  }

  const calendar = getAuthenticatedCalendar();
  if (!calendar) {
    result.calendar.reason =
      "Google Calendar is not connected. Connect it in Settings to seed demo events.";
    return result;
  }

  const target = computeTargetEvents();
  const existing = await listMarkedEvents(calendar);

  const targetKeys = new Set(target.map((t) => t.key));
  const existingKeys = new Set(existing.map((e) => e.key));

  const stale = existing.filter((e) => !targetKeys.has(e.key));
  const missing = target.filter((t) => !existingKeys.has(t.key));

  for (const e of stale) {
    try {
      await calendar.events.delete({ calendarId: "primary", eventId: e.id });
    } catch {
      // Swallow individual failures — the next configure run will retry.
    }
  }

  for (const t of missing) {
    await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: t.summary,
        description: t.description,
        location: t.location,
        start: t.start,
        end: t.end,
        extendedProperties: {
          private: { [DEMO_PROP_KEY]: DEMO_PROP_VALUE },
        },
      },
    });
  }

  result.calendar = {
    applied: true,
    kept: existing.length - stale.length,
    added: missing.length,
    removed: stale.length,
  };
  return result;
}

/**
 * Removes every demo-tagged event and wipes the local task table. The
 * user's real calendar events are unaffected (scoped to the marker).
 */
export async function removeDemoState(): Promise<RemoveResult> {
  const deletedRows = db.delete(tasks).run();
  const taskCount = typeof deletedRows.changes === "number" ? deletedRows.changes : 0;

  const result: RemoveResult = {
    tasks: { wiped: taskCount },
    calendar: { applied: false, removed: 0 },
  };

  if (useMockCalendar()) {
    result.calendar.reason =
      "Calendar is in mock mode; events are static fixtures, nothing to remove.";
    return result;
  }

  const calendar = getAuthenticatedCalendar();
  if (!calendar) {
    result.calendar.reason =
      "Google Calendar is not connected; nothing to remove.";
    return result;
  }

  const existing = await listMarkedEvents(calendar);
  for (const e of existing) {
    try {
      await calendar.events.delete({ calendarId: "primary", eventId: e.id });
    } catch {
      // Ignore — the event may have already been deleted manually.
    }
  }

  result.calendar = { applied: true, removed: existing.length };
  return result;
}
