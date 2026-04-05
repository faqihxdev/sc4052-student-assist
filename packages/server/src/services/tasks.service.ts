import { db } from "../db";
import { tasks } from "../db/schema";
import { eq, and, lte } from "drizzle-orm";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  Task,
  TaskStatus,
  TaskPriority,
} from "@studentassist/shared";

export interface TaskFilters {
  status?: TaskStatus;
  due_before?: string;
  priority?: TaskPriority;
}

export function listTasks(filters: TaskFilters = {}): Task[] {
  const conditions = [];

  if (filters.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters.priority) {
    conditions.push(eq(tasks.priority, filters.priority));
  }
  if (filters.due_before) {
    conditions.push(lte(tasks.due_date, filters.due_before));
  }

  if (conditions.length === 0) {
    return db.select().from(tasks).all();
  }

  return db.select().from(tasks).where(and(...conditions)).all();
}

export function createTask(input: CreateTaskInput): Task {
  const rows = db
    .insert(tasks)
    .values({
      title: input.title,
      description: input.description ?? null,
      priority: input.priority ?? "medium",
      due_date: input.due_date ?? null,
    })
    .returning()
    .all();

  return rows[0];
}

export function updateTask(id: number, input: UpdateTaskInput): Task | null {
  const rows = db
    .update(tasks)
    .set({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .where(eq(tasks.id, id))
    .returning()
    .all();

  return rows[0] ?? null;
}

export function deleteTask(id: number): Task | null {
  const rows = db
    .delete(tasks)
    .where(eq(tasks.id, id))
    .returning()
    .all();

  return rows[0] ?? null;
}
