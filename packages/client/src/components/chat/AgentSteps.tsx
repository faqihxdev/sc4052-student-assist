import { useState } from "react";
import { Loader2, Check, ChevronRight } from "lucide-react";
import type { ToolStep, AgentPhase } from "../../hooks/useChat";

interface AgentStepsProps {
  steps: ToolStep[];
  phase: AgentPhase;
}

const SERVICE_ICONS: Record<string, string> = {
  Calendar: "📅",
  Tasks: "✅",
  GitHub: "🐙",
  News: "📰",
  Weather: "🌤️",
};

export default function AgentSteps({ steps, phase }: AgentStepsProps) {
  const isActive = phase === "thinking" || phase === "tools";
  const autoCollapsed = phase === "streaming" || phase === "done";
  const [userExpanded, setUserExpanded] = useState<boolean | null>(null);

  const expanded = userExpanded !== null ? userExpanded : !autoCollapsed;
  const totalMs = steps.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const serviceNames = [...new Set(steps.map((s) => s.service))];

  if (steps.length === 0 && !isActive) return null;

  return (
    <div className="agent-steps-container">
      {/* Collapsed summary */}
      {!expanded && (
        <button
          onClick={() => setUserExpanded(true)}
          className="group flex w-full items-center gap-1.5 py-1.5 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
        >
          <ChevronRight className="h-3 w-3 transition-transform" />
          <span className="text-[var(--color-text-secondary)]">
            Used {steps.length} {steps.length === 1 ? "tool" : "tools"}
          </span>
          <span>·</span>
          <span>{serviceNames.join(", ")}</span>
          {totalMs > 0 && (
            <>
              <span>·</span>
              <span>{formatDuration(totalMs)}</span>
            </>
          )}
        </button>
      )}

      {/* Expanded step list */}
      {expanded && (
        <div>
          {/* Header */}
          <button
            onClick={() => {
              if (!isActive) setUserExpanded(false);
            }}
            disabled={isActive}
            className="group flex w-full items-center gap-1.5 py-1.5 text-xs transition-colors hover:text-[var(--color-text-secondary)] disabled:cursor-default"
          >
            {isActive ? (
              <Loader2 className="h-3 w-3 animate-spin text-[var(--color-amber-accent)]" />
            ) : (
              <ChevronRight className="h-3 w-3 rotate-90 text-[var(--color-text-muted)] transition-transform" />
            )}
            <span className="font-medium text-[var(--color-text-secondary)]">
              {isActive
                ? steps.length === 0
                  ? "Thinking…"
                  : "Gathering your data…"
                : `Used ${steps.length} ${steps.length === 1 ? "tool" : "tools"}`}
            </span>
            {!isActive && totalMs > 0 && (
              <span className="text-[var(--color-text-muted)]">
                · {formatDuration(totalMs)}
              </span>
            )}
          </button>

          {/* Step items */}
          {steps.length > 0 && (
            <div className="space-y-0.5 py-0.5 pl-[18px]">
              {steps.map((step, i) => (
                <div
                  key={step.toolName}
                  className="step-item flex items-center gap-2 py-0.5 text-xs"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {step.status === "loading" ? (
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-[var(--color-amber-accent)]" />
                  ) : (
                    <div className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[var(--color-success)]">
                      <Check className="h-2 w-2 text-[var(--color-surface-base)]" strokeWidth={3} />
                    </div>
                  )}

                  <span className="leading-none">
                    {SERVICE_ICONS[step.service] ?? "🔧"}
                  </span>

                  <span
                    className={
                      step.status === "loading"
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-secondary)]"
                    }
                  >
                    {step.status === "loading"
                      ? `${step.label}…`
                      : step.label}
                  </span>

                  {step.status === "done" && step.durationMs != null && (
                    <span className="step-duration ml-auto rounded-md bg-[var(--color-surface-overlay)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--color-text-muted)]">
                      {formatDuration(step.durationMs)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pulsing dots when thinking with no tools yet */}
          {isActive && steps.length === 0 && (
            <div className="flex items-center gap-1.5 pl-[18px] py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber-accent)] animate-pulse-dot" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber-accent)] animate-pulse-dot [animation-delay:0.2s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-amber-accent)] animate-pulse-dot [animation-delay:0.4s]" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
