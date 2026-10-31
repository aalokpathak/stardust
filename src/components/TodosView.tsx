import {
  Add20Regular,
  Alert16Regular,
  CalendarLtr16Regular,
  Checkmark12Filled,
  CheckboxChecked24Regular,
  ChevronRight12Regular,
  Clock20Regular,
  Delete20Regular,
  Dismiss16Regular,
  Star20Filled,
  Star20Regular,
} from "@fluentui/react-icons";
import { memo, useMemo, useState } from "react";
import type { Todo } from "../lib/api";
import { addDays, dueLabel, isOverdue, localDate, plural, reminderTime } from "../lib/format";
import { clearCompleted, deleteTodo, saveTodo, useStore } from "../lib/store";
import { Button, EmptyState, IconButton, PageHeader } from "./ui";

type Tab = "today" | "upcoming" | "all" | "completed";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All" },
  { id: "completed", label: "Completed" },
];

const EMPTY_MESSAGES: Record<Tab, { title: string; body: string }> = {
  today: { title: "Nothing due today", body: "Add a task above, or give one a date to see it here." },
  upcoming: { title: "Nothing coming up", body: "Tasks with a future date will line up here." },
  all: { title: "No open tasks", body: "Add your first task above." },
  completed: { title: "Nothing completed yet", body: "Finished tasks are kept here until you clear them." },
};

function newTodo(title: string, due: string | null, time: string | null, parentId: string | null = null): Todo {
  return {
    id: crypto.randomUUID().replaceAll("-", ""),
    parentId,
    title,
    done: false,
    important: false,
    dueDate: due,
    dueTime: time,
    remindAt: reminderTime(due, time),
    createdAt: Date.now(),
    completedAt: null,
  };
}

function setDone(todo: Todo, done: boolean) {
  void saveTodo({ ...todo, done, completedAt: done ? Date.now() : null });
}

function Check({ todo, small }: { todo: Todo; small?: boolean }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={todo.done}
      aria-label={todo.done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
      onClick={(event) => {
        event.stopPropagation();
        setDone(todo, !todo.done);
      }}
      className={`grid shrink-0 place-items-center rounded-full border transition-colors duration-100 ${
        small ? "size-4" : "size-5"
      } ${
        todo.done
          ? "border-accent-fill bg-accent-fill text-on-accent"
          : "border-ink-3 text-transparent hover:border-accent hover:text-accent"
      }`}
    >
      <Checkmark12Filled />
    </button>
  );
}

function TodoDetails({ todo, subtasks }: { todo: Todo; subtasks: Todo[] }) {
  const [draft, setDraft] = useState("");

  const addSubtask = () => {
    const title = draft.trim();
    if (!title) return;
    void saveTodo(newTodo(title, null, null, todo.id));
    setDraft("");
  };

  const setDue = (dueDate: string | null, dueTime: string | null) => {
    void saveTodo({ ...todo, dueDate, dueTime, remindAt: reminderTime(dueDate, dueTime) });
  };

  return (
    <div className="border-t border-line px-3 py-3 pl-11">
      <div className="space-y-0.5">
        {subtasks.map((subtask) => (
          <div key={subtask.id} className="group flex h-8 items-center gap-2.5 rounded pl-0.5 hover:bg-hover">
            <Check todo={subtask} small />
            <input
              aria-label="Checklist item"
              defaultValue={subtask.title}
              onBlur={(event) => {
                const title = event.target.value.trim();
                if (title && title !== subtask.title) void saveTodo({ ...subtask, title });
              }}
              className={`min-w-0 flex-1 bg-transparent outline-none ${subtask.done ? "text-ink-3 line-through" : ""}`}
            />
            <button
              type="button"
              aria-label={`Remove "${subtask.title}"`}
              onClick={() => void deleteTodo(subtask)}
              className="mr-1 hidden size-6 place-items-center rounded text-ink-3 group-hover:grid hover:text-ink"
            >
              <Dismiss16Regular />
            </button>
          </div>
        ))}
        <div className="flex h-8 items-center gap-2.5 pl-0.5 text-ink-3">
          <Add20Regular className="-ml-0.5 shrink-0" />
          <input
            aria-label="Add a checklist item"
            placeholder="Add a checklist item"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={addSubtask}
            onKeyDown={(event) => {
              if (event.key === "Enter") addSubtask();
            }}
            className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="w-40">
          <span className="mb-1 block text-xs text-ink-2">Due date</span>
          <input
            type="date"
            className="field"
            value={todo.dueDate ?? ""}
            onChange={(event) => setDue(event.target.value || null, event.target.value ? todo.dueTime : null)}
          />
        </label>
        <label className="w-32">
          <span className="mb-1 block text-xs text-ink-2">Remind me at</span>
          <input
            type="time"
            className="field"
            value={todo.dueTime ?? ""}
            onChange={(event) => setDue(todo.dueDate ?? localDate(), event.target.value || null)}
          />
        </label>
        <span className="flex-1" />
        <Button variant="ghost" className="text-danger!" onClick={() => void deleteTodo(todo)}>
          <Delete20Regular /> Delete task
        </Button>
      </div>
    </div>
  );
}

const TodoRow = memo(function TodoRow({ todo, subtasks }: { todo: Todo; subtasks: Todo[] }) {
  const [open, setOpen] = useState(false);
  const overdue = isOverdue(todo);
  const finished = subtasks.filter((subtask) => subtask.done).length;
  const due = dueLabel(todo);

  return (
    <div className="rounded-lg border border-line bg-card transition-colors duration-100">
      <div className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-1.5 hover:bg-hover">
        <Check todo={todo} />
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="min-w-0 flex-1 text-left"
        >
          <span className={`block truncate ${todo.done ? "text-ink-3 line-through" : "text-ink"}`}>{todo.title}</span>
          {(due || subtasks.length > 0) && (
            <span className="mt-0.5 flex items-center gap-3 text-xs text-ink-2">
              {due && (
                <span className={`flex items-center gap-1 ${overdue ? "font-semibold text-danger" : ""}`}>
                  {todo.remindAt ? <Alert16Regular /> : <CalendarLtr16Regular />}
                  {overdue ? `Overdue · ${due}` : due}
                </span>
              )}
              {subtasks.length > 0 && (
                <span>
                  {finished} of {subtasks.length} done
                </span>
              )}
            </span>
          )}
        </button>
        <IconButton
          label={todo.important ? "Remove star" : "Mark as important"}
          active={todo.important}
          onClick={() => void saveTodo({ ...todo, important: !todo.important })}
          className={todo.important ? "bg-transparent! text-star! hover:text-star!" : ""}
        >
          {todo.important ? <Star20Filled /> : <Star20Regular />}
        </IconButton>
        <button
          type="button"
          aria-label={open ? "Hide details" : "Show details"}
          onClick={() => setOpen(!open)}
          className="grid size-6 shrink-0 place-items-center rounded text-ink-3 hover:text-ink"
        >
          <ChevronRight12Regular className={`transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
        </button>
      </div>
      {open && <TodoDetails todo={todo} subtasks={subtasks} />}
    </div>
  );
});

function QuickAdd({ tab }: { tab: Tab }) {
  const [title, setTitle] = useState("");
  const [choice, setChoice] = useState<{ date: string | null; time: string | null } | null>(null);

  const today = localDate();
  const tomorrow = localDate(addDays(1));
  // A task added on Today should stay visible on Today.
  const due = choice ?? { date: tab === "today" ? today : tab === "upcoming" ? tomorrow : null, time: null };

  const inAnHour = () => {
    const moment = new Date(Date.now() + 3_600_000);
    const time = `${String(moment.getHours()).padStart(2, "0")}:${String(moment.getMinutes()).padStart(2, "0")}`;
    setChoice({ date: localDate(moment), time });
  };

  const add = () => {
    const text = title.trim();
    if (!text) return;
    void saveTodo(newTodo(text, due.date, due.time));
    setTitle("");
    setChoice(null);
  };

  const chip = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-7 shrink-0 rounded-full border px-3 text-[13px] transition-colors duration-100 ${
        active ? "border-transparent bg-accent-soft font-semibold text-accent" : "border-line text-ink-2 hover:bg-hover"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="rounded-lg border border-line bg-card p-2">
      <div className="flex items-center gap-2">
        <Add20Regular className="ml-1 shrink-0 text-accent" />
        <input
          autoFocus
          aria-label="Add a task"
          placeholder="Add a task, a checklist or a reminder"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
          className="h-8 min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
        />
        <Button variant="primary" disabled={!title.trim()} onClick={add}>
          Add
        </Button>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-8">
        {chip("No date", !due.date, () => setChoice({ date: null, time: null }))}
        {chip("Today", due.date === today && !due.time, () => setChoice({ date: today, time: null }))}
        {chip("Tomorrow", due.date === tomorrow && !due.time, () => setChoice({ date: tomorrow, time: null }))}
        {chip("In 1 hour", !!due.time, inAnHour)}
        <input
          type="date"
          aria-label="Pick a date"
          value={due.date ?? ""}
          onChange={(event) => setChoice({ date: event.target.value || null, time: due.time })}
          className="field h-7! w-[132px]! text-[13px]"
        />
        <span className="flex items-center gap-1">
          <Clock20Regular className="text-ink-3" />
          <input
            type="time"
            aria-label="Pick a reminder time"
            value={due.time ?? ""}
            onChange={(event) => setChoice({ date: due.date ?? today, time: event.target.value || null })}
            className="field h-7! w-[104px]! text-[13px]"
          />
        </span>
      </div>
    </div>
  );
}

function compareOpen(a: Todo, b: Todo) {
  if (a.important !== b.important) return a.important ? -1 : 1;
  const first = `${a.dueDate ?? "9999"}${a.dueTime ?? ""}`;
  const second = `${b.dueDate ?? "9999"}${b.dueTime ?? ""}`;
  return first.localeCompare(second) || a.createdAt - b.createdAt;
}

export function TodosView() {
  const todos = useStore((state) => state.todos);
  const [tab, setTab] = useState<Tab>("today");

  const { visible, counts, subtasksOf } = useMemo(() => {
    const today = localDate();
    const tasks = todos.filter((todo) => !todo.parentId);
    const open = tasks.filter((todo) => !todo.done);
    const lists: Record<Tab, Todo[]> = {
      today: open.filter((todo) => todo.dueDate && todo.dueDate <= today).sort(compareOpen),
      upcoming: open.filter((todo) => todo.dueDate && todo.dueDate > today).sort(compareOpen),
      all: [...open].sort(compareOpen),
      completed: tasks
        .filter((todo) => todo.done)
        .sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
    };
    const children = new Map<string, Todo[]>();
    for (const todo of todos) {
      if (!todo.parentId) continue;
      children.set(todo.parentId, [...(children.get(todo.parentId) ?? []), todo]);
    }
    return { visible: lists[tab], counts: lists, subtasksOf: children };
  }, [todos, tab]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-in mx-auto max-w-[760px] px-8 pt-8 pb-10">
        <PageHeader title="To-Do" subtitle={`${plural(counts.all.length, "open task")} · ${counts.today.length} due today`} />

        <div className="mt-5">
          <QuickAdd tab={tab} />
        </div>

        <div role="tablist" aria-label="Task lists" className="mt-5 flex items-center gap-1 border-b border-line">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative h-9 rounded-t px-3 transition-colors duration-100 hover:bg-hover ${
                tab === id ? "font-semibold text-ink" : "text-ink-2"
              }`}
            >
              {label}
              {counts[id].length > 0 && <span className="ml-1.5 text-xs text-ink-3">{counts[id].length}</span>}
              <span
                className={`absolute right-3 bottom-0 left-3 h-[3px] rounded-full bg-accent transition-transform duration-150 ease-fluent ${
                  tab === id ? "scale-x-100" : "scale-x-0"
                }`}
              />
            </button>
          ))}
          <span className="flex-1" />
          {tab === "completed" && counts.completed.length > 0 && (
            <Button variant="ghost" className="mb-1" onClick={() => void clearCompleted()}>
              Clear completed
            </Button>
          )}
        </div>

        <div className="mt-3 space-y-2">
          {visible.length === 0 ? (
            <EmptyState icon={<CheckboxChecked24Regular />} {...EMPTY_MESSAGES[tab]} />
          ) : (
            visible.map((todo) => <TodoRow key={todo.id} todo={todo} subtasks={subtasksOf.get(todo.id) ?? []} />)
          )}
        </div>
      </div>
    </div>
  );
}
