import {
  Calendar,
  CheckSquare,
  Github,
  Newspaper,
  Cloud,
} from "lucide-react";

const SERVICE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  calendar: { icon: Calendar, color: "text-[var(--color-card-calendar-accent)]", bg: "bg-[var(--color-card-calendar)] border-[var(--color-card-calendar-border)]" },
  tasks: { icon: CheckSquare, color: "text-[var(--color-card-tasks-accent)]", bg: "bg-[var(--color-card-tasks)] border-[var(--color-card-tasks-border)]" },
  github: { icon: Github, color: "text-[var(--color-card-github-accent)]", bg: "bg-[var(--color-card-github)] border-[var(--color-card-github-border)]" },
  news: { icon: Newspaper, color: "text-[var(--color-card-news-accent)]", bg: "bg-[var(--color-card-news)] border-[var(--color-card-news-border)]" },
  weather: { icon: Cloud, color: "text-[var(--color-card-weather-accent)]", bg: "bg-[var(--color-card-weather)] border-[var(--color-card-weather-border)]" },
};

interface ServiceIndicatorProps {
  services: string[];
}

export default function ServiceIndicator({ services }: ServiceIndicatorProps) {
  if (!services.length) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {services.map((s) => {
        const cfg = SERVICE_CONFIG[s] || {
          icon: Cloud,
          color: "text-[var(--color-text-muted)]",
          bg: "bg-[var(--color-surface-overlay)] border-[var(--color-border-default)]",
        };
        const Icon = cfg.icon;
        return (
          <span
            key={s}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.color}`}
          >
            <Icon className="h-3 w-3" />
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        );
      })}
    </div>
  );
}
