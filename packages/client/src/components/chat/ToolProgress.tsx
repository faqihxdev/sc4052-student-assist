import { Loader2, CheckCircle2 } from "lucide-react";
import type { ToolStatus } from "../../hooks/useChat";

interface ToolProgressProps {
  tools: ToolStatus[];
}

export default function ToolProgress({ tools }: ToolProgressProps) {
  if (!tools.length) return null;

  return (
    <div className="flex flex-wrap gap-2 py-1">
      {tools.map((t) => (
        <span
          key={t.toolName}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs text-[var(--color-text-secondary)]"
        >
          {t.status === "loading" ? (
            <Loader2 className="h-3 w-3 animate-spin text-[var(--color-amber-accent)]" />
          ) : (
            <CheckCircle2 className="h-3 w-3 text-[var(--color-success)]" />
          )}
          {t.status === "loading" ? `Fetching ${t.service}…` : t.service}
        </span>
      ))}
    </div>
  );
}
