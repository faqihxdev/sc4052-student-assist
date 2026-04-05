import { Hono } from "hono";
import { AppError } from "../lib/errors";
import { getTopStories, searchStories } from "../services/news.service";

const app = new Hono();

app.get("/top", async (c) => {
  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (isNaN(limit) || limit < 1 || limit > 50) {
    throw new AppError(400, "limit must be a number between 1 and 50");
  }

  const stories = await getTopStories(limit);
  return c.json(stories);
});

app.get("/search", async (c) => {
  const query = c.req.query("q");
  if (!query || query.trim() === "") {
    throw new AppError(400, "Query parameter 'q' is required");
  }

  const limitParam = c.req.query("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 10;

  if (isNaN(limit) || limit < 1 || limit > 50) {
    throw new AppError(400, "limit must be a number between 1 and 50");
  }

  const stories = await searchStories(query.trim(), limit);
  return c.json(stories);
});

export default app;
