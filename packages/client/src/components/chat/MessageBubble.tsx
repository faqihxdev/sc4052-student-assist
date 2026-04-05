import { User } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../hooks/useChat";
import type { CardData } from "@studentassist/shared";
import ToolProgress from "./ToolProgress";
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

const CARD_KEYWORDS: Record<string, string[]> = {
  calendar: ["calendar", "schedule", "event", "meeting", "appointment"],
  tasks: ["task", "to-do", "todo", "pending"],
  weather: ["weather", "temperature", "forecast", "humidity", "wind"],
  news: ["news", "hacker", "trending", "stories", "headlines"],
  github: ["github", "repo", "commit", "pull request", "issue", "branch"],
};

type ContentSlice =
  | { kind: "text"; content: string }
  | { kind: "card"; card: CardData };

function interleaveContentAndCards(
  content: string,
  cards: CardData[]
): ContentSlice[] {
  if (!cards.length) {
    return [{ kind: "text", content }];
  }

  const sections = content.split(/(?=^#{2,4}\s)/m);
  const remaining = [...cards];
  const result: ContentSlice[] = [];

  for (const section of sections) {
    if (!section.trim()) continue;
    result.push({ kind: "text", content: section });

    const lower = section.toLowerCase();
    const matchIdx = remaining.findIndex((card) => {
      const keywords = CARD_KEYWORDS[card.type];
      if (!keywords) return false;
      return keywords.some((kw) => lower.includes(kw));
    });

    if (matchIdx !== -1) {
      result.push({ kind: "card", card: remaining[matchIdx] });
      remaining.splice(matchIdx, 1);
    }
  }

  for (const card of remaining) {
    result.push({ kind: "card", card });
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

  const hasCards = message.cards && message.cards.length > 0;
  const slices =
    message.content && hasCards
      ? interleaveContentAndCards(message.content, message.cards!)
      : null;

  return (
    <div className="animate-slide-up space-y-3">
      {message.toolStatuses && message.toolStatuses.length > 0 && (
        <ToolProgress tools={message.toolStatuses} />
      )}

      {slices ? (
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
            <div key={`c-${i}`} className="animate-fade-in">
              <Comp data={slice.card.data} />
            </div>
          );
        })
      ) : (
        <>
          {message.content && (
            <div className="prose-chat">
              <Markdown remarkPlugins={[remarkGfm]}>
                {message.content}
              </Markdown>
            </div>
          )}

          {!message.content && message.isStreaming && (
            <div className="flex items-center gap-1.5 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber-accent)] animate-pulse-dot" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber-accent)] animate-pulse-dot [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber-accent)] animate-pulse-dot [animation-delay:0.4s]" />
            </div>
          )}
        </>
      )}

      {message.services && message.services.length > 0 && (
        <div className="flex items-center gap-3 pt-1">
          <ServiceIndicator services={message.services} />
          {message.traces && <TracesPanel traces={message.traces} />}
        </div>
      )}
    </div>
  );
}
