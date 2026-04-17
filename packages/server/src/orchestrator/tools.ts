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
  ],
  tasks: ["list_tasks", "create_task", "update_task"],
  github: ["get_github_repos", "get_repo_activity", "get_assigned_issues"],
  news: ["get_top_news", "search_news"],
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
    "View today's schedule, list events by date range, find free time, create events.",
  tasks: "List, create, and update tasks with priorities and due dates.",
  github: "List repos, view repo activity, see assigned issues.",
  news: "Get top HackerNews stories or search by keyword.",
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
        description: "Create a new calendar event.",
        input:
          "{ summary, start: ISO-8601, end: ISO-8601, description?, location? }",
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
    description: "Create a new calendar event",
    inputSchema: z.object({
      summary: z.string().describe("Event title"),
      start: z.string().describe("Start time ISO 8601"),
      end: z.string().describe("End time ISO 8601"),
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
      "Create a new task. Attach a reminder in ONE of two ways:\n" +
      "- RELATIVE ('in X minutes/seconds'): pass `remind_in_minutes` only. DO NOT also compute `reminder_at` — you don't know the server's current UTC time, so your computation will drift.\n" +
      "- ABSOLUTE ('at 3pm tomorrow'): pass `reminder_at` only, as an ISO datetime.\n" +
      "If both are passed, the server uses `remind_in_minutes` (its clock is authoritative).",
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
          "Absolute ISO datetime, e.g. '2026-04-17T15:00:00Z'. Use this ONLY for absolute times the user named. For relative requests use `remind_in_minutes` instead."
        ),
      remind_in_minutes: z
        .number()
        .positive()
        .optional()
        .describe(
          "Fire the reminder this many minutes from now (fractional values OK: 0.5 = 30 seconds, 0.166 = 10 seconds). Preferred for 'remind me in X' requests."
        ),
    }),
    execute: async (input, { toolCallId }) => {
      try {
        const { remind_in_minutes, reminder_at: llmReminderAt, ...rest } =
          input;
        // Relative > absolute: the server clock is authoritative, the LLM's
        // sense of "now" is not.
        const reminder_at = remind_in_minutes
          ? new Date(Date.now() + remind_in_minutes * 60_000).toISOString()
          : llmReminderAt;

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
      "Update a task — mark completed, change priority, rename, set/clear reminder, etc. For reminders: use `remind_in_minutes` for relative times, `reminder_at` for absolute, or `reminder_at: null` to clear. If both are passed, `remind_in_minutes` wins.",
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
          "Absolute ISO datetime for the reminder, or null to clear."
        ),
      remind_in_minutes: z
        .number()
        .positive()
        .optional()
        .describe(
          "Relative reminder in minutes from now (fractional OK)."
        ),
    }),
    execute: async ({ id, remind_in_minutes, ...input }, { toolCallId }) => {
      try {
        const reminder_at = remind_in_minutes
          ? new Date(Date.now() + remind_in_minutes * 60_000).toISOString()
          : input.reminder_at;

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
