import { Hono } from "hono";
import { AppError } from "../lib/errors";
import {
  listEvents,
  getTodaysEvents,
  getFreeBusy,
  createEvent,
} from "../services/calendar.service";

const app = new Hono();

app.get("/events", async (c) => {
  const timeMin = c.req.query("timeMin");
  const timeMax = c.req.query("timeMax");
  const events = await listEvents(timeMin, timeMax);
  return c.json(events);
});

app.get("/events/today", async (c) => {
  const events = await getTodaysEvents();
  return c.json(events);
});

app.get("/freebusy", async (c) => {
  const date = c.req.query("date");
  if (!date) {
    throw new AppError(400, "Query parameter 'date' is required (format: YYYY-MM-DD)");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(400, "Invalid date format. Use YYYY-MM-DD");
  }

  const result = await getFreeBusy(date);
  return c.json(result);
});

app.post("/events", async (c) => {
  const body = await c.req.json();

  if (!body.summary || typeof body.summary !== "string" || body.summary.trim() === "") {
    throw new AppError(400, "summary is required and must be a non-empty string");
  }
  if (!body.start || typeof body.start !== "string") {
    throw new AppError(400, "start is required (ISO 8601 datetime string)");
  }
  if (!body.end || typeof body.end !== "string") {
    throw new AppError(400, "end is required (ISO 8601 datetime string)");
  }

  const event = await createEvent({
    summary: body.summary.trim(),
    start: body.start,
    end: body.end,
    description: body.description,
    location: body.location,
  });

  return c.json(event, 201);
});

export default app;
