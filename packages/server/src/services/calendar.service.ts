import { google, calendar_v3 } from "googleapis";
import { config } from "../lib/config";
import { AppError } from "../lib/errors";
import { getSetting, deleteSetting } from "./settings.service";
import {
  getMockTodaysEvents,
  getMockEvents,
  getMockFreeBusy,
  getMockCreateEvent,
  getMockUpdateEvent,
  getMockDeleteEvent,
} from "../lib/mock-data";

/**
 * Google's Calendar API requires either (a) an ISO datetime with a timezone
 * offset (e.g. "2026-04-18T09:00:00+08:00") or (b) a naive datetime plus an
 * explicit `timeZone` field. LLMs reliably produce (a) only when they know
 * the user's offset — which they don't. So we accept naive ISO strings from
 * the agent and attach our default IANA zone on the way out.
 */
function hasTimezoneSuffix(iso: string): boolean {
  return /Z$|[+-]\d{2}:?\d{2}$/.test(iso.trim());
}

function toEventTime(iso: string): { dateTime: string; timeZone?: string } {
  if (hasTimezoneSuffix(iso)) return { dateTime: iso };
  return { dateTime: iso, timeZone: config.defaultTimezone };
}

/**
 * Return an offset string like "+08:00" / "-04:00" for the given IANA zone
 * at the given instant. Relies on Intl rather than a hardcoded table so it
 * handles DST correctly.
 */
function offsetFor(instant: Date, timeZone: string): string {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  const name =
    dtf.formatToParts(instant).find((p) => p.type === "timeZoneName")?.value ??
    "GMT+00:00";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return "+00:00";
  const [, sign, hh, mm] = m;
  return `${sign}${hh.padStart(2, "0")}:${mm ?? "00"}`;
}

/**
 * Google's `events.list` requires `timeMin`/`timeMax` to be full RFC3339 with
 * a timezone offset (unlike `events.insert` which has a separate `timeZone`
 * field). Bare dates or naive datetimes from the LLM would 400. We treat a
 * naive input as wall-clock time in `defaultTimezone` and append the offset.
 */
function normalizeRangeTime(iso: string): string {
  const trimmed = iso.trim();
  if (hasTimezoneSuffix(trimmed)) return trimmed;

  // Bare date "YYYY-MM-DD" → start of that day (midnight).
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00`
    : trimmed;

  // Parse as UTC (best-effort) to pick an instant for offset lookup. The
  // offset for a given wall-clock is the same ~24h-band either way unless
  // the user picked a DST crossover, which we accept as out of scope.
  const instant = new Date(`${normalized}Z`);
  const offset = offsetFor(
    Number.isNaN(instant.getTime()) ? new Date() : instant,
    config.defaultTimezone
  );
  return `${normalized}${offset}`;
}

/**
 * Detects Google's "invalid_grant" error (refresh token expired/revoked) and
 * wraps it in a friendly AppError. Also clears the stale token from storage so
 * the Settings page correctly reflects "disconnected".
 *
 * Common causes of invalid_grant:
 *  - OAuth consent screen is in "Testing" mode (refresh tokens expire after 7 days).
 *  - User revoked the app at https://myaccount.google.com/permissions.
 *  - Client secret was rotated.
 */
function isInvalidGrantError(err: any): boolean {
  const msg = (err?.response?.data?.error ?? err?.message ?? "").toString();
  return msg.includes("invalid_grant");
}

async function withAuthHandling<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    if (isInvalidGrantError(err)) {
      deleteSetting("google_oauth_token");
      throw new AppError(
        401,
        "Google Calendar access expired (invalid_grant). This usually means your OAuth consent screen is still in 'Testing' mode, where refresh tokens expire after 7 days. Go to Settings and click 'Connect Google' to re-authorize, or publish your OAuth consent screen in Google Cloud Console."
      );
    }
    throw err;
  }
}

function useMockCalendar(): boolean {
  if (config.mockMode) return true;
  const tokenJson = getSetting("google_oauth_token");
  if (!tokenJson) return true;
  if (!config.googleClientId || !config.googleClientSecret) return true;
  return false;
}

function getAuthenticatedCalendar(): calendar_v3.Calendar {
  const tokenJson = getSetting("google_oauth_token");
  if (!tokenJson) {
    throw new AppError(
      503,
      "Calendar service unavailable: Google account not connected. " +
        "Go to Settings and click 'Connect Google' to authorize."
    );
  }

  const clientId = config.googleClientId;
  const clientSecret = config.googleClientSecret;
  if (!clientId || !clientSecret) {
    throw new AppError(
      503,
      "Calendar service unavailable: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET not configured."
    );
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, config.googleRedirectUri);

  const tokens = JSON.parse(tokenJson);
  oauth2Client.setCredentials(tokens);

  oauth2Client.on("tokens", (newTokens) => {
    const merged = { ...tokens, ...newTokens };
    const { setSetting } = require("./settings.service");
    setSetting("google_oauth_token", JSON.stringify(merged));
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string | null;
  location: string | null;
  start: string;
  end: string;
  all_day: boolean;
  html_link: string;
  status: string;
}

function mapEvent(event: calendar_v3.Schema$Event): CalendarEvent {
  const allDay = !event.start?.dateTime;
  return {
    id: event.id ?? "",
    summary: event.summary ?? "(No title)",
    description: event.description ?? null,
    location: event.location ?? null,
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    all_day: allDay,
    html_link: event.htmlLink ?? "",
    status: event.status ?? "confirmed",
  };
}

export async function listEvents(
  timeMin?: string,
  timeMax?: string,
  maxResults: number = 25
): Promise<CalendarEvent[]> {
  if (useMockCalendar()) return getMockEvents(timeMin, timeMax);

  return withAuthHandling(async () => {
    const calendar = getAuthenticatedCalendar();

    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId: "primary",
      singleEvents: true,
      orderBy: "startTime",
      maxResults,
    };

    if (timeMin) params.timeMin = normalizeRangeTime(timeMin);
    if (timeMax) params.timeMax = normalizeRangeTime(timeMax);

    const res = await calendar.events.list(params);
    return (res.data.items ?? []).map(mapEvent);
  });
}

export async function getTodaysEvents(): Promise<CalendarEvent[]> {
  if (useMockCalendar()) return getMockTodaysEvents();

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

  return listEvents(startOfDay.toISOString(), endOfDay.toISOString(), 50);
}

export interface FreeBusySlot {
  start: string;
  end: string;
}

export interface FreeBusyResult {
  date: string;
  busy: FreeBusySlot[];
  free: FreeBusySlot[];
}

export async function getFreeBusy(date: string): Promise<FreeBusyResult> {
  if (useMockCalendar()) return getMockFreeBusy(date);

  return withAuthHandling(async () => {
    const calendar = getAuthenticatedCalendar();

    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: dayStart.toISOString(),
        timeMax: dayEnd.toISOString(),
        items: [{ id: "primary" }],
      },
    });

    const busySlots: FreeBusySlot[] = (
      res.data.calendars?.primary?.busy ?? []
    ).map((b) => ({
      start: b.start ?? "",
      end: b.end ?? "",
    }));

    const freeSlots = computeFreeSlots(
      dayStart.toISOString(),
      dayEnd.toISOString(),
      busySlots
    );

    return {
      date,
      busy: busySlots,
      free: freeSlots,
    };
  });
}

function computeFreeSlots(
  dayStart: string,
  dayEnd: string,
  busy: FreeBusySlot[]
): FreeBusySlot[] {
  const free: FreeBusySlot[] = [];
  let cursor = new Date(dayStart);
  const end = new Date(dayEnd);

  const sorted = [...busy].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  for (const slot of sorted) {
    const busyStart = new Date(slot.start);
    if (cursor < busyStart) {
      free.push({ start: cursor.toISOString(), end: busyStart.toISOString() });
    }
    const busyEnd = new Date(slot.end);
    if (busyEnd > cursor) {
      cursor = busyEnd;
    }
  }

  if (cursor < end) {
    free.push({ start: cursor.toISOString(), end: end.toISOString() });
  }

  return free;
}

export interface CreateEventInput {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
}

export async function createEvent(input: CreateEventInput): Promise<CalendarEvent> {
  if (useMockCalendar()) return getMockCreateEvent(input);

  return withAuthHandling(async () => {
    const calendar = getAuthenticatedCalendar();

    const res = await calendar.events.insert({
      calendarId: "primary",
      requestBody: {
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: toEventTime(input.start),
        end: toEventTime(input.end),
      },
    });

    return mapEvent(res.data);
  });
}

export interface UpdateEventInput {
  summary?: string;
  description?: string | null;
  location?: string | null;
  start?: string;
  end?: string;
}

export async function updateEvent(
  id: string,
  input: UpdateEventInput
): Promise<CalendarEvent> {
  if (useMockCalendar()) return getMockUpdateEvent(id, input);

  return withAuthHandling(async () => {
    const calendar = getAuthenticatedCalendar();

    const body: calendar_v3.Schema$Event = {};
    if (input.summary !== undefined) body.summary = input.summary;
    if (input.description !== undefined) body.description = input.description ?? undefined;
    if (input.location !== undefined) body.location = input.location ?? undefined;
    if (input.start) body.start = toEventTime(input.start);
    if (input.end) body.end = toEventTime(input.end);

    // `patch` does a partial update — any field we don't send is preserved.
    const res = await calendar.events.patch({
      calendarId: "primary",
      eventId: id,
      requestBody: body,
    });

    return mapEvent(res.data);
  });
}

export async function deleteEvent(id: string): Promise<{ id: string }> {
  if (useMockCalendar()) return getMockDeleteEvent(id);

  return withAuthHandling(async () => {
    const calendar = getAuthenticatedCalendar();
    await calendar.events.delete({ calendarId: "primary", eventId: id });
    return { id };
  });
}
