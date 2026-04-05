import { useState, useCallback, useRef } from "react";
import type {
  ApiTrace,
  CardData,
  ChatRole,
  ChatStreamEvent,
} from "@studentassist/shared";
import { streamChat } from "../lib/api";

export type AgentPhase = "idle" | "thinking" | "tools" | "streaming" | "done";

export interface ToolStep {
  toolName: string;
  service: string;
  label: string;
  status: "loading" | "done";
  startedAt: number;
  durationMs?: number;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  phase: AgentPhase;
  services?: string[];
  traces?: ApiTrace[];
  cards?: CardData[];
  toolSteps?: ToolStep[];
  isStreaming?: boolean;
}

const TOOL_SERVICE_MAP: Record<string, string> = {
  get_todays_schedule: "Calendar",
  get_calendar_events: "Calendar",
  find_free_time: "Calendar",
  create_calendar_event: "Calendar",
  list_tasks: "Tasks",
  create_task: "Tasks",
  update_task: "Tasks",
  get_github_repos: "GitHub",
  get_repo_activity: "GitHub",
  get_assigned_issues: "GitHub",
  get_top_news: "News",
  search_news: "News",
  get_current_weather: "Weather",
  get_weather_forecast: "Weather",
};

const TOOL_LABELS: Record<string, string> = {
  get_todays_schedule: "Checking your calendar",
  get_calendar_events: "Looking up calendar events",
  find_free_time: "Finding free time slots",
  create_calendar_event: "Creating calendar event",
  list_tasks: "Fetching your tasks",
  create_task: "Creating a new task",
  update_task: "Updating task",
  get_github_repos: "Loading GitHub repos",
  get_repo_activity: "Fetching repo activity",
  get_assigned_issues: "Checking assigned issues",
  get_top_news: "Searching tech news",
  search_news: "Searching news",
  get_current_weather: "Getting current weather",
  get_weather_forecast: "Fetching weather forecast",
};

let messageIdCounter = 0;
function genId() {
  return `msg-${Date.now()}-${++messageIdCounter}`;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      const userMessage: ChatMessage = {
        id: genId(),
        role: "user",
        content: content.trim(),
        phase: "done",
      };

      const assistantId = genId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        phase: "thinking",
        toolSteps: [],
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const stream = streamChat(
          { message: content.trim(), history },
          abortController.signal
        );

        for await (const event of stream) {
          if (abortController.signal.aborted) break;
          applyEvent(assistantId, event);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, isStreaming: false, phase: "done" }
              : m
          )
        );
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content:
                    m.content ||
                    `Sorry, something went wrong: ${err.message}`,
                  isStreaming: false,
                  phase: "done",
                }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, isLoading]
  );

  function applyEvent(id: string, event: ChatStreamEvent) {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;

        switch (event.type) {
          case "step-start":
            return m;

          case "tool-call": {
            const service =
              TOOL_SERVICE_MAP[event.toolName] || event.toolName;
            const label =
              TOOL_LABELS[event.toolName] || `Using ${service}`;
            const existing = m.toolSteps || [];
            const alreadyHas = existing.some(
              (t) => t.toolName === event.toolName
            );
            if (alreadyHas) return m;
            return {
              ...m,
              phase: "tools" as AgentPhase,
              toolSteps: [
                ...existing,
                {
                  toolName: event.toolName,
                  service,
                  label,
                  status: "loading",
                  startedAt: Date.now(),
                },
              ],
            };
          }

          case "tool-result": {
            const now = Date.now();
            const steps = (m.toolSteps || []).map((t) =>
              t.toolName === event.toolName
                ? {
                    ...t,
                    status: "done" as const,
                    durationMs: now - t.startedAt,
                  }
                : t
            );
            return { ...m, toolSteps: steps };
          }

          case "card": {
            const existing = m.cards || [];
            return { ...m, cards: [...existing, event.card] };
          }

          case "step-finish":
            return m;

          case "text-delta": {
            const nextPhase: AgentPhase =
              m.phase === "tools" || m.phase === "thinking"
                ? "streaming"
                : m.phase;
            return {
              ...m,
              content: m.content + event.text,
              phase: nextPhase,
            };
          }

          case "done": {
            const streamedCards = m.cards || [];
            return {
              ...m,
              services: event.services_called,
              traces: event.traces,
              cards: streamedCards.length > 0 ? streamedCards : event.cards,
              phase: "done" as AgentPhase,
              isStreaming: false,
            };
          }

          case "error":
            return {
              ...m,
              content: m.content || `Error: ${event.message}`,
              phase: "done" as AgentPhase,
              isStreaming: false,
            };

          default:
            return m;
        }
      })
    );
  }

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}
