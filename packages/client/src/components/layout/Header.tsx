import { NavLink } from "react-router-dom";
import { MessageCircle, Settings, GraduationCap } from "lucide-react";

export default function Header() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-[var(--color-amber-subtle)] text-[var(--color-amber-accent)]"
        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
    }`;

  return (
    <header className="border-b border-[var(--color-border-default)] bg-[var(--color-surface-raised)]">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-amber-subtle)]">
            <GraduationCap className="h-4.5 w-4.5 text-[var(--color-amber-accent)]" />
          </div>
          <span className="text-lg font-semibold text-[var(--color-text-primary)]">
            StudentAssist
          </span>
        </div>
        <nav className="flex items-center gap-1">
          <NavLink to="/chat" className={linkClass}>
            <MessageCircle className="h-4 w-4" />
            Chat
          </NavLink>
          <NavLink to="/settings" className={linkClass}>
            <Settings className="h-4 w-4" />
            Settings
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
