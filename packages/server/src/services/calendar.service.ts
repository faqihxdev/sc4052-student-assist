import { google, calendar_v3 } from "googleapis";
import { config } from "../lib/config";
import { AppError } from "../lib/errors";
import { getSetting } from "./settings.service";
import {
  getMockTodaysEvents,
  getMockEvents,
  getMockFreeBusy,
  getMockCreateEvent,
} from "../lib/mock-data";

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

  const calendar = getAuthenticatedCalendar();

  const params: calendar_v3.Params$Resource$Events$List = {
    calendarId: "primary",
    singleEvents: true,
    orderBy: "startTime",
    maxResults,
  };

  if (timeMin) params.timeMin = timeMin;
  if (timeMax) params.timeMax = timeMax;

  const res = await calendar.events.list(params);
  return (res.data.items ?? []).map(mapEvent);
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

  const calendar = getAuthenticatedCalendar();

  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: { dateTime: input.start },
      end: { dateTime: input.end },
    },
  });

  return mapEvent(res.data);
}
