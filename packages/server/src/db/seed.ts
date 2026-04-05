import { db } from "./index";
import { tasks } from "./schema";

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const DEMO_TASKS = [
  {
    title: "Submit Cloud Computing final report",
    description: "CZ4052 — 15-page report covering architecture, implementation, and security analysis",
    status: "pending" as const,
    priority: "high" as const,
    due_date: daysFromNow(5),
  },
  {
    title: "Review PR #12 — Frontend chat UI",
    description: "Review the streaming chat interface pull request on cloud-computing-project",
    status: "in_progress" as const,
    priority: "medium" as const,
    due_date: daysFromNow(1),
  },
  {
    title: "Prepare SC3000 AI presentation slides",
    description: "Group presentation on reinforcement learning project — 15 min slot",
    status: "pending" as const,
    priority: "high" as const,
    due_date: daysFromNow(3),
  },
  {
    title: "Fix weather card night mode icons",
    description: "GitHub issue #7 — weather card shows sun icon at night",
    status: "pending" as const,
    priority: "low" as const,
    due_date: daysFromNow(7),
  },
  {
    title: "Read Chapter 12: Container Orchestration",
    description: "CZ4052 textbook — Kubernetes and Docker Swarm comparison",
    status: "completed" as const,
    priority: "medium" as const,
    due_date: daysFromNow(-1),
  },
  {
    title: "TA grading — CZ2005 Assignment 3",
    description: "Grade 45 student submissions for Operating Systems assignment",
    status: "pending" as const,
    priority: "medium" as const,
    due_date: daysFromNow(2),
  },
  {
    title: "Set up CI/CD with GitHub Actions",
    description: "Add automated testing and Docker build to cloud-computing-project",
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

export function seedDemoTasks() {
  const existing = db.select().from(tasks).all();
  if (existing.length > 0) {
    return;
  }

  console.log("Seeding demo tasks...");
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
  console.log(`Seeded ${DEMO_TASKS.length} demo tasks`);
}
