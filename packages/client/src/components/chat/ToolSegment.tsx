import { useEffect, useState } from "react";
import {
  Loader2,
  Check,
  AlertCircle,
  ChevronDown,
  Wrench,
} from "lucide-react";
import type { AssistantSegment } from "../../hooks/useChat";
import { TOOL_SERVICE_MAP } from "../../hooks/useChat";
import CalendarCard from "../cards/CalendarCard";
import TaskCard from "../cards/TaskCard";
import GitHubCard from "../cards/GitHubCard";
import NewsCard from "../cards/NewsCard";
import WeatherCard from "../cards/WeatherCard";
import ArticleCard from "../cards/ArticleCard";

const CARD_COMPONENT: Record<string, React.ComponentType<{ data: unknown }>> = {
  calendar: CalendarCard,
  tasks: TaskCard,
  github: GitHubCard,
  news: NewsCard,
  weather: WeatherCard,
  article: ArticleCard,
};

const SERVICE_ICONS: Record<string, string> = {
  Agent: "🧭",
  Calendar: "📅",
  Tasks: "✅",
  GitHub: "🐙",
  News: "📰",
  Weather: "🌤️",
};

type ToolSeg = Extract<AssistantSegment, { kind: "tool" }>;

interface Props {
  segment: ToolSeg;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Ticks every `intervalMs` while `active` is true, returning the elapsed ms
 * since `startedAt`. Lets us render a live countup next to running tools
 * without re-rendering the entire message list.
 */
function useElapsed(startedAt: number, active: boolean, intervalMs = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return Math.max(0, now - startedAt);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Drop args whose value the user doesn't need to see — empty strings, null,
 * undefined, or empty arrays/objects. Keeps the pill row clean when the model
 * fills optional fields with empty values instead of omitting them.
 */
function isMeaningful(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/**
 * Render a tool input object as a compact list of key: value pills.
 * Values are rendered inline for primitives and truncated for complex ones.
 */
function ArgPills({ input }: { input: unknown }) {
  const entries = isPlainObject(input)
    ? Object.entries(input).filter(([, v]) => isMeaningful(v))
    : [];

  if (entries.length === 0) {
    return (
      <span className="text-[11px] italic text-[var(--color-text-muted)]">
        no arguments
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {entries.map(([key, value]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-overlay)] border border-[var(--color-border-subtle)] px-1.5 py-0.5 text-[11px] font-mono"
        >
          <span className="text-[var(--color-text-muted)]">{key}:</span>
          <span className="text-[var(--color-text-primary)]">
            {formatArgValue(value)}
          </span>
        </span>
      ))}
    </div>
  );
}

function formatArgValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") {
    if (v.length > 40) return `"${v.slice(0, 37)}…"`;
    return `"${v}"`;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.length} items]`;
  if (typeof v === "object") return "{…}";
  return String(v);
}

export default function ToolSegment({ segment }: Props) {
  const service = TOOL_SERVICE_MAP[segment.toolName] ?? "Tool";
  const icon = SERVICE_ICONS[service] ?? "🔧";
  const [open, setOpen] = useState(false);

  const isLoading = segment.status === "loading";
  const liveElapsedMs = useElapsed(segment.startedAt, isLoading);
  const displayedMs = isLoading ? liveElapsedMs : segment.durationMs;

  const canExpand =
    !isLoading &&
    (segment.output !== undefined || segment.card !== undefined);

  const CardComp = segment.card
    ? CARD_COMPONENT[segment.card.type]
    : undefined;

  return (
    <div className="tool-segment rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-raised)] overflow-hidden">
      {/* Header row: status · icon · tool name · args · duration · chevron */}
      <button
        type="button"
        onClick={() => canExpand && setOpen((o) => !o)}
        disabled={!canExpand}
        className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors enabled:hover:bg-[var(--color-surface-hover)] disabled:cursor-default"
      >
        <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
          {segment.status === "loading" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-amber-accent)]" />
          )}
          {segment.status === "done" && (
            <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-success)]">
              <Check
                className="h-2 w-2 text-[var(--color-surface-base)]"
                strokeWidth={3}
              />
            </div>
          )}
          {segment.status === "error" && (
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          )}
        </div>

        <span className="shrink-0 text-sm leading-5">{icon}</span>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
              <Wrench className="mr-1 inline h-3 w-3 align-[-2px] text-[var(--color-text-muted)]" />
              {segment.toolName}
            </span>
            <span className="text-[11px] text-[var(--color-text-muted)]">
              · {service}
            </span>
          </div>
          <ArgPills input={segment.input} />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 pl-2">
          {displayedMs != null && (
            <span
              className={`tool-duration tabular-nums rounded-md px-1.5 py-0.5 text-[10px] ${
                isLoading
                  ? "text-[var(--color-amber-accent)] bg-[rgba(212,145,92,0.12)]"
                  : "bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]"
              }`}
            >
              {formatDuration(displayedMs)}
            </span>
          )}
          {canExpand && (
            <ChevronDown
              className={`h-3 w-3 text-[var(--color-text-muted)] transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          )}
        </div>
      </button>

      {/* Card (inline, always visible when present) */}
      {CardComp && segment.card && (
        <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] p-3">
          <CardComp data={segment.card.data} />
        </div>
      )}

      {/* Expandable raw output (for debugging / meta-tool outputs without cards) */}
      {open && segment.output !== undefined && !segment.card && (
        <div className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-base)] p-3">
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[var(--color-surface-overlay)] p-2 text-[11px] font-mono text-[var(--color-text-secondary)]">
            {safeStringify(segment.output)}
          </pre>
        </div>
      )}
    </div>
  );
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
