import { useState, useRef, useEffect } from "react";
import { Send, Square } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export default function ChatInput({
  onSend,
  onStop,
  isLoading,
  disabled,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading) {
      textareaRef.current?.focus();
    }
  }, [isLoading]);

  function handleSubmit() {
    if (!input.trim() || isLoading || disabled) return;
    onSend(input);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleInput() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  return (
    <div className="bg-[var(--color-surface-base)] px-4 pb-4 pt-2">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] px-4 py-2.5 transition-all focus-within:border-[var(--color-amber-accent)] focus-within:shadow-[0_0_0_3px_var(--color-amber-glow)]">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder="Ask StudentAssist anything..."
            className="max-h-40 flex-1 resize-none bg-transparent text-sm leading-8 text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
            rows={1}
            disabled={disabled}
          />
          {isLoading ? (
            <button
              onClick={onStop}
              className="flex h-8 w-8 shrink-0 self-end items-center justify-center rounded-lg bg-[var(--color-text-secondary)] text-[var(--color-surface-base)] transition-colors hover:bg-[var(--color-text-primary)]"
              title="Stop generating"
            >
              <Square className="h-3.5 w-3.5" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() || disabled}
              className="flex h-8 w-8 shrink-0 self-end items-center justify-center rounded-lg bg-[var(--color-amber-accent)] text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-amber-hover)] disabled:opacity-30"
              title="Send message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
