import { NavLink } from "react-router-dom";
import { MessageCircle, Settings, GraduationCap } from "lucide-react";

export default function Header() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-100 text-indigo-700"
        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
    }`;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-indigo-600" />
          <span className="text-lg font-semibold text-gray-900">
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
