import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import type { HealthResponse } from "@studentassist/shared";
import { handleError } from "./lib/errors";
import { config } from "./lib/config";

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

app.onError((err, c) => handleError(err, c));

if (config.isProd) {
  app.use(
    "/*",
    serveStatic({ root: "./packages/client/dist" })
  );

  app.get("*", serveStatic({ root: "./packages/client/dist", path: "index.html" }));
}

export default app;
