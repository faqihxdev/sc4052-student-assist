import { useRef, useEffect } from "react";
import {
  MessageCircle,
  Calendar,
  CheckSquare,
  Github,
  Newspaper,
  Cloud,
  Trash2,
} from "lucide-react";
import { useChat } from "../hooks/useChat";
import ChatInput from "../components/chat/ChatInput";
import MessageBubble from "../components/chat/MessageBubble";

const SUGGESTIONS: {
  label: string;
  prompt: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    label: "My day",
    prompt: "What's my day looking like?",
    icon: Calendar,
  },
  {
    label: "Pending tasks",
    prompt: "Show my pending tasks",
    icon: CheckSquare,
  },
  {
    label: "GitHub",
    prompt: "Summarize my GitHub activity",
    icon: Github,
  },
  {
    label: "Tech news",
    prompt: "What's trending in tech?",
    icon: Newspaper,
  },
  {
    label: "Weather",
    prompt: "How's the weather today?",
    icon: Cloud,
  },
];

export default function ChatPage() {
  const { messages, isLoading, sendMessage, stopStreaming, clearMessages } =
    useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto scrollbar-thin"
      >
        {isEmpty ? (
          <WelcomeScreen onSuggestionClick={sendMessage} />
        ) : (
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {!isEmpty && (
        <div className="flex justify-center py-2">
          <button
            onClick={clearMessages}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] px-3 py-1 text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-secondary)] disabled:opacity-50"
          >
            <Trash2 className="h-3 w-3" />
            Clear chat
          </button>
        </div>
      )}

      <ChatInput
        onSend={sendMessage}
        onStop={stopStreaming}
        isLoading={isLoading}
      />
    </div>
  );
}

function WelcomeScreen({
  onSuggestionClick,
}: {
  onSuggestionClick: (msg: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="mb-5 rounded-2xl bg-[var(--color-amber-subtle)] p-5">
        <MessageCircle className="h-10 w-10 text-[var(--color-amber-accent)]" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-[var(--color-text-primary)]">
        Welcome to StudentAssist
      </h2>
      <p className="mb-8 max-w-md text-[var(--color-text-secondary)]">
        Your AI assistant for managing classes, tasks, GitHub projects, news,
        and weather. Try one of these to get started:
      </p>
      <div className="flex flex-wrap justify-center gap-2 max-w-3xl">
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => onSuggestionClick(s.prompt)}
              title={s.prompt}
              className="group inline-flex items-center gap-2 rounded-full border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] px-3.5 py-2 text-sm text-[var(--color-text-secondary)] whitespace-nowrap transition-all hover:border-[var(--color-border-accent)] hover:bg-[var(--color-amber-subtle)] hover:text-[var(--color-amber-accent)]"
            >
              <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-amber-accent)]" />
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
