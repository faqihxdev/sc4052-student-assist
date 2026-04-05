import { useState } from "react";
import { ChevronDown, Activity } from "lucide-react";
import type { ApiTrace } from "@studentassist/shared";

interface TracesPanelProps {
  traces: ApiTrace[];
}

export default function TracesPanel({ traces }: TracesPanelProps) {
  const [open, setOpen] = useState(false);

  if (!traces.length) return null;

  const totalMs = traces.reduce((sum, t) => sum + t.duration_ms, 0);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-text-secondary)]"
      >
        <Activity className="h-3 w-3" />
        {traces.length} API call{traces.length > 1 ? "s" : ""} · {totalMs}ms
        <ChevronDown
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-1.5 space-y-1 animate-fade-in">
          {traces.map((t, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--color-text-primary)] capitalize">
                  {t.service}
                </span>
                <span className="font-mono text-[var(--color-text-muted)]">{t.endpoint}</span>
              </div>
              <span className="tabular-nums text-[var(--color-text-muted)]">
                {t.duration_ms}ms
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
