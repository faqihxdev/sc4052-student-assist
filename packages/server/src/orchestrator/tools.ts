import { tool } from "ai";
import { z } from "zod";
import type { ApiTrace, CardData, ToolDomain } from "@studentassist/shared";

import {
  listTasks,
  createTask,
  updateTask,
} from "../services/tasks.service";
import {
  getCurrentWeather,
  getForecast,
} from "../services/weather.service";
import {
  getTopStories,
  searchStories,
  readArticle,
} from "../services/news.service";
import {
  listUserRepos,
  getRepoActivity,
  listAssignedIssues,
} from "../services/github.service";
import {
  listEvents,
  getTodaysEvents,
  getFreeBusy,
  createEvent,
  updateEvent,
  deleteEvent,
} from "../services/calendar.service";

const traces: ApiTrace[] = [];
const cardsByToolCallId = new Map<string, CardData>();

export function resetCollectors() {
  traces.length = 0;
  cardsByToolCallId.clear();
}

export function getTraces(): ApiTrace[] {
  return [...traces];
}

export function takeCardForToolCallId(toolCallId: string): CardData | undefined {
  const card = cardsByToolCallId.get(toolCallId);
  if (card) cardsByToolCallId.delete(toolCallId);
  return card;
}

export function getServicesCalled(): string[] {
  return [...new Set(traces.map((t) => t.service))];
}

async function traced<T>(
  service: string,
  endpoint: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    traces.push({
      service,
      endpoint,
      duration_ms: Math.round(performance.now() - start),
    });
    return result;
  } catch (err: any) {
    traces.push({
      service,
      endpoint,
      duration_ms: Math.round(performance.now() - start),
    });
    throw err;
  }
}

function attachCard(toolCallId: string | undefined, card: CardData) {
  if (toolCallId) cardsByToolCallId.set(toolCallId, card);
}

/**
 * Mapping from a "domain" name to the set of concrete tool names available
 * in that domain. Used by the orchestrator's prepareStep to dynamically
 * enable tools only once the model has explicitly discovered them via
 * `list_tools_for_domain`.
 */
export const DOMAIN_TOOLS: Record<ToolDomain, string[]> = {
  calendar: [
    "get_todays_schedule",
    "get_calendar_events",
    "find_free_time",
    "create_calendar_event",
    "update_calendar_event",
    "delete_calendar_event",
  ],
  tasks: ["list_tasks", "create_task", "update_task"],
  github: ["get_github_repos", "get_repo_activity", "get_assigned_issues"],
  news: ["get_top_news", "search_news", "read_article"],
  weather: ["get_current_weather", "get_weather_forecast"],
};

/**
 * Always-available meta tool. Its name is the only tool the model sees at the
 * start of a conversation — it must call this to "discover" domain-specific
 * tools before using them.
 */
export const META_TOOL_NAME = "list_tools_for_domain";

const DOMAIN_BLURBS: Record<ToolDomain, string> = {
  calendar:
    "View today's schedule, list events by date range, find free time, create/edit/delete events.",
  tasks: "List, create, and update tasks with priorities and due dates.",
  github: "List repos, view repo activity, see assigned issues.",
  news: "Get top HackerNews stories, search by keyword, or read an article's full text so you can summarize it.",
  weather: "Current weather and 5-day forecast for any city.",
};

/**
 * Concise textual spec for a domain's tools. Returned by list_tools_for_domain
 * so the model both (a) knows the tools are now active and (b) has their
 * descriptions fresh in context for the next step.
 */
function domainSpec(domain: ToolDomain): {
  domain: ToolDomain;
  summary: string;
  tools: Array<{ name: string; description: string; input: string }>;
} {
  const specs: Record<string, Array<{ name: string; description: string; input: string }>> = {
    calendar: [
      {
        name: "get_todays_schedule",
        description: "Get today's calendar events.",
        input: "{}",
      },
      {
        name: "get_calendar_events",
        description: "Get events in an ISO 8601 time range.",
        input: "{ time_min: ISO-8601, time_max: ISO-8601 }",
      },
      {
        name: "find_free_time",
        description: "Find free time slots on a given day.",
        input: "{ date: YYYY-MM-DD }",
      },
      {
        name: "create_calendar_event",
        description:
          "Create a new calendar event. Pass naive ISO datetimes like '2026-04-18T09:00:00' — the server attaches the user's timezone.",
        input:
          "{ summary, start: ISO-8601, end: ISO-8601, description?, location? }",
      },
      {
        name: "update_calendar_event",
        description:
          "Update an existing event (partial patch). Get the event_id from get_todays_schedule or get_calendar_events first.",
        input:
          "{ event_id, summary?, description?, location?, start?, end? }",
      },
      {
        name: "delete_calendar_event",
        description:
          "Delete an event. Get the event_id from get_todays_schedule or get_calendar_events first.",
        input: "{ event_id }",
      },
    ],
    tasks: [
      {
        name: "list_tasks",
        description:
          "Return the full task list. Takes no arguments. Filter in your summary, not server-side.",
        input: "{}",
      },
      {
        name: "create_task",
        description:
          "Create a task. reminder_at / remind_in_minutes are optional reminders that fire a browser notification.",
        input:
          "{ title, description?, priority?, due_date?, reminder_at?, remind_in_minutes? }",
      },
      {
        name: "update_task",
        description:
          "Update a task (mark done, rename, change reminder, etc).",
        input:
          "{ id, title?, description?, status?, priority?, due_date?, reminder_at?, remind_in_minutes? }",
      },
    ],
    github: [
      {
        name: "get_github_repos",
        description:
          "List the user's repos (sorted recent). Call this first to discover the owner username.",
        input: "{}",
      },
      {
        name: "get_repo_activity",
        description:
          "Recent commits, PRs, and issues for a specific repo. Use owner from get_github_repos.",
        input: "{ owner, repo }",
      },
      {
        name: "get_assigned_issues",
        description: "Issues assigned to the user across all repos.",
        input: "{}",
      },
    ],
    news: [
      {
        name: "get_top_news",
        description: "Top HackerNews stories.",
        input: "{ limit? (default 10) }",
      },
      {
        name: "search_news",
        description: "Search HackerNews by keyword.",
        input: "{ query, limit? }",
      },
      {
        name: "read_article",
        description:
          "Fetch an article's full text so you can TL;DR / answer questions about it. Prefer passing story_id from a get_top_news/search_news result.",
        input: "{ story_id? , url? }",
      },
    ],
    weather: [
      {
        name: "get_current_weather",
        description:
          "Current weather for a city. Omit city to use the user's default.",
        input: "{ city? }",
      },
      {
        name: "get_weather_forecast",
        description:
          "5-day forecast for a city. Omit city to use the user's default.",
        input: "{ city? }",
      },
    ],
  };
  return {
    domain,
    summary: DOMAIN_BLURBS[domain],
    tools: specs[domain],
  };
}

export const allTools = {
  [META_TOOL_NAME]: tool({
    description:
      "Discover the specific tools available inside a domain. Call this FIRST for any domain you need to use — the concrete tools in that domain will only become callable after this call. You may call this multiple times (in parallel) for different domains.",
    inputSchema: z.object({
      domain: z
        .enum(["calendar", "tasks", "github", "news", "weather"])
        .describe("The domain to discover tools for"),
    }),
    execute: async ({ domain }) => {
      return domainSpec(domain);
    },
  }),

  get_todays_schedule: tool({
    description: "Get today's calendar events and schedule",
    inputSchema: z.object({}),
    execute: async (_input, { toolCallId }) => {
      try {
        const events = await traced("calendar", "GET /events/today", () =>
          getTodaysEvents()
        );
        attachCard(toolCallId, { type: "calendar", data: events });
        return { events };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_calendar_events: tool({
    description: "Get calendar events for a specific date range",
    inputSchema: z.object({
      time_min: z.string().describe("Start of range (ISO 8601)"),
      time_max: z.string().describe("End of range (ISO 8601)"),
    }),
    execute: async ({ time_min, time_max }, { toolCallId }) => {
      try {
        const events = await traced(
          "calendar",
          `GET /events?timeMin=${time_min}&timeMax=${time_max}`,
          () => listEvents(time_min, time_max)
        );
        attachCard(toolCallId, { type: "calendar", data: events });
        return { events };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  find_free_time: tool({
    description: "Find free time slots on a given day",
    inputSchema: z.object({
      date: z.string().describe("Date in YYYY-MM-DD format"),
    }),
    execute: async ({ date }, { toolCallId }) => {
      try {
        const result = await traced(
          "calendar",
          `GET /freebusy?date=${date}`,
          () => getFreeBusy(date)
        );
        attachCard(toolCallId, { type: "calendar", data: result });
        return result;
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  create_calendar_event: tool({
    description:
      "Create a new calendar event. Pass naive ISO datetimes like '2026-04-18T09:00:00' (no Z, no offset) — the server attaches the user's default timezone. Including an offset like '-04:00' also works but is unnecessary.",
    inputSchema: z.object({
      summary: z.string().describe("Event title"),
      start: z
        .string()
        .describe(
          "Start time as ISO 8601, e.g. '2026-04-18T09:00:00'. Timezone optional."
        ),
      end: z
        .string()
        .describe(
          "End time as ISO 8601, e.g. '2026-04-18T09:30:00'. Timezone optional."
        ),
      description: z.string().optional(),
      location: z.string().optional(),
    }),
    execute: async (input, { toolCallId }) => {
      try {
        const event = await traced("calendar", "POST /events", () =>
          createEvent(input)
        );
        attachCard(toolCallId, { type: "calendar", data: [event] });
        return { event };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  update_calendar_event: tool({
    description:
      "Update an existing calendar event (partial patch — unspecified fields keep their current values). You MUST know the event_id first; discover it via get_todays_schedule or get_calendar_events. Use naive ISO for start/end; the server attaches the timezone.",
    inputSchema: z.object({
      event_id: z.string().describe("Google Calendar event id"),
      summary: z.string().optional(),
      description: z.string().optional(),
      location: z.string().optional(),
      start: z
        .string()
        .optional()
        .describe("New start (ISO 8601, timezone optional)"),
      end: z
        .string()
        .optional()
        .describe("New end (ISO 8601, timezone optional)"),
    }),
    execute: async ({ event_id, ...rest }, { toolCallId }) => {
      try {
        const event = await traced(
          "calendar",
          `PATCH /events/${event_id}`,
          () => updateEvent(event_id, rest)
        );
        attachCard(toolCallId, { type: "calendar", data: [event] });
        return { event };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  delete_calendar_event: tool({
    description:
      "Delete a calendar event by id. Discover the event_id via get_todays_schedule or get_calendar_events first. Irreversible — only call when the user clearly asked to delete/cancel.",
    inputSchema: z.object({
      event_id: z.string().describe("Google Calendar event id"),
    }),
    execute: async ({ event_id }, { toolCallId: _ }) => {
      try {
        const result = await traced(
          "calendar",
          `DELETE /events/${event_id}`,
          () => deleteEvent(event_id)
        );
        return { deleted: true, event_id: result.id };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  list_tasks: tool({
    description:
      "List the user's tasks. Pass `filter` ONLY when the user literally named that exact category; otherwise OMIT `filter` entirely to get all tasks. You may only filter by ONE dimension at a time — there is no way to combine filters. For anything more complex, fetch all tasks (no filter) and narrow in your natural-language summary. Do NOT guess a filter value the user didn't explicitly say.",
    inputSchema: z.object({
      filter: z
        .enum([
          "pending",
          "in_progress",
          "completed",
          "high_priority",
          "medium_priority",
          "low_priority",
          "overdue",
        ])
        .optional()
        .describe(
          "Single-dimension filter. OMIT by default. Only set when the user literally used matching words — e.g. 'pending tasks' → 'pending', 'what's urgent/high priority' → 'high_priority', 'overdue' → 'overdue'. For 'show my tasks' or any broad/ambiguous request: OMIT this field."
        ),
    }),
    execute: async (input, { toolCallId }) => {
      try {
        const { filter } = input;
        const serverFilters: {
          status?: "pending" | "in_progress" | "completed";
          priority?: "low" | "medium" | "high";
          due_before?: string;
        } = {};
        if (filter === "pending" || filter === "in_progress" || filter === "completed") {
          serverFilters.status = filter;
        } else if (filter === "high_priority") {
          serverFilters.priority = "high";
        } else if (filter === "medium_priority") {
          serverFilters.priority = "medium";
        } else if (filter === "low_priority") {
          serverFilters.priority = "low";
        } else if (filter === "overdue") {
          serverFilters.due_before = new Date().toISOString().split("T")[0];
        }

        const tasks = await traced("tasks", "GET /tasks", () =>
          listTasks(serverFilters)
        );
        attachCard(toolCallId, { type: "tasks", data: tasks });
        return { tasks };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  create_task: tool({
    description:
      "Create a new task. Attach a reminder in ONE of two ways — NEVER both:\n" +
      "- RELATIVE — user said 'in X seconds/minutes/hours from NOW' → pass `remind_in_minutes` only.\n" +
      "- EVENT-ANCHORED or ABSOLUTE — user said 'at 3pm tomorrow', 'an hour before my 1pm meeting', 'tonight at 9', or any other reminder pegged to a wall-clock moment → pass `reminder_at` only, as a naive ISO datetime (e.g. `2026-04-18T12:00:00`, no `Z`, no offset). Compute this yourself from the event's start time (which you just fetched) and the system-prompt date. DO NOT try to express an event-anchored reminder in `remind_in_minutes` — you don't have a reliable 'minutes from now' because you don't know the server's wall clock, so a small error fires the reminder immediately.\n" +
      "Pass EXACTLY ONE of these fields — never both. If both are somehow passed, the server prefers `reminder_at` (because event-anchored is the common case), but this is a bug path, not a feature.",
    inputSchema: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      due_date: z
        .string()
        .optional()
        .describe("Due date in ISO format (YYYY-MM-DD)"),
      reminder_at: z
        .string()
        .optional()
        .describe(
          "Naive ISO datetime like '2026-04-18T12:00:00' (no 'Z', no offset — the server injects the user's timezone). Use this for ANY wall-clock-anchored reminder: 'at 3pm tomorrow', 'an hour before my 1pm meeting', 'tonight at 9', etc. When the reminder is tied to an event you just fetched, compute the target time here."
        ),
      remind_in_minutes: z
        .number()
        .positive()
        .optional()
        .describe(
          "Fire the reminder this many minutes from NOW (server clock). Use this ONLY when the user explicitly said 'in X seconds/minutes/hours from now'. Never for event-anchored reminders. Fractional values OK (0.5 = 30 seconds)."
        ),
    }),
    execute: async (input, { toolCallId }) => {
      try {
        const { remind_in_minutes, reminder_at: llmReminderAt, ...rest } =
          input;
        // Precedence: absolute `reminder_at` wins over relative `remind_in_minutes`.
        // Event-anchored requests ("an hour before my 1pm meeting") land in
        // `reminder_at`; if the LLM also hedges and sends a tiny
        // `remind_in_minutes` alongside, we must not silently fire the reminder
        // immediately. Relative is used only when `reminder_at` is absent.
        let reminder_at: string | undefined = llmReminderAt;
        if (!reminder_at && remind_in_minutes) {
          reminder_at = new Date(
            Date.now() + remind_in_minutes * 60_000
          ).toISOString();
        }
        if (llmReminderAt && remind_in_minutes !== undefined) {
          console.warn(
            "[tasks] create_task received both reminder_at and remind_in_minutes; preferring reminder_at"
          );
        }

        const task = await traced("tasks", "POST /tasks", () =>
          createTask({ ...rest, reminder_at })
        );
        attachCard(toolCallId, { type: "tasks", data: [task] });
        return { task };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  update_task: tool({
    description:
      "Update a task — mark completed, change priority, rename, set/clear reminder, etc. For reminders: use `remind_in_minutes` ONLY when the user said 'in X from now'; use `reminder_at` (naive ISO like '2026-04-18T12:00:00') for any event-anchored or absolute time. Use `reminder_at: null` to clear. Pass EXACTLY ONE of the two reminder fields — never both. If both are somehow passed, the server prefers `reminder_at`.",
    inputSchema: z.object({
      id: z.number().describe("Task ID to update"),
      title: z.string().optional(),
      description: z.string().optional(),
      status: z.enum(["pending", "in_progress", "completed"]).optional(),
      priority: z.enum(["low", "medium", "high"]).optional(),
      due_date: z.string().optional(),
      reminder_at: z
        .string()
        .nullable()
        .optional()
        .describe(
          "Naive ISO datetime like '2026-04-18T12:00:00' (no 'Z', no offset — server injects TZ), or null to clear. Use this for event-anchored or absolute reminders."
        ),
      remind_in_minutes: z
        .number()
        .positive()
        .optional()
        .describe(
          "Relative reminder in minutes from NOW. Use ONLY for explicit 'in X from now' requests, never for event-anchored reminders (fractional OK)."
        ),
    }),
    execute: async ({ id, remind_in_minutes, ...input }, { toolCallId }) => {
      try {
        let reminder_at: string | null | undefined = input.reminder_at;
        if (reminder_at === undefined && remind_in_minutes) {
          reminder_at = new Date(
            Date.now() + remind_in_minutes * 60_000
          ).toISOString();
        }
        if (
          input.reminder_at !== undefined &&
          remind_in_minutes !== undefined
        ) {
          console.warn(
            "[tasks] update_task received both reminder_at and remind_in_minutes; preferring reminder_at"
          );
        }

        const task = await traced("tasks", `PATCH /tasks/${id}`, () =>
          updateTask(id, { ...input, reminder_at })
        );
        if (!task) return { error: `Task with id ${id} not found` };
        attachCard(toolCallId, { type: "tasks", data: [task] });
        return { task };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_github_repos: tool({
    description:
      "List the user's GitHub repositories, sorted by recently updated. Call this first so you know the correct owner username.",
    inputSchema: z.object({}),
    execute: async (_input, { toolCallId }) => {
      try {
        const repos = await traced("github", "GET /repos", () =>
          listUserRepos()
        );
        attachCard(toolCallId, { type: "github", data: { repos } });
        return { repos };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_repo_activity: tool({
    description:
      "Recent commits, pull requests, and issues for a specific GitHub repo. owner comes from get_github_repos — never guess it.",
    inputSchema: z.object({
      owner: z.string().describe("Repository owner (username or org)"),
      repo: z.string().describe("Repository name"),
    }),
    execute: async ({ owner, repo }, { toolCallId }) => {
      try {
        const activity = await traced(
          "github",
          `GET /repos/${owner}/${repo}/activity`,
          () => getRepoActivity(owner, repo)
        );
        attachCard(toolCallId, { type: "github", data: activity });
        return activity;
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_assigned_issues: tool({
    description: "Get GitHub issues assigned to the user across all repos",
    inputSchema: z.object({}),
    execute: async (_input, { toolCallId }) => {
      try {
        const issues = await traced(
          "github",
          "GET /issues?filter=assigned",
          () => listAssignedIssues()
        );
        attachCard(toolCallId, { type: "github", data: { issues } });
        return { issues };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_top_news: tool({
    description: "Get top stories from HackerNews (tech news)",
    inputSchema: z.object({
      limit: z.number().optional().describe("Number of stories (default 10)"),
    }),
    execute: async ({ limit }, { toolCallId }) => {
      try {
        const stories = await traced("news", "GET /news/top", () =>
          getTopStories(limit ?? 10)
        );
        attachCard(toolCallId, { type: "news", data: stories });
        return { stories };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  search_news: tool({
    description: "Search HackerNews stories by keyword",
    inputSchema: z.object({
      query: z.string().describe("Search keyword"),
      limit: z.number().optional(),
    }),
    execute: async ({ query, limit }, { toolCallId }) => {
      try {
        const stories = await traced("news", `GET /news/search?q=${query}`, () =>
          searchStories(query, limit ?? 10)
        );
        attachCard(toolCallId, { type: "news", data: stories });
        return { stories };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  read_article: tool({
    description:
      "Fetch the full text of a HackerNews-linked article so you can summarize it or answer questions about it. Prefer `story_id` (from get_top_news / search_news results) — that way the HN title is carried along automatically. Use `url` only if the user pasted a URL directly. After this tool returns, write the TL;DR yourself in your own words; do NOT quote the raw content back at the user.",
    inputSchema: z.object({
      story_id: z
        .number()
        .optional()
        .describe("HackerNews item id (preferred)."),
      url: z
        .string()
        .url()
        .optional()
        .describe("Direct article URL. Only use if story_id is unknown."),
    }),
    execute: async ({ story_id, url }, { toolCallId }) => {
      if (story_id == null && !url) {
        return {
          error:
            "Provide either story_id (from a news list) or url.",
        };
      }
      try {
        const article = await traced(
          "news",
          story_id != null
            ? `GET /news/item/${story_id}`
            : `GET ${url}`,
          () => readArticle({ storyId: story_id, url })
        );
        attachCard(toolCallId, { type: "article", data: article });
        return { article };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_current_weather: tool({
    description:
      "Current weather for a city. Defaults to Singapore when city is not provided. If the user didn't name a city, OMIT the city field entirely — do not pass an empty string.",
    inputSchema: z.object({
      city: z
        .string()
        .min(1)
        .optional()
        .describe(
          "City name. Omit this field entirely to use the default (Singapore). Never pass an empty string."
        ),
    }),
    execute: async ({ city }, { toolCallId }) => {
      try {
        const resolvedCity = city && city.length > 0 ? city : undefined;
        const weather = await traced(
          "weather",
          `GET /weather/current${resolvedCity ? `?city=${resolvedCity}` : ""}`,
          () => getCurrentWeather(resolvedCity)
        );
        attachCard(toolCallId, { type: "weather", data: weather });
        return weather;
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_weather_forecast: tool({
    description:
      "5-day forecast for a city. Defaults to Singapore when city is not provided. If the user didn't name a city, OMIT the city field entirely — do not pass an empty string.",
    inputSchema: z.object({
      city: z
        .string()
        .min(1)
        .optional()
        .describe(
          "City name. Omit this field entirely to use the default (Singapore). Never pass an empty string."
        ),
    }),
    execute: async ({ city }, { toolCallId }) => {
      try {
        const resolvedCity = city && city.length > 0 ? city : undefined;
        const forecast = await traced(
          "weather",
          `GET /weather/forecast${resolvedCity ? `?city=${resolvedCity}` : ""}`,
          () => getForecast(resolvedCity)
        );
        attachCard(toolCallId, { type: "weather", data: forecast });
        return forecast;
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),
};
