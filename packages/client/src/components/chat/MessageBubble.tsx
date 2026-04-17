import { User } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../hooks/useChat";
import ServiceIndicator from "./ServiceIndicator";
import TracesPanel from "./TracesPanel";
import ToolSegment from "./ToolSegment";

interface MessageBubbleProps {
  message: ChatMessage;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="flex items-end gap-2.5 max-w-[80%]">
          <div className="rounded-2xl rounded-br-md bg-[var(--color-amber-accent)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-inverse)]">
            {message.content}
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-amber-subtle)] mb-0.5">
            <User className="h-3.5 w-3.5 text-[var(--color-amber-accent)]" />
          </div>
        </div>
      </div>
    );
  }

  const { phase, segments = [], services, traces, isStreaming } = message;
  const showThinkingPlaceholder =
    phase === "thinking" && segments.length === 0;

  return (
    <div className="animate-slide-up space-y-3">
      {/* Thinking placeholder before any segment arrives */}
      {showThinkingPlaceholder && (
        <div className="flex items-center gap-1.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber-accent)] animate-pulse-dot" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber-accent)] animate-pulse-dot [animation-delay:0.2s]" />
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber-accent)] animate-pulse-dot [animation-delay:0.4s]" />
          <span className="ml-2 text-xs text-[var(--color-text-muted)]">
            Thinking…
          </span>
        </div>
      )}

      {/* Inline ordered segments: preamble text → tool call → tool call → summary → … */}
      {segments.map((seg, i) => {
        if (seg.kind === "text") {
          if (!seg.content) return null;
          return (
            <div key={`text-${seg.id}-${i}`} className="prose-chat animate-fade-in">
              <Markdown remarkPlugins={[remarkGfm]}>{seg.content}</Markdown>
            </div>
          );
        }
        return (
          <div key={`tool-${seg.toolCallId}`} className="card-enter">
            <ToolSegment segment={seg} />
          </div>
        );
      })}

      {/* Streaming cursor while the model is still producing */}
      {isStreaming && !showThinkingPlaceholder && (
        <span className="inline-block h-4 w-0.5 animate-blink bg-[var(--color-amber-accent)]" />
      )}

      {/* Footer: service badges + API traces */}
      {phase === "done" && services && services.length > 0 && (
        <div className="flex items-center gap-3 pt-1 animate-fade-in">
          <ServiceIndicator services={services} />
          {traces && <TracesPanel traces={traces} />}
        </div>
      )}
    </div>
  );
}
