import {
  Add20Regular,
  CheckboxChecked24Regular,
  DocumentText24Regular,
  Folder24Regular,
  Sparkle20Filled,
  TextWordCount24Regular,
} from "@fluentui/react-icons";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type SystemInfo } from "../lib/api";
import { dueLabel, formatBytes, formatCount, greeting, isOverdue, localDate, longDate, plural, relativeTime } from "../lib/format";
import { captureText, createNote, navigate, saveTodo, showError, useStore } from "../lib/store";
import { NoteCard } from "./NoteCard";
import { Button, EmptyState, SectionTitle } from "./ui";

const RECENT_LIMIT = 6;
const CLOCK_TICK = 30_000;

/** Keeps the date and greeting right when the app stays open past a boundary. */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_TICK);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function scheduleSummary(dueToday: number, overdue: number) {
  const parts: string[] = [];
  if (overdue > 0) parts.push(`${overdue} overdue`);
  if (dueToday > 0) parts.push(`${plural(dueToday, "task")} today`);
  return parts.length ? parts.join(" · ") : "Nothing scheduled today";
}

function Stat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-card p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent-soft text-accent">{icon}</span>
      <div className="min-w-0">
        <div className="truncate font-display text-[22px] leading-7 font-semibold tabular-nums text-ink">{value}</div>
        <div className="truncate text-xs text-ink-2">{label}</div>
      </div>
    </div>
  );
}

function QuickCapture() {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    void captureText(text);
    setText("");
  };

  return (
    <div className="flex items-start gap-2 rounded-lg border border-line bg-card p-2 transition-colors duration-100 focus-within:border-b-accent">
      <Sparkle20Filled className="mt-1.5 ml-1 shrink-0 text-accent" />
      <textarea
        aria-label="Quick capture"
        rows={1}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Catch a thought or paste a snippet, then press Enter"
        className="max-h-40 min-w-0 flex-1 resize-none bg-transparent py-1 text-ink outline-none [field-sizing:content] placeholder:text-ink-3"
      />
      <Button variant="secondary" disabled={!text.trim()} onClick={submit}>
        Save
      </Button>
    </div>
  );
}

function TodayList() {
  const todos = useStore((state) => state.todos);
  const items = useMemo(() => {
    const today = localDate();
    return todos
      .filter((todo) => !todo.done && !todo.parentId && todo.dueDate && todo.dueDate <= today)
      .sort((a, b) => `${a.dueDate}${a.dueTime}`.localeCompare(`${b.dueDate}${b.dueTime}`))
      .slice(0, 5);
  }, [todos]);

  return (
    <section>
      <SectionTitle>Today</SectionTitle>
      <div className="rounded-lg border border-line bg-card p-1.5">
        {items.length === 0 ? (
          <p className="px-2 py-2 text-[13px] text-ink-2">No tasks due. Enjoy the quiet.</p>
        ) : (
          items.map((todo) => (
            <label key={todo.id} className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-hover">
              <input
                type="checkbox"
                checked={todo.done}
                onChange={() => void saveTodo({ ...todo, done: true, completedAt: Date.now() })}
                className="size-4 shrink-0 accent-accent-fill"
              />
              <span className="min-w-0 flex-1 truncate">{todo.title}</span>
              <span className={`shrink-0 text-xs ${isOverdue(todo) ? "text-danger" : "text-ink-3"}`}>
                {dueLabel(todo)}
              </span>
            </label>
          ))
        )}
        <button
          type="button"
          onClick={() => navigate({ kind: "todos" })}
          className="mt-0.5 w-full rounded px-2 py-1 text-left text-[13px] text-accent hover:bg-hover"
        >
          Open To-Do
        </button>
      </div>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]">
      <dt className="shrink-0 text-ink-2">{label}</dt>
      <dd className="min-w-0 truncate text-right text-ink">{children}</dd>
    </div>
  );
}

function SystemOverview() {
  const lastSaved = useStore((state) => {
    const { notes } = state;
    return notes.reduce((latest, note) => Math.max(latest, note.updatedAt), 0);
  });
  const trashed = useStore((state) => state.notes.filter((note) => note.deletedAt).length);
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    void api.systemInfo().then(setInfo).catch(showError);
  }, [lastSaved]);

  return (
    <section>
      <SectionTitle>System overview</SectionTitle>
      <dl className="divide-y divide-line rounded-lg border border-line bg-card px-3 py-1">
        <Fact label="Library size">{info ? formatBytes(info.libraryBytes) : "-"}</Fact>
        <Fact label="Last saved">{lastSaved ? relativeTime(lastSaved) : "Nothing yet"}</Fact>
        <Fact label="In Trash">{plural(trashed, "note")}</Fact>
        <Fact label="Edition">{info ? `${info.portable ? "Portable" : "Installed"} ${info.version}` : "-"}</Fact>
        <Fact label="Stored in">
          {info && (
            <button
              type="button"
              title={info.dataDir}
              onClick={() => void openPath(info.dataDir).catch(showError)}
              className="max-w-full truncate text-accent hover:underline"
            >
              Open folder
            </button>
          )}
        </Fact>
      </dl>
    </section>
  );
}

export function Dashboard() {
  const name = useStore((state) => state.settings.displayName);
  const notes = useStore((state) => state.notes);
  const folderCount = useStore((state) => state.folders.length);
  const todos = useStore((state) => state.todos);
  const now = useClock();

  const live = useMemo(() => notes.filter((note) => !note.deletedAt), [notes]);
  const recent = useMemo(
    () => [...live].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, RECENT_LIMIT),
    [live],
  );
  const words = useMemo(() => live.reduce((total, note) => total + note.words, 0), [live]);

  const today = localDate(now);
  const open = todos.filter((todo) => !todo.done && !todo.parentId);
  const dueToday = open.filter((todo) => todo.dueDate === today).length;
  const overdue = open.filter((todo) => todo.dueDate && todo.dueDate < today).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-in mx-auto max-w-[980px] px-8 pt-8 pb-10">
        <header>
          <div className="text-[13px] font-semibold text-ink-3">{longDate(now)}</div>
          <h1 className="mt-1 font-display text-[32px] leading-10 font-bold tracking-[-0.025em] text-ink">
            {greeting(now.getHours())}
            {name ? `, ${name}` : ""}
          </h1>
          <p className="mt-1 text-[15px] text-ink-2">{scheduleSummary(dueToday, overdue)}</p>
        </header>

        <div className="mt-6">
          <QuickCapture />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={<DocumentText24Regular />} value={formatCount(live.length)} label="Notes" />
          <Stat icon={<Folder24Regular />} value={formatCount(folderCount)} label="Folders" />
          <Stat icon={<TextWordCount24Regular />} value={formatCount(words)} label="Words written" />
          <Stat icon={<CheckboxChecked24Regular />} value={formatCount(open.length)} label="Open tasks" />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0">
            <SectionTitle>Recent notes</SectionTitle>
            {recent.length === 0 ? (
              <EmptyState
                icon={<DocumentText24Regular />}
                title="No notes yet"
                body="Press Ctrl+N, or paste anything on this page and it becomes a note."
                action={
                  <Button variant="primary" onClick={() => void createNote(null)}>
                    <Add20Regular /> New note
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {recent.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            )}
          </section>

          <div className="space-y-5">
            <TodayList />
            <SystemOverview />
          </div>
        </div>
      </div>
    </div>
  );
}
