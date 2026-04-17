import { useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Calendar,
  CheckSquare,
  Info,
} from "lucide-react";
import {
  configureDemoState,
  removeDemoState,
  type DemoConfigureResult,
  type DemoRemoveResult,
} from "../lib/api";

type LastAction =
  | { kind: "configure"; result: DemoConfigureResult }
  | { kind: "remove"; result: DemoRemoveResult };

/**
 * Demo control page.
 *
 * Separated from Settings so the two-step "Configure → run demos → Remove"
 * flow has its own visible surface, and so configuration state (API keys)
 * isn't tangled with demo-day fixture state.
 */
export default function DemoPage() {
  const [busy, setBusy] = useState<null | "configure" | "remove">(null);
  const [last, setLast] = useState<LastAction | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  async function handleConfigure() {
    if (busy) return;
    setBusy("configure");
    setToast(null);
    try {
      const result = await configureDemoState();
      setLast({ kind: "configure", result });
      window.dispatchEvent(new CustomEvent("tasks-updated"));

      const calendarMsg = result.calendar.applied
        ? `${result.calendar.added} added · ${result.calendar.kept} kept · ${result.calendar.removed} stale removed`
        : result.calendar.reason ?? "calendar skipped";
      setToast({
        type: "success",
        message: `Demo configured: ${result.tasks.reseeded} tasks reseeded; ${calendarMsg}.`,
      });
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Failed to configure demo state",
      });
    } finally {
      setBusy(null);
    }
  }

  async function handleRemove() {
    if (busy) return;
    const confirmed = window.confirm(
      "Remove demo state?\n\n" +
        "• Every calendar event created by Configure demo will be deleted.\n" +
        "• The local task database will be wiped.\n\n" +
        "Your real calendar events are untouched."
    );
    if (!confirmed) return;
    setBusy("remove");
    setToast(null);
    try {
      const result = await removeDemoState();
      setLast({ kind: "remove", result });
      window.dispatchEvent(new CustomEvent("tasks-updated"));

      const calendarMsg = result.calendar.applied
        ? `${result.calendar.removed} events removed`
        : result.calendar.reason ?? "calendar skipped";
      setToast({
        type: "success",
        message: `Demo removed: ${result.tasks.wiped} tasks wiped; ${calendarMsg}.`,
      });
    } catch (err: any) {
      setToast({
        type: "error",
        message: err.message || "Failed to remove demo state",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      {toast && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm animate-slide-up ${
            toast.type === "success"
              ? "bg-[var(--color-success-dim)] text-[var(--color-success)] border border-[var(--color-success)]/20"
              : "bg-[var(--color-error-dim)] text-[var(--color-error)] border border-[var(--color-error)]/20"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <RefreshCw className="h-6 w-6 text-[var(--color-amber-accent)]" />
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
            Demo state
          </h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Configure the canonical fixture set before a live walkthrough, then
            remove it when you're done.
          </p>
        </div>
      </div>

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
        <div>
          <strong className="text-[var(--color-text-primary)]">
            Your real calendar is never touched.
          </strong>{" "}
          Demo events are tagged with a private extended property that only
          this app can see; invisible in the Google Calendar UI. Configure and
          Remove only touch events carrying that tag. Tasks live in the local
          database, so they're fully managed by this page.
        </div>
      </div>

      <div className="grid gap-4">
        <ActionCard
          kind="configure"
          title="Configure demo"
          description="Idempotent: creates missing fixtures, keeps matching ones, removes stale ones from prior runs. Safe to click repeatedly."
          busy={busy === "configure"}
          disabled={busy !== null}
          onClick={handleConfigure}
          accent="primary"
        />
        <ActionCard
          kind="remove"
          title="Remove demo"
          description="Deletes every demo-tagged calendar event and wipes the task DB. Use this after the demo to restore your calendar to its pre-demo state."
          busy={busy === "remove"}
          disabled={busy !== null}
          onClick={handleRemove}
          accent="secondary"
        />
      </div>

      {last && (
        <div className="mt-6 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Last action
            </h3>
            <span className="rounded-full bg-[var(--color-surface-overlay)] px-2 py-0.5 text-xs text-[var(--color-text-secondary)]">
              {last.kind === "configure" ? "Configure" : "Remove"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatRow
              icon={<CheckSquare className="h-4 w-4 text-[var(--color-card-tasks-accent)]" />}
              label="Tasks"
              value={
                last.kind === "configure"
                  ? `${last.result.tasks.reseeded} reseeded`
                  : `${last.result.tasks.wiped} wiped`
              }
            />
            <StatRow
              icon={<Calendar className="h-4 w-4 text-[var(--color-card-calendar-accent)]" />}
              label="Calendar"
              value={
                last.kind === "configure"
                  ? last.result.calendar.applied
                    ? `${last.result.calendar.added} added · ${last.result.calendar.kept} kept · ${last.result.calendar.removed} stale removed`
                    : last.result.calendar.reason ?? "skipped"
                  : last.result.calendar.applied
                    ? `${last.result.calendar.removed} events removed`
                    : last.result.calendar.reason ?? "skipped"
              }
            />
          </div>
        </div>
      )}

      <FixtureReference />
    </div>
  );
}

function ActionCard({
  kind,
  title,
  description,
  busy,
  disabled,
  onClick,
  accent,
}: {
  kind: "configure" | "remove";
  title: string;
  description: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  accent: "primary" | "secondary";
}) {
  const Icon = kind === "configure" ? CheckCircle2 : XCircle;
  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-lg p-2.5 ${
              accent === "primary"
                ? "bg-[var(--color-amber-glow)]"
                : "bg-[var(--color-surface-overlay)]"
            }`}
          >
            <Icon
              className={`h-5 w-5 ${
                accent === "primary"
                  ? "text-[var(--color-amber-accent)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
            />
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">
              {title}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {description}
            </p>
          </div>
        </div>
        <button
          onClick={onClick}
          disabled={disabled}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
            accent === "primary"
              ? "bg-[var(--color-amber-accent)] text-[var(--color-text-inverse)] hover:bg-[var(--color-amber-hover)]"
              : "border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {kind === "configure" ? "Configuring…" : "Removing…"}
            </span>
          ) : kind === "configure" ? (
            "Configure"
          ) : (
            "Remove"
          )}
        </button>
      </div>
    </div>
  );
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[var(--color-surface-overlay)] px-3 py-2.5">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-[var(--color-text-muted)]">
          {label}
        </div>
        <div className="text-sm text-[var(--color-text-primary)]">{value}</div>
      </div>
    </div>
  );
}

/**
 * Reference card showing exactly what the fixture set looks like. Useful
 * during a demo so the operator can explain what will appear on the
 * calendar without having to flip over to Google Calendar.
 */
function FixtureReference() {
  return (
    <div className="mt-6 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
        Canonical fixture set
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Tasks (6)
          </h4>
          <ul className="space-y-1.5 text-sm text-[var(--color-text-secondary)]">
            <li>Submit Algorithms problem set 4 · high · +3d</li>
            <li>Prepare Networks module presentation · high · +5d</li>
            <li>Review PR #12: streaming chat UI · medium · +1d</li>
            <li>Read Chapter 12: Graph theory basics · done</li>
            <li>Set up CI with GitHub Actions · low · +10d</li>
            <li>Buy groceries for the week · low · today</li>
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
            Calendar events (5)
          </h4>
          <ul className="space-y-1.5 text-sm text-[var(--color-text-secondary)]">
            <li>Today 10:00 · Algorithms Lecture</li>
            <li>Today 14:00 · Group Standup</li>
            <li>Tomorrow 09:00 · Study Group: Dynamic Programming</li>
            <li>Tomorrow 15:00 · Outdoor Run</li>
            <li>Tomorrow 20:00 · Review Meeting</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
