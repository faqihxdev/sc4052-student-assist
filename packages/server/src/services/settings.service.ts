import { db } from "../db";
import { settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { config } from "../lib/config";
import type { ServiceName, ServiceStatus } from "@studentassist/shared";

const SERVICE_KEY_MAP: Record<ServiceName, string> = {
  weather: "openweathermap_api_key",
  github: "github_token",
  calendar: "google_oauth_token",
  tasks: "_builtin",
  news: "_builtin",
};

export function getSetting(key: string): string | null {
  const rows = db
    .select()
    .from(settings)
    .where(eq(settings.key, key))
    .all();

  return rows[0]?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const existing = getSetting(key);
  if (existing !== null) {
    db.update(settings)
      .set({ value, updated_at: new Date().toISOString() })
      .where(eq(settings.key, key))
      .run();
  } else {
    db.insert(settings)
      .values({ key, value, updated_at: new Date().toISOString() })
      .run();
  }
}

export function deleteSetting(key: string): boolean {
  const result = db
    .delete(settings)
    .where(eq(settings.key, key))
    .returning()
    .all();

  return result.length > 0;
}

export function getAllSettings(): Array<{ key: string; value: string; updated_at: string }> {
  return db.select().from(settings).all();
}

function hasEnvFallback(service: ServiceName): boolean {
  switch (service) {
    case "weather":
      return !!config.openweathermapApiKey;
    case "github":
      return !!config.githubToken;
    case "calendar":
      // Calendar requires OAuth — client credentials alone don't mean "connected"
      return false;
    case "tasks":
    case "news":
      return true;
    default:
      return false;
  }
}

export function getApiKeyForService(service: ServiceName): string | null {
  const dbKey = SERVICE_KEY_MAP[service];
  if (!dbKey || dbKey === "_builtin") return null;

  const dbValue = getSetting(dbKey);
  if (dbValue) return dbValue;

  switch (service) {
    case "weather":
      return config.openweathermapApiKey ?? null;
    case "github":
      return config.githubToken ?? null;
    default:
      return null;
  }
}

export function getServiceStatuses(): ServiceStatus[] {
  const services: ServiceName[] = ["calendar", "tasks", "github", "news", "weather"];

  return services.map((service) => {
    const dbKey = SERVICE_KEY_MAP[service];

    if (dbKey === "_builtin") {
      return { service, connected: true, details: "Built-in service, always available" };
    }

    if (config.mockMode && service !== "tasks" && service !== "news") {
      return { service, connected: true, details: "Using mock data (MOCK_MODE=true)" };
    }

    const dbValue = getSetting(dbKey);
    if (dbValue) {
      return { service, connected: true, details: "Configured via settings" };
    }

    if (hasEnvFallback(service)) {
      return { service, connected: true, details: "Configured via environment variable" };
    }

    // Fallback mock: service returns mock data when unconfigured
    if (service === "calendar" || service === "github" || service === "weather") {
      return { service, connected: true, details: "Using demo data (no API key configured)" };
    }

    if (service === "calendar" && config.googleClientId && config.googleClientSecret) {
      return { service, connected: false, details: "Google account not connected — authorize in Settings" };
    }

    return { service, connected: false, details: "Not configured" };
  });
}
