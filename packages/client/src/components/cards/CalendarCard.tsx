import { Calendar, Clock, MapPin, ExternalLink } from "lucide-react";

interface CalendarEvent {
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  htmlLink?: string;
}

interface CalendarCardProps {
  data: unknown;
}

function formatTime(dt?: { dateTime?: string; date?: string }) {
  if (!dt) return "";
  const raw = dt.dateTime || dt.date;
  if (!raw) return "";
  const d = new Date(raw);
  if (dt.dateTime) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return "All day";
}

export default function CalendarCard({ data }: CalendarCardProps) {
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
        <span className="text-xs text-[var(--color-text-muted)]">{events.length} event{events.length > 1 ? "s" : ""}</span>
      </div>
      <div className="divide-y divide-[var(--color-card-calendar-border)]/30">
        {events.map((ev, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]">
            <div className="mt-0.5 flex h-8 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-[var(--color-card-calendar-accent)]/15 text-[var(--color-card-calendar-accent)]">
              <Clock className="h-3 w-3 mb-0.5" />
              <span className="text-[10px] font-semibold leading-none">
                {formatTime(ev.start)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                {ev.summary || "Untitled event"}
              </p>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                {ev.location && (
                  <span className="inline-flex items-center gap-1 truncate">
                    <MapPin className="h-3 w-3 shrink-0" /> {ev.location}
                  </span>
                )}
                {ev.start && ev.end && (
                  <span>{formatTime(ev.start)} – {formatTime(ev.end)}</span>
                )}
              </div>
            </div>
            {ev.htmlLink && (
              <a
                href={ev.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-[var(--color-card-calendar-accent)] opacity-50 hover:opacity-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
