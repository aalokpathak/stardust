import type { NoteMeta, Todo } from "./api";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export function localDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(days: number, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date;
}

/** "Saturday, 31 October" */
export function longDate(date = new Date()) {
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  const dayMonth = date.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  return `${weekday}, ${dayMonth}`;
}

export function greeting(hour = new Date().getHours()) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export function relativeTime(timestamp: number, now = Date.now()) {
  const elapsed = now - timestamp;
  if (elapsed < MINUTE) return "Just now";
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m ago`;

  const date = new Date(timestamp);
  if (localDate(date) === localDate(new Date(now))) return `${Math.floor(elapsed / HOUR)}h ago`;
  if (localDate(date) === localDate(addDays(-1, new Date(now)))) return "Yesterday";

  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  });
}

export function formatCount(value: number) {
  return value.toLocaleString("en-US");
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function plural(count: number, noun: string) {
  return `${formatCount(count)} ${noun}${count === 1 ? "" : "s"}`;
}

/** A note with no title borrows its opening words, the way Notepad's tabs do. */
export function noteTitle(note: Pick<NoteMeta, "title" | "snippet">) {
  const title = note.title.trim();
  if (title) return title;
  const opening = note.snippet.trim().slice(0, 60);
  return opening || "Untitled";
}

/** Reads a stored "YYYY-MM-DD" as local midnight rather than UTC. */
function parseDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dueLabel(todo: Pick<Todo, "dueDate" | "dueTime">) {
  if (!todo.dueDate) return "";
  const today = localDate();
  let label: string;
  if (todo.dueDate === today) label = "Today";
  else if (todo.dueDate === localDate(addDays(1))) label = "Tomorrow";
  else if (todo.dueDate === localDate(addDays(-1))) label = "Yesterday";
  else {
    label = parseDate(todo.dueDate).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
  return todo.dueTime ? `${label}, ${todo.dueTime}` : label;
}

export function isOverdue(todo: Todo) {
  if (todo.done || !todo.dueDate) return false;
  const today = localDate();
  if (todo.dueDate < today) return true;
  return todo.remindAt !== null && todo.remindAt < Date.now();
}

export function reminderTime(date: string | null, time: string | null) {
  if (!date || !time) return null;
  const [hours, minutes] = time.split(":").map(Number);
  const moment = parseDate(date);
  moment.setHours(hours, minutes, 0, 0);
  return moment.getTime();
}
