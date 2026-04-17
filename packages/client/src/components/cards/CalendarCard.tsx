import { Calendar, MapPin, ExternalLink } from "lucide-react";

/**
 * Matches the flat shape returned by `calendar.service.ts` → `mapEvent()`.
 * (The previous version of this card expected the raw Google API nested
 * shape `start.dateTime`, so every event rendered with empty times and a
 * dangling "–" separator.)
 */
interface CalendarEvent {
  id?: string;
  summary?: string;
  description?: string | null;
  location?: string | null;
  start?: string;
  end?: string;
  all_day?: boolean;
  html_link?: string;
  status?: string;
}

interface CalendarCardProps {
  data: unknown;
}

function formatTime(iso?: string, allDay?: boolean): string {
  if (!iso) return "";
  if (allDay) return "All day";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateShort(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  const sameDay =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
  if (sameDay) return "";
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  if (isTomorrow) return "Tomorrow";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Render a compact event row: a colored time-range pill on the left, then
 * the title, optional description, and location stacked tightly on the right.
 * Avoids the previous "TIME – TIME" orphaned-dash bug by only emitting the
 * separator when we actually have both ends.
 */
function EventRow({ event }: { event: CalendarEvent }) {
  const startTime = formatTime(event.start, event.all_day);
  const endTime = formatTime(event.end, event.all_day);
  const day = formatDateShort(event.start);

  return (
    <div className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
      <div className="mt-0.5 flex w-16 shrink-0 flex-col items-center rounded-md bg-[var(--color-card-calendar-accent)]/15 py-1 text-[var(--color-card-calendar-accent)]">
        <span className="text-xs font-semibold leading-tight">
          {startTime || "—"}
        </span>
        {endTime && endTime !== startTime && (
          <span className="text-[10px] opacity-70 leading-tight">
            to {endTime}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {event.summary || "Untitled event"}
        </p>
        {event.description && (
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)] line-clamp-3 whitespace-pre-wrap">
            {event.description}
          </p>
        )}
        {(event.location || day) && (
          <div className="mt-1 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
            {day && <span>{day}</span>}
            {event.location && (
              <span className="inline-flex items-center gap-1 truncate">
                <MapPin className="h-3 w-3 shrink-0" /> {event.location}
              </span>
            )}
          </div>
        )}
      </div>
      {event.html_link && event.html_link !== "#" && (
        <a
          href={event.html_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 shrink-0 text-[var(--color-card-calendar-accent)] opacity-50 hover:opacity-100"
          title="Open in Google Calendar"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

export default function CalendarCard({ data }: CalendarCardProps) {
  // Service returns either CalendarEvent[] or a FreeBusyResult for find_free_time.
  // We only handle the event-list case here; free-busy renders as JSON in the
  // expandable tool output (good enough for now).
  const events: CalendarEvent[] = Array.isArray(data) ? data : [];

  if (!events.length) {
    return (
      <div className="rounded-xl border border-[var(--color-card-calendar-border)] bg-[var(--color-card-calendar)] p-4">
        <div className="flex items-center gap-2 text-sm text-[var(--color-card-calendar-accent)]">
          <Calendar className="h-4 w-4" />
          <span className="font-medium">No events found</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--color-card-calendar-border)] bg-[var(--color-card-calendar)] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-[var(--color-card-calendar-border)] px-4 py-2.5">
        <Calendar className="h-4 w-4 text-[var(--color-card-calendar-accent)]" />
        <span className="text-xs font-semibold text-[var(--color-card-calendar-accent)] uppercase tracking-wide">
          Calendar
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          {events.length} event{events.length > 1 ? "s" : ""}
        </span>
      </div>
      <div className="divide-y divide-[var(--color-card-calendar-border)]/30">
        {events.map((event, i) => (
          <EventRow key={event.id ?? i} event={event} />
        ))}
      </div>
    </div>
  );
}
