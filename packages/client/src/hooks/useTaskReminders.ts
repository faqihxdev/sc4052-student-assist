import { useEffect, useRef } from "react";
import { fetchTasks } from "../lib/api";
import type { Task } from "@studentassist/shared";

/**
 * Schedules local browser notifications for tasks that have a `reminder_at`
 * in the future. Re-runs whenever a `tasks-updated` window event fires
 * (dispatched by the chat hook after any task tool card arrives) and also on
 * an interval as a safety net.
 *
 * Limitation: notifications only fire while this tab is open. Closed tab =
 * the reminder is dropped. To upgrade to "works when tab is closed" you'd
 * add a service worker + Web Push; the data model stays the same.
 */
export function useTaskReminders() {
  // We track reminders we've already scheduled/fired so repeated fetches
  // don't double-notify. Key = `${taskId}|${reminder_at}` so editing the
  // reminder reschedules, but an unchanged task stays scheduled once.
  const scheduledRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof Notification === "undefined") return;

    // Ask for permission once. Users can deny; we just silently stop then.
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {
        /* noop */
      });
    }

    let cancelled = false;

    async function reschedule() {
      if (cancelled) return;
      let tasks: Task[];
      try {
        tasks = await fetchTasks();
      } catch {
        return;
      }
      if (cancelled) return;

      const now = Date.now();
      const scheduled = scheduledRef.current;

      for (const task of tasks) {
        if (!task.reminder_at) continue;
        if (task.status === "completed") continue;

        const key = `${task.id}|${task.reminder_at}`;
        if (scheduled.has(key)) continue;

        const fireAt = new Date(task.reminder_at).getTime();
        if (Number.isNaN(fireAt)) continue;

        const delay = fireAt - now;

        // Already in the past. Fire immediately if it's within the last
        // 60s (probably the tab was just reopened); otherwise treat as
        // stale and skip — the user already saw the task was overdue.
        if (delay < -60_000) {
          scheduled.set(key, -1);
          continue;
        }

        // Cap at ~24 days to stay within setTimeout's 32-bit ms limit.
        const safeDelay = Math.min(Math.max(delay, 0), 2_147_000_000);

        const timer = window.setTimeout(() => {
          fireNotification(task);
        }, safeDelay);

        scheduled.set(key, timer);
      }

      // Drop bookkeeping for tasks that no longer exist so memory doesn't
      // grow forever across long sessions.
      const liveKeys = new Set(
        tasks
          .filter((t) => t.reminder_at)
          .map((t) => `${t.id}|${t.reminder_at}`)
      );
      for (const key of scheduled.keys()) {
        if (!liveKeys.has(key)) {
          const timer = scheduled.get(key);
          if (timer && timer > 0) window.clearTimeout(timer);
          scheduled.delete(key);
        }
      }
    }

    function fireNotification(task: Task) {
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;

      const body =
        task.description?.trim() ||
        (task.due_date ? `Due ${task.due_date}` : "Task reminder");

      try {
        const n = new Notification(`Reminder: ${task.title}`, {
          body,
          tag: `task-${task.id}`,
          requireInteraction: false,
        });
        // Focus the window when the user clicks the notification.
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        /* some browsers reject Notification() in background tabs; ignore */
      }
    }

    reschedule();

    const handler = () => reschedule();
    window.addEventListener("tasks-updated", handler);

    // Safety net: if the model creates a task via some path we didn't
    // instrument, we still catch it within 30s.
    const interval = window.setInterval(reschedule, 30_000);

    return () => {
      cancelled = true;
      window.removeEventListener("tasks-updated", handler);
      window.clearInterval(interval);
      for (const timer of scheduledRef.current.values()) {
        if (timer > 0) window.clearTimeout(timer);
      }
      scheduledRef.current.clear();
    };
  }, []);
}
