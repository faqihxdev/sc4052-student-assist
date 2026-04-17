import { db } from "./index";
import { tasks } from "./schema";

/**
 * ── Canonical demo state ────────────────────────────────────────────────
 * Task fixtures that the live demo script assumes. Each task is chosen so
 * that at least one demo scenario exercises it. Titles intentionally span
 * multiple student-life areas (academic, code, admin, personal) so the
 * "showcase of multi-API composition" framing is obvious from a glance at
 * the task list, rather than being tied to one persona.
 *
 * Kept short (6 items) so the agent's filtered list_tasks calls are easy
 * to read on screen. If you change this, update DEMO.md and the
 * Illustrative Examples section of the report.
 * ───────────────────────────────────────────────────────────────────────
 */

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

export const DEMO_TASKS = [
  {
    title: "Submit Algorithms problem set 4",
    description: "Trees, heaps, and amortized analysis write-up",
    status: "pending" as const,
    priority: "high" as const,
    due_date: daysFromNow(3),
  },
  {
    title: "Prepare Networks module presentation",
    description: "Group slides on TCP congestion control — 15 min slot",
    status: "pending" as const,
    priority: "high" as const,
    due_date: daysFromNow(5),
  },
  {
    title: "Review PR #12 — streaming chat UI",
    description: "Code review on studentassist-platform repo",
    status: "in_progress" as const,
    priority: "medium" as const,
    due_date: daysFromNow(1),
  },
  {
    title: "Read Chapter 12 — Graph theory basics",
    description: "BFS/DFS refresher and connectivity proofs",
    status: "completed" as const,
    priority: "medium" as const,
    due_date: daysFromNow(-1),
  },
  {
    title: "Set up CI with GitHub Actions",
    description: "Add automated tests and Docker build",
    status: "pending" as const,
    priority: "low" as const,
    due_date: daysFromNow(10),
  },
  {
    title: "Buy groceries for the week",
    description: null,
    status: "pending" as const,
    priority: "low" as const,
    due_date: daysFromNow(0),
  },
];

/**
 * Seed the canonical task set. If `force` is true, wipes existing tasks
 * first (used by the "Reset demo state" button). Otherwise only seeds when
 * the table is empty, so normal dev restarts don't stomp user tasks.
 */
export function seedDemoTasks(force = false) {
  if (force) {
    db.delete(tasks).run();
  } else {
    const existing = db.select().from(tasks).all();
    if (existing.length > 0) return;
  }

  console.log(force ? "Resetting demo tasks..." : "Seeding demo tasks...");
  for (const task of DEMO_TASKS) {
    db.insert(tasks)
      .values({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        due_date: task.due_date,
      })
      .run();
  }
  console.log(`  -> ${DEMO_TASKS.length} demo tasks written`);
}
