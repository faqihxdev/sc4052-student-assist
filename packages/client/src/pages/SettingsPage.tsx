import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Settings,
  Calendar,
  Github,
  Newspaper,
  Cloud,
  Brain,
  CheckSquare,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Eye,
  EyeOff,
  AlertCircle,
  Check,
} from "lucide-react";
import { useSettings } from "../hooks/useSettings";
import { getGoogleAuthUrl } from "../lib/api";

export default function SettingsPage() {
  const {
    statuses,
    loading,
    error,
    saving,
    refresh,
    saveKey,
    disconnectGoogleAccount,
    getStatus,
  } = useSettings();

  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const authResult = searchParams.get("auth");
    if (authResult === "success") {
      setToast({ type: "success", message: "Google account connected successfully!" });
      refresh();
      setSearchParams({}, { replace: true });
    } else if (authResult === "error") {
      const msg = searchParams.get("message") || "Authentication failed";
      setToast({ type: "error", message: msg });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, refresh]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--color-amber-accent)]" />
      </div>
    );
  }

  const calendarStatus = getStatus("calendar");
  const githubStatus = getStatus("github");
  const weatherStatus = getStatus("weather");
  const newsStatus = getStatus("news");
  const tasksStatus = getStatus("tasks");

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

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-dim)] px-4 py-3 text-sm text-[var(--color-error)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mb-6 flex items-center gap-3">
        <Settings className="h-6 w-6 text-[var(--color-text-secondary)]" />
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Settings</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            Connect your services to get started
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        <GoogleCalendarCard
          status={calendarStatus}
          saving={saving === "calendar"}
          onConnect={() => {
            window.location.href = getGoogleAuthUrl();
          }}
          onDisconnect={async () => {
            try {
              await disconnectGoogleAccount();
              setToast({
                type: "success",
                message: "Google account disconnected",
              });
            } catch (err: any) {
              setToast({
                type: "error",
                message: err.message || "Failed to disconnect",
              });
            }
          }}
        />

        <ApiKeyCard
          name="GitHub"
          description="Track repositories and issues"
          icon={<Github className="h-5 w-5 text-[var(--color-text-primary)]" />}
          connected={githubStatus?.connected ?? false}
          details={githubStatus?.details}
          placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
          saving={saving === "github"}
          onSave={async (value) => {
            try {
              await saveKey("github", value);
              setToast({
                type: "success",
                message: "GitHub token saved successfully!",
              });
            } catch (err: any) {
              setToast({
                type: "error",
                message: err.message || "Failed to save token",
              });
            }
          }}
        />

        <ApiKeyCard
          name="Weather"
          description="Current conditions and forecast"
          icon={<Cloud className="h-5 w-5 text-[var(--color-card-weather-accent)]" />}
          connected={weatherStatus?.connected ?? false}
          details={weatherStatus?.details}
          placeholder="Your OpenWeatherMap API key"
          saving={saving === "weather"}
          onSave={async (value) => {
            try {
              await saveKey("weather", value);
              setToast({
                type: "success",
                message: "Weather API key saved successfully!",
              });
            } catch (err: any) {
              setToast({
                type: "error",
                message: err.message || "Failed to save API key",
              });
            }
          }}
        />

        <BuiltInCard
          name="HackerNews"
          description="Tech news and trending stories"
          icon={<Newspaper className="h-5 w-5 text-[var(--color-card-news-accent)]" />}
          connected={newsStatus?.connected ?? true}
        />

        <BuiltInCard
          name="Tasks"
          description="Local task management"
          icon={<CheckSquare className="h-5 w-5 text-[var(--color-card-tasks-accent)]" />}
          connected={tasksStatus?.connected ?? true}
        />

        <BuiltInCard
          name="OpenAI"
          description="AI model for chat orchestration"
          icon={<Brain className="h-5 w-5 text-[var(--color-card-calendar-accent)]" />}
          connected={true}
          details="Configured via server environment"
        />
      </div>
    </div>
  );
}

function StatusBadge({
  connected,
  details,
}: {
  connected: boolean;
  details?: string;
}) {
  return (
    <div className="flex items-center gap-1.5" title={details}>
      {connected ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />
          <span className="text-xs font-medium text-[var(--color-success)]">Connected</span>
        </>
      ) : (
        <>
          <XCircle className="h-4 w-4 text-[var(--color-text-muted)]" />
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            Not configured
          </span>
        </>
      )}
    </div>
  );
}

function GoogleCalendarCard({
  status,
  saving,
  onConnect,
  onDisconnect,
}: {
  status?: { connected: boolean; details?: string };
  saving: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[var(--color-card-calendar)] p-2.5">
            <Calendar className="h-5 w-5 text-[var(--color-card-calendar-accent)]" />
          </div>
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">Google Calendar</h3>
            <p className="text-sm text-[var(--color-text-muted)]">View and manage your schedule</p>
          </div>
        </div>
        <StatusBadge
          connected={status?.connected ?? false}
          details={status?.details}
        />
      </div>
      <div className="mt-4">
        {status?.connected ? (
          <button
            onClick={onDisconnect}
            disabled={saving}
            className="w-full rounded-lg border border-[var(--color-error)]/20 px-4 py-2 text-sm font-medium text-[var(--color-error)] transition-colors hover:bg-[var(--color-error-dim)] disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Disconnecting…
              </span>
            ) : (
              "Disconnect Google Account"
            )}
          </button>
        ) : (
          <button
            onClick={onConnect}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-card-calendar-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Connect Google Account
          </button>
        )}
      </div>
    </div>
  );
}

function ApiKeyCard({
  name,
  description,
  icon,
  connected,
  details,
  placeholder,
  saving,
  onSave,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  details?: string;
  placeholder: string;
  saving: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [editing, setEditing] = useState(false);

  function handleSave() {
    if (!value.trim()) return;
    onSave(value.trim());
    setValue("");
    setEditing(false);
  }

  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[var(--color-surface-overlay)] p-2.5">{icon}</div>
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">{name}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
          </div>
        </div>
        <StatusBadge connected={connected} details={details} />
      </div>
      <div className="mt-4">
        {connected && !editing ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg bg-[var(--color-success-dim)] border border-[var(--color-success)]/15 px-3 py-2 text-sm text-[var(--color-success)]">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5" />
                {details || "Configured"}
              </span>
            </div>
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg border border-[var(--color-border-default)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-hover)]"
            >
              Update
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showKey ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
                placeholder={placeholder}
                className="w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-overlay)] px-3 py-2 pr-9 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-amber-accent)] focus:shadow-[0_0_0_3px_var(--color-amber-glow)] placeholder:text-[var(--color-text-muted)]"
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !value.trim()}
              className="rounded-lg bg-[var(--color-amber-accent)] px-4 py-2 text-sm font-medium text-[var(--color-text-inverse)] transition-colors hover:bg-[var(--color-amber-hover)] disabled:opacity-40"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(false);
                  setValue("");
                }}
                className="rounded-lg border border-[var(--color-border-default)] px-3 py-2 text-sm text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)]"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BuiltInCard({
  name,
  description,
  icon,
  connected,
  details,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  details?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-surface-raised)] p-5">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-[var(--color-surface-overlay)] p-2.5">{icon}</div>
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">{name}</h3>
            <p className="text-sm text-[var(--color-text-muted)]">{description}</p>
          </div>
        </div>
        <StatusBadge connected={connected} details={details} />
      </div>
      <div className="mt-4">
        <div className="rounded-lg bg-[var(--color-surface-overlay)] px-4 py-2 text-sm text-[var(--color-text-muted)]">
          {details || "Built-in — no configuration needed"}
        </div>
      </div>
    </div>
  );
}
