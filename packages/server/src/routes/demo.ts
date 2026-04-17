import { Hono } from "hono";
import {
  configureDemoState,
  removeDemoState,
} from "../services/demo.service";

const app = new Hono();

/**
 * POST /api/v1/demo/configure
 *
 * Idempotent: diffs the canonical fixture set against existing
 * demo-marked events, creates what's missing, deletes what's stale, keeps
 * what already matches. Safe to run any number of times.
 */
app.post("/configure", async (c) => {
  const result = await configureDemoState();
  return c.json(result);
});

/**
 * POST /api/v1/demo/remove
 *
 * Deletes every demo-marked calendar event and wipes the local task
 * table. User's real calendar events are untouched.
 */
app.post("/remove", async (c) => {
  const result = await removeDemoState();
  return c.json(result);
});

export default app;
