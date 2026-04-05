import { Hono } from "hono";
import { AppError } from "../lib/errors";
import {
  getServiceStatuses,
  setSetting,
} from "../services/settings.service";
import type { ServiceName } from "@studentassist/shared";

const app = new Hono();

const validServices: ServiceName[] = ["calendar", "tasks", "github", "news", "weather"];

const SERVICE_SETTING_KEY: Record<string, string> = {
  weather: "openweathermap_api_key",
  github: "github_token",
  calendar: "google_oauth_token",
};

app.get("/", (c) => {
  const statuses = getServiceStatuses();
  return c.json(statuses);
});

app.put("/:service", async (c) => {
  const service = c.req.param("service") as ServiceName;

  if (!validServices.includes(service)) {
    throw new AppError(400, `Invalid service. Must be one of: ${validServices.join(", ")}`);
  }

  if (service === "tasks" || service === "news") {
    throw new AppError(
      400,
      `${service} is a built-in service and does not require configuration`
    );
  }

  const body = await c.req.json();

  const apiKey = body.api_key ?? body.token;
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim() === "") {
    throw new AppError(400, "api_key or token is required and must be a non-empty string");
  }

  const settingKey = SERVICE_SETTING_KEY[service];
  if (!settingKey) {
    throw new AppError(400, `Configuration not supported for service: ${service}`);
  }

  setSetting(settingKey, apiKey.trim());

  return c.json({
    message: `${service} configuration updated`,
    service,
    configured: true,
  });
});

export default app;
