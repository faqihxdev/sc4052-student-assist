import app from "./app";
import { config } from "./lib/config";
import { initializeDatabase } from "./db";
import { seedDemoTasks } from "./db/seed";

initializeDatabase();
seedDemoTasks();

console.log(`StudentAssist server starting on port ${config.port}...`);
if (config.mockMode) console.log("  Mock mode: ENABLED (using demo data for unconfigured services)");

export default {
  port: config.port,
  fetch: app.fetch,
  // Bun's default idleTimeout is 10s, which kills SSE streams whenever a tool
  // call pauses output for longer than that (e.g. a slow HN search). Bump it
  // so the agent loop can run long tools without the stream being dropped.
  idleTimeout: 120,
};
