import { tool } from "ai";
import { z } from "zod";
import type { ApiTrace, CardData } from "@studentassist/shared";

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
const cards: CardData[] = [];

export function resetCollectors() {
  traces.length = 0;
  cards.length = 0;
}

export function getTraces(): ApiTrace[] {
  return [...traces];
}

export function getCards(): CardData[] {
  return [...cards];
}

function getServicesCalled(): string[] {
  return [...new Set(traces.map((t) => t.service))];
}

export { getServicesCalled };

async function traced<T>(
  service: string,
  endpoint: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    traces.push({ service, endpoint, duration_ms: Math.round(performance.now() - start) });
    return result;
  } catch (err: any) {
    traces.push({ service, endpoint, duration_ms: Math.round(performance.now() - start) });
    throw err;
  }
}

export const allTools = {
  get_todays_schedule: tool({
    description: "Get today's calendar events and schedule",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const events = await traced("calendar", "GET /events/today", () => getTodaysEvents());
        cards.push({ type: "calendar", data: events });
        return { events };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_calendar_events: tool({
    description: "Get calendar events for a specific date range",
    inputSchema: z.object({
      time_min: z.string().describe("Start of range in ISO 8601 format (e.g. 2026-04-05T00:00:00Z)"),
      time_max: z.string().describe("End of range in ISO 8601 format (e.g. 2026-04-06T00:00:00Z)"),
    }),
    execute: async ({ time_min, time_max }) => {
      try {
        const events = await traced("calendar", `GET /events?timeMin=${time_min}&timeMax=${time_max}`, () =>
          listEvents(time_min, time_max)
        );
        cards.push({ type: "calendar", data: events });
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
    execute: async ({ date }) => {
      try {
        const result = await traced("calendar", `GET /freebusy?date=${date}`, () => getFreeBusy(date));
        cards.push({ type: "calendar", data: result });
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
      start: z.string().describe("Start time in ISO 8601 format"),
      end: z.string().describe("End time in ISO 8601 format"),
      description: z.string().optional().describe("Event description"),
      location: z.string().optional().describe("Event location"),
    }),
    execute: async (input) => {
      try {
        const event = await traced("calendar", "POST /events", () => createEvent(input));
        cards.push({ type: "calendar", data: [event] });
        return { event };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  list_tasks: tool({
    description:
      "List the user's tasks, optionally filtered by status, priority, or due date",
    inputSchema: z.object({
      status: z
        .enum(["pending", "in_progress", "completed"])
        .optional()
        .describe("Filter by task status"),
      priority: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Filter by priority"),
      due_before: z
        .string()
        .optional()
        .describe("Filter tasks due before this ISO date"),
    }),
    execute: async (params) => {
      try {
        const tasks = await traced("tasks", "GET /tasks", () => listTasks(params));
        cards.push({ type: "tasks", data: tasks });
        return { tasks };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  create_task: tool({
    description: "Create a new task with a title and optional details",
    inputSchema: z.object({
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Task description"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("Task priority"),
      due_date: z.string().optional().describe("Due date in ISO format"),
    }),
    execute: async (input) => {
      try {
        const task = await traced("tasks", "POST /tasks", () => createTask(input));
        cards.push({ type: "tasks", data: [task] });
        return { task };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  update_task: tool({
    description: "Update a task — mark as completed, change priority, rename, etc.",
    inputSchema: z.object({
      id: z.number().describe("Task ID to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      status: z.enum(["pending", "in_progress", "completed"]).optional().describe("New status"),
      priority: z.enum(["low", "medium", "high"]).optional().describe("New priority"),
      due_date: z.string().optional().describe("New due date in ISO format"),
    }),
    execute: async ({ id, ...input }) => {
      try {
        const task = await traced("tasks", `PATCH /tasks/${id}`, () => updateTask(id, input));
        if (!task) return { error: `Task with id ${id} not found` };
        cards.push({ type: "tasks", data: [task] });
        return { task };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_github_repos: tool({
    description: "List the user's GitHub repositories, sorted by recently updated",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const repos = await traced("github", "GET /repos", () => listUserRepos());
        cards.push({ type: "github", data: { repos } });
        return { repos };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_repo_activity: tool({
    description: "Get recent commits, pull requests, and issues for a specific GitHub repository",
    inputSchema: z.object({
      owner: z.string().describe("Repository owner (username or org)"),
      repo: z.string().describe("Repository name"),
    }),
    execute: async ({ owner, repo }) => {
      try {
        const activity = await traced("github", `GET /repos/${owner}/${repo}/activity`, () =>
          getRepoActivity(owner, repo)
        );
        cards.push({ type: "github", data: activity });
        return activity;
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_assigned_issues: tool({
    description: "Get GitHub issues assigned to the user across all repositories",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const issues = await traced("github", "GET /issues?filter=assigned", () =>
          listAssignedIssues()
        );
        cards.push({ type: "github", data: { issues } });
        return { issues };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_top_news: tool({
    description: "Get top stories from HackerNews (tech news)",
    inputSchema: z.object({
      limit: z.number().optional().describe("Number of stories to return (default 10)"),
    }),
    execute: async ({ limit }) => {
      try {
        const stories = await traced("news", "GET /news/top", () => getTopStories(limit ?? 10));
        cards.push({ type: "news", data: stories });
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
      limit: z.number().optional().describe("Number of results to return (default 10)"),
    }),
    execute: async ({ query, limit }) => {
      try {
        const stories = await traced("news", `GET /news/search?q=${query}`, () =>
          searchStories(query, limit ?? 10)
        );
        cards.push({ type: "news", data: stories });
        return { stories };
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_current_weather: tool({
    description: "Get current weather for a city. Omit the city parameter to use the user's default city.",
    inputSchema: z.object({
      city: z.string().optional().describe("City name (e.g. 'Singapore', 'London'). Omit to use default."),
    }),
    execute: async ({ city }) => {
      try {
        const resolvedCity = city && city.length > 0 ? city : undefined;
        const weather = await traced("weather", `GET /weather/current${resolvedCity ? `?city=${resolvedCity}` : ""}`, () =>
          getCurrentWeather(resolvedCity)
        );
        cards.push({ type: "weather", data: weather });
        return weather;
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),

  get_weather_forecast: tool({
    description: "Get 5-day weather forecast for a city. Omit the city parameter to use the user's default city.",
    inputSchema: z.object({
      city: z.string().optional().describe("City name (e.g. 'Singapore', 'London'). Omit to use default."),
    }),
    execute: async ({ city }) => {
      try {
        const resolvedCity = city && city.length > 0 ? city : undefined;
        const forecast = await traced("weather", `GET /weather/forecast${resolvedCity ? `?city=${resolvedCity}` : ""}`, () =>
          getForecast(resolvedCity)
        );
        cards.push({ type: "weather", data: forecast });
        return forecast;
      } catch (err: any) {
        return { error: err.message };
      }
    },
  }),
};
