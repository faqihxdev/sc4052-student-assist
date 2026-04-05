import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import type { HealthResponse } from "@studentassist/shared";
import { handleError } from "./lib/errors";
import { config } from "./lib/config";
import tasksRoutes from "./routes/tasks";
import weatherRoutes from "./routes/weather";
import newsRoutes from "./routes/news";
import githubRoutes from "./routes/github";
import settingsRoutes from "./routes/settings";
import authRoutes from "./routes/auth";
import calendarRoutes from "./routes/calendar";
import chatRoutes from "./routes/chat";

const app = new Hono();

app.use("*", logger());
app.use(
  "/api/*",
  cors({
    origin: config.isProd ? "*" : "http://localhost:5173",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

app.get("/api/v1/health", (c) => {
  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "0.0.1",
  };
  return c.json(response);
});

app.route("/api/v1/tasks", tasksRoutes);
app.route("/api/v1/weather", weatherRoutes);
app.route("/api/v1/news", newsRoutes);
app.route("/api/v1/github", githubRoutes);
app.route("/api/v1/settings", settingsRoutes);
app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/calendar", calendarRoutes);
app.route("/api/v1/chat", chatRoutes);

app.onError((err, c) => handleError(err, c));

if (config.isProd) {
  app.use(
    "/*",
    serveStatic({ root: "./packages/client/dist" })
  );

  app.get("*", serveStatic({ root: "./packages/client/dist", path: "index.html" }));
}

export default app;
