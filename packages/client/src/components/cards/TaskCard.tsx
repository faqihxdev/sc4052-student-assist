import { CheckSquare, Circle, Clock, AlertTriangle, Bell } from "lucide-react";

interface TaskItem {
  id?: number;
  title?: string;
  status?: string;
  priority?: string;
  due_date?: string | null;
  reminder_at?: string | null;
}

interface TaskCardProps {
  data: unknown;
}

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-[var(--color-error-dim)] text-[var(--color-error)]",
  medium: "bg-[var(--color-warning-dim)] text-[var(--color-warning)]",
  low: "bg-[var(--color-surface-overlay)] text-[var(--color-text-muted)]",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckSquare className="h-4 w-4 text-[var(--color-success)]" />,
  in_progress: <Clock className="h-4 w-4 text-[var(--color-warning)]" />,
  pending: <Circle className="h-4 w-4 text-[var(--color-text-muted)]" />,
};

function formatDueDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil(
    (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return "Due today";
  if (diffDays === 1) return "Due tomorrow";
  return `Due in ${diffDays}d`;
}

function formatReminder(iso?: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffSec = Math.round((t - Date.now()) / 1000);
  if (diffSec < -60) return "reminder missed";
  if (diffSec < 0) return "reminder now";
  if (diffSec < 60) return `in ${diffSec}s`;
  if (diffSec < 3600) return `in ${Math.round(diffSec / 60)}m`;
  if (diffSec < 86400) return `in ${Math.round(diffSec / 3600)}h`;
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function TaskCard({ data }: TaskCardProps) {
  const tasks: TaskItem[] = Array.isArray(data) ? data : [];

  if (!tasks.length) {
    return (
      <div className="rounded-xl border border-[var(--color-card-tasks-border)] bg-[var(--color-card-tasks)] p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-card-tasks-accent)]">
          <CheckSquare className="h-4 w-4" />
          <span className="font-medium">No tasks found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-card-tasks-border)] bg-[var(--color-card-tasks)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-card-tasks-border)] px-4 py-2.5">
        <CheckSquare className="h-4 w-4 text-[var(--color-card-tasks-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-card-tasks-accent)] uppercase tracking-wide">
          Tasks
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">{tasks.length} item{tasks.length > 1 ? "s" : ""}</span>
      </div>
      <div className="divide-y divide-[var(--color-card-tasks-border)]/30">
        {tasks.map((task, i) => (
          <div key={task.id ?? i} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]">
            {STATUS_ICON[task.status || "pending"]}
            <div className="min-w-0 flex-1">
              <p className={`text-sm ${task.status === "completed" ? "line-through text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]"}`}>
                {task.title || "Untitled task"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {task.reminder_at && task.status !== "completed" && (
                <span
                  className="inline-flex items-center gap-1 text-xs text-[var(--color-card-tasks-accent)]"
                  title={`Reminder at ${new Date(task.reminder_at).toLocaleString()}`}
                >
                  <Bell className="h-3 w-3" />
                  {formatReminder(task.reminder_at)}
                </span>
              )}
              {task.due_date && (
                <span className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                  {task.due_date && new Date(task.due_date) < new Date() && task.status !== "completed" && (
                    <AlertTriangle className="h-3 w-3 text-[var(--color-error)]" />
                  )}
                  {formatDueDate(task.due_date)}
                </span>
              )}
              {task.priority && (
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_BADGE[task.priority] || PRIORITY_BADGE.medium}`}>
                  {task.priority}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
