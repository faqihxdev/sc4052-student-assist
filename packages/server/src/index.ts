import app from "./app";
import { config } from "./lib/config";
import { initializeDatabase } from "./db";

initializeDatabase();

console.log(`StudentAssist server starting on port ${config.port}...`);

export default {
  port: config.port,
  fetch: app.fetch,
};
