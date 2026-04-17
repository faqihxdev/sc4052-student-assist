import { useState, useCallback, useRef } from "react";
import type {
  ApiTrace,
  CardData,
  ChatRole,
  ChatStreamEvent,
} from "@studentassist/shared";
import { streamChat } from "../lib/api";

export type AgentPhase = "idle" | "thinking" | "working" | "done";

export type AssistantSegment =
  | {
      kind: "text";
      id: string;
      content: string;
    }
  | {
      kind: "tool";
      toolCallId: string;
      toolName: string;
      input: unknown;
      status: "loading" | "done" | "error";
      output?: unknown;
      card?: CardData;
      startedAt: number;
      durationMs?: number;
    };

export interface ChatMessage {
  id: string;
  role: ChatRole;
  /** For user: the raw message. For assistant: a concatenated plain-text view
   *  (derived from text segments) used for LLM history on subsequent turns. */
  content: string;
  segments?: AssistantSegment[];
  phase: AgentPhase;
  services?: string[];
  traces?: ApiTrace[];
  isStreaming?: boolean;
}

export const TOOL_SERVICE_MAP: Record<string, string> = {
  list_tools_for_domain: "Agent",
  get_todays_schedule: "Calendar",
  get_calendar_events: "Calendar",
  find_free_time: "Calendar",
  create_calendar_event: "Calendar",
  update_calendar_event: "Calendar",
  delete_calendar_event: "Calendar",
  list_tasks: "Tasks",
  create_task: "Tasks",
  update_task: "Tasks",
  get_github_repos: "GitHub",
  get_repo_activity: "GitHub",
  get_assigned_issues: "GitHub",
  get_top_news: "News",
  search_news: "News",
  read_article: "News",
  get_current_weather: "Weather",
  get_weather_forecast: "Weather",
};

function segmentsToContent(segments: AssistantSegment[] | undefined): string {
  if (!segments) return "";
  return segments
    .filter((s): s is Extract<AssistantSegment, { kind: "text" }> => s.kind === "text")
    .map((s) => s.content)
    .join("\n\n")
    .trim();
}

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
        segments: [],
        phase: "thinking",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setIsLoading(true);

      const history = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role,
          content:
            m.role === "assistant"
              ? segmentsToContent(m.segments) || m.content
              : m.content,
        }))
        .filter((m) => m.content.length > 0);

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
          prev.map((m) => {
            if (m.id !== assistantId) return m;
            const finalContent = segmentsToContent(m.segments);
            return {
              ...m,
              content: finalContent || m.content,
              isStreaming: false,
              phase: "done",
            };
          })
        );
      } catch (err: any) {
        if (err.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  segments: [
                    ...(m.segments ?? []),
                    {
                      kind: "text",
                      id: "err",
                      content: `Sorry, something went wrong: ${err.message}`,
                    },
                  ],
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
        const segments = m.segments ? [...m.segments] : [];

        switch (event.type) {
          case "step-start":
          case "step-finish":
            return m;

          case "text-start": {
            segments.push({
              kind: "text",
              id: event.id,
              content: "",
            });
            return { ...m, segments, phase: "working" };
          }

          case "text-delta": {
            const idx = segments.findIndex(
              (s) => s.kind === "text" && s.id === event.id
            );
            if (idx >= 0 && segments[idx].kind === "text") {
              const prevSeg = segments[idx] as Extract<
                AssistantSegment,
                { kind: "text" }
              >;
              segments[idx] = {
                ...prevSeg,
                content: prevSeg.content + event.text,
              };
            } else {
              // Fallback: text-delta without matching text-start.
              segments.push({
                kind: "text",
                id: event.id,
                content: event.text,
              });
            }
            return { ...m, segments, phase: "working" };
          }

          case "text-end":
            return m;

          case "tool-call": {
            segments.push({
              kind: "tool",
              toolCallId: event.toolCallId,
              toolName: event.toolName,
              input: event.input,
              status: "loading",
              startedAt: Date.now(),
            });
            return { ...m, segments, phase: "working" };
          }

          case "tool-result": {
            const idx = segments.findIndex(
              (s) => s.kind === "tool" && s.toolCallId === event.toolCallId
            );
            if (idx >= 0 && segments[idx].kind === "tool") {
              const prevSeg = segments[idx] as Extract<
                AssistantSegment,
                { kind: "tool" }
              >;
              const output = event.output as any;
              const isError =
                output && typeof output === "object" && "error" in output;
              segments[idx] = {
                ...prevSeg,
                status: isError ? "error" : "done",
                output: event.output,
                durationMs: Date.now() - prevSeg.startedAt,
              };
            }
            return { ...m, segments };
          }

          case "card": {
            const idx = segments.findIndex(
              (s) => s.kind === "tool" && s.toolCallId === event.toolCallId
            );
            if (idx >= 0 && segments[idx].kind === "tool") {
              const prevSeg = segments[idx] as Extract<
                AssistantSegment,
                { kind: "tool" }
              >;
              segments[idx] = { ...prevSeg, card: event.card };
            }
            // Let the reminders hook know it should re-read tasks and
            // schedule any new notifications.
            if (event.card?.type === "tasks" && typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("tasks-updated"));
            }
            return { ...m, segments };
          }

          case "done": {
            return {
              ...m,
              services: event.services_called,
              traces: event.traces,
              phase: "done" as AgentPhase,
              isStreaming: false,
            };
          }

          case "error":
            return {
              ...m,
              segments: [
                ...segments,
                {
                  kind: "text",
                  id: "err",
                  content: `Error: ${event.message}`,
                },
              ],
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
