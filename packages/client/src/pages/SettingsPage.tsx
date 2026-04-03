import {
  Settings,
  Calendar,
  Github,
  Newspaper,
  Cloud,
  Brain,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface ServiceCardProps {
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
}

function ServiceCard({ name, description, icon, connected }: ServiceCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-gray-100 p-2.5">{icon}</div>
          <div>
            <h3 className="font-medium text-gray-900">{name}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-green-600">
                Connected
              </span>
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-400">
                Not configured
              </span>
            </>
          )}
        </div>
      </div>
      <div className="mt-4">
        <button
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          disabled
        >
          Configure
        </button>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const services: ServiceCardProps[] = [
    {
      name: "Google Calendar",
      description: "View and manage your schedule",
      icon: <Calendar className="h-5 w-5 text-blue-600" />,
      connected: false,
    },
    {
      name: "GitHub",
      description: "Track repositories and issues",
      icon: <Github className="h-5 w-5 text-gray-900" />,
      connected: false,
    },
    {
      name: "HackerNews",
      description: "Tech news and trending stories",
      icon: <Newspaper className="h-5 w-5 text-orange-500" />,
      connected: true,
    },
    {
      name: "Weather",
      description: "Current conditions and forecast",
      icon: <Cloud className="h-5 w-5 text-cyan-500" />,
      connected: false,
    },
    {
      name: "OpenAI",
      description: "AI model for chat orchestration",
      icon: <Brain className="h-5 w-5 text-purple-600" />,
      connected: false,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-6 w-6 text-gray-700" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500">
            Connect your services to get started
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {services.map((service) => (
          <ServiceCard key={service.name} {...service} />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-gray-400">
        Service configuration coming in Phase 2
      </p>
    </div>
  );
}
