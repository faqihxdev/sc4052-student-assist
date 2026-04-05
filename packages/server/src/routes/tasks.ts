import { Hono } from "hono";
import { AppError } from "../lib/errors";
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
} from "../services/tasks.service";
import type { TaskStatus, TaskPriority } from "@studentassist/shared";

const app = new Hono();

const validStatuses: TaskStatus[] = ["pending", "in_progress", "completed"];
const validPriorities: TaskPriority[] = ["low", "medium", "high"];

app.get("/", (c) => {
  const status = c.req.query("status") as TaskStatus | undefined;
  const dueBefore = c.req.query("due_before");
  const priority = c.req.query("priority") as TaskPriority | undefined;

  if (status && !validStatuses.includes(status)) {
    throw new AppError(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }
  if (priority && !validPriorities.includes(priority)) {
    throw new AppError(400, `Invalid priority. Must be one of: ${validPriorities.join(", ")}`);
  }

  const tasks = listTasks({ status, due_before: dueBefore, priority });
  return c.json(tasks);
});

app.post("/", async (c) => {
  const body = await c.req.json();

  if (!body.title || typeof body.title !== "string" || body.title.trim() === "") {
    throw new AppError(400, "title is required and must be a non-empty string");
  }
  if (body.priority && !validPriorities.includes(body.priority)) {
    throw new AppError(400, `Invalid priority. Must be one of: ${validPriorities.join(", ")}`);
  }

  const task = createTask({
    title: body.title.trim(),
    description: body.description,
    priority: body.priority,
    due_date: body.due_date,
  });

  return c.json(task, 201);
});

app.patch("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new AppError(400, "Invalid task ID");
  }

  const body = await c.req.json();

  if (body.status && !validStatuses.includes(body.status)) {
    throw new AppError(400, `Invalid status. Must be one of: ${validStatuses.join(", ")}`);
  }
  if (body.priority && !validPriorities.includes(body.priority)) {
    throw new AppError(400, `Invalid priority. Must be one of: ${validPriorities.join(", ")}`);
  }

  const task = updateTask(id, {
    title: body.title,
    description: body.description,
    status: body.status,
    priority: body.priority,
    due_date: body.due_date,
  });

  if (!task) {
    throw new AppError(404, `Task with id ${id} not found`);
  }

  return c.json(task);
});

app.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    throw new AppError(400, "Invalid task ID");
  }

  const task = deleteTask(id);
  if (!task) {
    throw new AppError(404, `Task with id ${id} not found`);
  }

  return c.json({ message: "Task deleted", task });
});

export default app;
