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
};
