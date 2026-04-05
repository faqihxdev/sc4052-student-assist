import { User } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../hooks/useChat";
import type { CardData } from "@studentassist/shared";
import AgentSteps from "./AgentSteps";
import ServiceIndicator from "./ServiceIndicator";
import TracesPanel from "./TracesPanel";
import CalendarCard from "../cards/CalendarCard";
import TaskCard from "../cards/TaskCard";
import GitHubCard from "../cards/GitHubCard";
import NewsCard from "../cards/NewsCard";
import WeatherCard from "../cards/WeatherCard";

interface MessageBubbleProps {
  message: ChatMessage;
}

const CARD_COMPONENT: Record<string, React.ComponentType<{ data: unknown }>> = {
  calendar: CalendarCard,
  tasks: TaskCard,
  github: GitHubCard,
  news: NewsCard,
  weather: WeatherCard,
};

type ContentSlice =
  | { kind: "text"; content: string }
  | { kind: "card"; card: CardData };

function interleaveContentAndCards(
  content: string,
  cards: CardData[],
  isStreaming: boolean
): ContentSlice[] {
  if (!cards.length) return [{ kind: "text", content }];

  const cardMap = new Map<string, CardData>();
  for (const card of cards) cardMap.set(card.type, card);

  let processed = content;
  if (isStreaming) {
    const openIdx = processed.lastIndexOf("{{");
    if (openIdx !== -1 && !processed.substring(openIdx).includes("}}")) {
      processed = processed.substring(0, openIdx);
    }
  }

  const parts = processed.split(/\{\{card:(\w+)\}\}/);
  const result: ContentSlice[] = [];
  const placed = new Set<string>();

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      const text = parts[i];
      if (text.trim()) result.push({ kind: "text", content: text });
    } else {
      const type = parts[i];
      const card = cardMap.get(type);
      if (card) {
        result.push({ kind: "card", card });
        placed.add(type);
      }
    }
  }

  if (!isStreaming) {
    for (const card of cards) {
      if (!placed.has(card.type)) {
        result.push({ kind: "card", card });
      }
    }
  }

  return result;
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

  const { phase, toolSteps = [], content, cards, services, traces } = message;
  const hasTools = toolSteps.length > 0;
  const hasCards = cards && cards.length > 0;
  const showContent = phase === "streaming" || phase === "done";

  const isStreaming = phase === "streaming";
  const slices =
    content && hasCards
      ? interleaveContentAndCards(content, cards!, isStreaming)
      : null;

  return (
    <div className="animate-slide-up space-y-3">
      {/* Phase 1 & 2: Agent steps (expanded during tools, collapsed after) */}
      {(hasTools || phase === "thinking") && (
        <AgentSteps steps={toolSteps} phase={phase} />
      )}

      {/* Phase 3: Content delivery */}
      {showContent && slices ? (
        slices.map((slice, i) => {
          if (slice.kind === "text") {
            return (
              <div key={`t-${i}`} className="prose-chat">
                <Markdown remarkPlugins={[remarkGfm]}>
                  {slice.content}
                </Markdown>
              </div>
            );
          }
          const Comp = CARD_COMPONENT[slice.card.type];
          if (!Comp) return null;
          return (
            <div key={`card-${slice.card.type}-${i}`} className="card-enter">
              <Comp data={slice.card.data} />
            </div>
          );
        })
      ) : showContent && content ? (
        <div className="prose-chat animate-fade-in">
          <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
        </div>
      ) : null}

      {/* Streaming cursor when text is actively arriving */}
      {phase === "streaming" && (
        <span className="inline-block h-4 w-0.5 animate-blink bg-[var(--color-amber-accent)]" />
      )}

      {/* Footer: service badges + traces */}
      {phase === "done" && services && services.length > 0 && (
        <div className="flex items-center gap-3 pt-1 animate-fade-in">
          <ServiceIndicator services={services} />
          {traces && <TracesPanel traces={traces} />}
        </div>
      )}
    </div>
  );
}
