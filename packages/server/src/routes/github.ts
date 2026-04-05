import { Hono } from "hono";
import { AppError } from "../lib/errors";
import {
  listUserRepos,
  getRepoActivity,
  listAssignedIssues,
} from "../services/github.service";

const app = new Hono();

app.get("/repos", async (c) => {
  const repos = await listUserRepos();
  return c.json(repos);
});

app.get("/repos/:owner/:repo/activity", async (c) => {
  const owner = c.req.param("owner");
  const repo = c.req.param("repo");

  if (!owner || !repo) {
    throw new AppError(400, "owner and repo path parameters are required");
  }

  const activity = await getRepoActivity(owner, repo);
  return c.json(activity);
});

app.get("/issues", async (c) => {
  const issues = await listAssignedIssues();
  return c.json(issues);
});

export default app;
