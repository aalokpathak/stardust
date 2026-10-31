import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ReactNode } from "react";
import { create } from "zustand";
import { api, type Folder, type NoteMeta, type Todo } from "./api";
import { noteTitle, plural } from "./format";
import { textToHtml } from "./text";

export type View =
  | { kind: "home" }
  | { kind: "todos" }
  | { kind: "trash" }
  | { kind: "settings" }
  | { kind: "search" }
  | { kind: "folder"; id: string }
  | { kind: "note"; id: string };

export type ThemeChoice = "system" | "light" | "dark";
export type EditorFont = "sans" | "serif" | "mono";
export type SaveState = "saved" | "saving" | "failed";

export type Settings = {
  displayName: string;
  onboarded: boolean;
  theme: ThemeChoice;
  editorFont: EditorFont;
};

export type Toast = {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; run: () => void };
};

export type MenuItem =
  | "separator"
  | {
      label: string;
      icon?: ReactNode;
      shortcut?: string;
      danger?: boolean;
      checked?: boolean;
      run: () => void;
    };

export type MenuRequest = { x: number; y: number; items: MenuItem[] };

export type DialogRequest =
  | {
      kind: "confirm";
      title: string;
      body: string;
      confirm: string;
      danger?: boolean;
      resolve: (accepted: boolean) => void;
    }
  | { kind: "move"; title: string; exclude?: string; resolve: (target: string | null | undefined) => void };

type State = {
  ready: boolean;
  settings: Settings;
  view: View;
  past: View[];
  folders: Folder[];
  notes: NoteMeta[];
  todos: Todo[];
  expanded: Set<string>;
  sidebarOpen: boolean;
  renamingId: string | null;
  query: string;
  results: NoteMeta[];
  toasts: Toast[];
  saveState: SaveState;
  menu: MenuRequest | null;
  dialog: DialogRequest | null;
};

export const useStore = create<State>(() => ({
  ready: false,
  settings: { displayName: "", onboarded: false, theme: "system", editorFont: "sans" },
  view: { kind: "home" },
  past: [],
  folders: [],
  notes: [],
  todos: [],
  expanded: new Set(),
  sidebarOpen: true,
  renamingId: null,
  query: "",
  results: [],
  toasts: [],
  saveState: "saved",
  menu: null,
  dialog: null,
}));

const set = useStore.setState;
const get = useStore.getState;

let nextToastId = 1;

export function toast(message: string, options: Partial<Pick<Toast, "tone" | "action">> = {}) {
  const id = nextToastId++;
  const tone = options.tone ?? "info";
  set((state) => ({ toasts: [...state.toasts, { id, message, tone, action: options.action }].slice(-3) }));
  setTimeout(() => dismissToast(id), tone === "error" ? 8000 : 5000);
}

export function dismissToast(id: number) {
  set((state) => ({ toasts: state.toasts.filter((item) => item.id !== id) }));
}

export function showError(error: unknown) {
  toast(typeof error === "string" ? error : "Something went wrong. Please try that again.", { tone: "error" });
}

/** Runs a store action, turning any backend failure into a visible error. */
function guarded<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  return async (...args: Args) => {
    try {
      return await action(...args);
    } catch (error) {
      showError(error);
    }
  };
}

export function openMenu(x: number, y: number, items: MenuItem[]) {
  set({ menu: { x, y, items } });
}

export function openMenuBelow(element: HTMLElement, items: MenuItem[]) {
  const box = element.getBoundingClientRect();
  openMenu(box.left, box.bottom + 4, items);
}

export function closeMenu() {
  set({ menu: null });
}

export function confirm(options: { title: string; body: string; confirm: string; danger?: boolean }) {
  return new Promise<boolean>((resolve) => set({ dialog: { kind: "confirm", ...options, resolve } }));
}

/** Resolves to the chosen folder id, null for the root, or undefined if cancelled. */
export function pickFolder(title: string, exclude?: string) {
  return new Promise<string | null | undefined>((resolve) =>
    set({ dialog: { kind: "move", title, exclude, resolve } }),
  );
}

export function closeDialog() {
  set({ dialog: null });
}

export function navigate(view: View) {
  set((state) => {
    const current = state.view;
    if (JSON.stringify(current) === JSON.stringify(view)) return state;
    return { view, past: [...state.past, current].slice(-50) };
  });
}

export function goBack() {
  set((state) => {
    const past = [...state.past];
    const view = past.pop();
    return view ? { view, past } : state;
  });
}

/** The folder "+" targets: the open folder, or the folder of the open note, else the root. */
export function activeFolderId(state: Pick<State, "view" | "notes"> = get()) {
  const { view } = state;
  if (view.kind === "folder") return view.id;
  if (view.kind === "note") return state.notes.find((note) => note.id === view.id)?.folderId ?? null;
  return null;
}

export function folderPath(folderId: string | null, folders = get().folders) {
  const path: Folder[] = [];
  let id = folderId;
  while (id) {
    const folder = folders.find((item) => item.id === id);
    if (!folder) break;
    path.unshift(folder);
    id = folder.parentId;
  }
  return path;
}

function persistExpanded(expanded: Set<string>) {
  void api.setSetting("expanded", JSON.stringify([...expanded])).catch(() => undefined);
}

function expandTo(folderId: string | null) {
  const expanded = new Set(get().expanded);
  for (const folder of folderPath(folderId)) expanded.add(folder.id);
  set({ expanded });
  persistExpanded(expanded);
}

export function toggleExpanded(id: string) {
  const expanded = new Set(get().expanded);
  if (!expanded.delete(id)) expanded.add(id);
  set({ expanded });
  persistExpanded(expanded);
}

export function openFolder(id: string) {
  expandTo(id);
  navigate({ kind: "folder", id });
}

export function openNote(id: string) {
  const note = get().notes.find((item) => item.id === id);
  if (note) expandTo(note.folderId);
  navigate({ kind: "note", id });
}

async function refreshLibrary() {
  const { folders, notes } = await api.getLibrary();
  set({ folders, notes });
}

export const createNote = guarded(async (folderId: string | null = activeFolderId()) => {
  const note = await api.createNote(folderId, "", "", "");
  set((state) => ({ notes: [note, ...state.notes] }));
  openNote(note.id);
});

export const captureText = guarded(async (text: string) => {
  const content = text.replace(/\s+$/, "");
  if (!content) return;
  const note = await api.createNote(null, "", textToHtml(content), content);
  set((state) => ({ notes: [note, ...state.notes] }));
  toast("Saved as a new note", { action: { label: "Open", run: () => openNote(note.id) } });
});

export const createFolder = guarded(async (parentId: string | null = activeFolderId()) => {
  const folder = await api.createFolder("New folder", parentId);
  set((state) => ({ folders: [...state.folders, folder], renamingId: folder.id }));
  expandTo(parentId);
});

export function startRename(id: string) {
  set({ renamingId: id });
}

export function stopRename() {
  set({ renamingId: null });
}

export const renameFolder = guarded(async (id: string, name: string) => {
  await api.renameFolder(id, name);
  set((state) => ({
    folders: state.folders.map((folder) => (folder.id === id ? { ...folder, name } : folder)),
  }));
});

export const moveFolder = guarded(async (id: string, parentId: string | null) => {
  await api.moveFolder(id, parentId);
  set((state) => ({
    folders: state.folders.map((folder) => (folder.id === id ? { ...folder, parentId } : folder)),
  }));
  expandTo(parentId);
});

export const moveNote = guarded(async (id: string, folderId: string | null) => {
  await api.moveNote(id, folderId);
  set((state) => ({
    notes: state.notes.map((note) => (note.id === id ? { ...note, folderId } : note)),
  }));
  expandTo(folderId);
});

export function descendantIds(id: string, folders = get().folders) {
  const found = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const folder of folders) {
      if (folder.parentId && found.has(folder.parentId) && !found.has(folder.id)) {
        found.add(folder.id);
        grew = true;
      }
    }
  }
  return found;
}

export const deleteFolder = guarded(async (folder: Folder) => {
  const subtree = descendantIds(folder.id);
  const noteCount = get().notes.filter(
    (note) => !note.deletedAt && note.folderId && subtree.has(note.folderId),
  ).length;
  const accepted = await confirm({
    title: `Delete "${folder.name}"?`,
    body:
      noteCount > 0
        ? `The folder and its subfolders will be removed. ${plural(noteCount, "note")} will move to the Trash.`
        : "The folder and any subfolders will be removed.",
    confirm: "Delete folder",
    danger: true,
  });
  if (!accepted) return;

  await api.deleteFolder(folder.id);
  await refreshLibrary();
  const { view } = get();
  if (view.kind === "folder" && subtree.has(view.id)) leaveTo({ kind: "home" });
  if (view.kind === "note" && get().notes.find((note) => note.id === view.id)?.deletedAt) {
    leaveTo({ kind: "home" });
  }
});

/** Swaps the current view for one that no longer points at something deleted. */
function leaveTo(view: View) {
  set({ view, past: [] });
}

export const restoreNote = guarded(async (id: string) => {
  await api.restoreNote(id);
  await refreshLibrary();
});

export const trashNote = guarded(async (id: string) => {
  await api.trashNote(id);
  const note = get().notes.find((item) => item.id === id);
  set((state) => ({
    notes: state.notes.map((item) => (item.id === id ? { ...item, deletedAt: Date.now() } : item)),
  }));
  const { view } = get();
  if (view.kind === "note" && view.id === id) {
    leaveTo(note?.folderId ? { kind: "folder", id: note.folderId } : { kind: "home" });
  }
  toast(`Moved "${note ? noteTitle(note) : "note"}" to the Trash`, {
    action: { label: "Undo", run: () => void restoreNote(id) },
  });
});

export const deleteNoteForever = guarded(async (id: string) => {
  const accepted = await confirm({
    title: "Delete this note forever?",
    body: "This can't be undone.",
    confirm: "Delete forever",
    danger: true,
  });
  if (!accepted) return;
  await api.deleteNoteForever(id);
  set((state) => ({ notes: state.notes.filter((note) => note.id !== id) }));
});

export const emptyTrash = guarded(async () => {
  const count = get().notes.filter((note) => note.deletedAt).length;
  const accepted = await confirm({
    title: "Empty the Trash?",
    body: `${plural(count, "note")} will be deleted forever. This can't be undone.`,
    confirm: "Empty Trash",
    danger: true,
  });
  if (!accepted) return;
  await api.emptyTrash();
  set((state) => ({ notes: state.notes.filter((note) => !note.deletedAt) }));
});

export function applyNoteMeta(meta: NoteMeta) {
  set((state) => ({ notes: state.notes.map((note) => (note.id === meta.id ? meta : note)) }));
}

export function setSaveState(saveState: SaveState) {
  if (get().saveState !== saveState) set({ saveState });
}

export function setSearch(query: string) {
  set({ query });
  if (query.trim()) navigate({ kind: "search" });
  else {
    set({ results: [] });
    if (get().view.kind === "search") goBack();
  }
}

export function setResults(results: NoteMeta[]) {
  set({ results });
}

export const saveTodo = guarded(async (todo: Todo) => {
  set((state) => ({
    todos: state.todos.some((item) => item.id === todo.id)
      ? state.todos.map((item) => (item.id === todo.id ? todo : item))
      : [...state.todos, todo],
  }));
  await api.saveTodo(todo);
});

export const deleteTodo = guarded(async (todo: Todo) => {
  const removed = get().todos.filter((item) => item.id === todo.id || item.parentId === todo.id);
  set((state) => ({ todos: state.todos.filter((item) => !removed.includes(item)) }));
  await api.deleteTodo(todo.id);
  toast("Task deleted", {
    action: {
      label: "Undo",
      run: () => {
        for (const item of removed) void saveTodo(item);
      },
    },
  });
});

export const clearCompleted = guarded(async () => {
  await api.clearCompleted();
  set((state) => {
    const cleared = new Set(state.todos.filter((todo) => todo.done && !todo.parentId).map((todo) => todo.id));
    return {
      todos: state.todos.filter(
        (todo) => !cleared.has(todo.id) && !(todo.parentId && cleared.has(todo.parentId)),
      ),
    };
  });
});

function resolvedTheme(theme: ThemeChoice) {
  if (theme !== "system") return theme;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: ThemeChoice, animate = false) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-transition");
    setTimeout(() => root.classList.remove("theme-transition"), 280);
  }
  root.dataset.theme = resolvedTheme(theme);
  void getCurrentWindow()
    .setTheme(theme === "system" ? null : theme)
    .catch(() => undefined);
}

export function currentTheme() {
  return resolvedTheme(get().settings.theme);
}

export const updateSettings = guarded(async (patch: Partial<Settings>) => {
  set((state) => ({ settings: { ...state.settings, ...patch } }));
  if (patch.theme) applyTheme(patch.theme, true);
  await Promise.all(
    Object.entries(patch).map(([key, value]) => api.setSetting(key, String(value))),
  );
});

export function toggleSidebar() {
  set((state) => ({ sidebarOpen: !state.sidebarOpen }));
}

export async function loadApp() {
  const { library, todos, settings } = await api.bootstrap();
  let expanded = new Set<string>();
  try {
    expanded = new Set(JSON.parse(settings.expanded ?? "[]"));
  } catch {
    // A damaged value only costs the remembered tree state.
  }
  const loaded: Settings = {
    displayName: settings.displayName ?? "",
    onboarded: settings.onboarded === "true",
    theme: (settings.theme as ThemeChoice) ?? "system",
    editorFont: (settings.editorFont as EditorFont) ?? "sans",
  };
  applyTheme(loaded.theme);
  set({ ...library, todos, expanded, settings: loaded, ready: true });
}
