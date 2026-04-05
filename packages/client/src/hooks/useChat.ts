import { useState, useCallback, useRef } from "react";
import type {
  ApiTrace,
  CardData,
  ChatRole,
  ChatStreamEvent,
} from "@studentassist/shared";
import { streamChat } from "../lib/api";

export interface ToolStatus {
  toolName: string;
  status: "loading" | "done";
  service: string;
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  services?: string[];
  traces?: ApiTrace[];
  cards?: CardData[];
  toolStatuses?: ToolStatus[];
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
      };

      const assistantId = genId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        toolStatuses: [],
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
            m.id === assistantId ? { ...m, isStreaming: false } : m
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
          case "text-delta":
            return { ...m, content: m.content + event.text };

          case "tool-call": {
            const service =
              TOOL_SERVICE_MAP[event.toolName] || event.toolName;
            const existing = m.toolStatuses || [];
            const alreadyHas = existing.some(
              (t) => t.toolName === event.toolName
            );
            if (alreadyHas) return m;
            return {
              ...m,
              toolStatuses: [
                ...existing,
                { toolName: event.toolName, status: "loading", service },
              ],
            };
          }

          case "tool-result": {
            const statuses = (m.toolStatuses || []).map((t) =>
              t.toolName === event.toolName ? { ...t, status: "done" as const } : t
            );
            return { ...m, toolStatuses: statuses };
          }

          case "done":
            return {
              ...m,
              services: event.services_called,
              traces: event.traces,
              cards: event.cards,
              isStreaming: false,
            };

          case "error":
            return {
              ...m,
              content: m.content || `Error: ${event.message}`,
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
