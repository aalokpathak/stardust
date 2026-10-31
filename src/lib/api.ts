import { invoke } from "@tauri-apps/api/core";

export type Folder = {
  id: string;
  parentId: string | null;
  name: string;
  createdAt: number;
};

export type NoteMeta = {
  id: string;
  folderId: string | null;
  title: string;
  snippet: string;
  words: number;
  chars: number;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

export type Note = NoteMeta & { content: string };

export type Todo = {
  id: string;
  parentId: string | null;
  title: string;
  done: boolean;
  important: boolean;
  dueDate: string | null;
  dueTime: string | null;
  remindAt: number | null;
  createdAt: number;
  completedAt: number | null;
};

export type Library = { folders: Folder[]; notes: NoteMeta[] };

export type Boot = {
  library: Library;
  todos: Todo[];
  settings: Record<string, string>;
};

export type SystemInfo = {
  version: string;
  dataDir: string;
  libraryBytes: number;
  portable: boolean;
};

export type NoteEdit = { title?: string; content?: string; body?: string };

export const api = {
  bootstrap: () => invoke<Boot>("bootstrap"),
  systemInfo: () => invoke<SystemInfo>("system_info"),
  getLibrary: () => invoke<Library>("get_library"),

  createFolder: (name: string, parentId: string | null) =>
    invoke<Folder>("create_folder", { name, parentId }),
  renameFolder: (id: string, name: string) => invoke<void>("rename_folder", { id, name }),
  moveFolder: (id: string, parentId: string | null) => invoke<void>("move_folder", { id, parentId }),
  deleteFolder: (id: string) => invoke<void>("delete_folder", { id }),

  createNote: (folderId: string | null, title: string, content: string, body: string) =>
    invoke<NoteMeta>("create_note", { folderId, title, content, body }),
  getNote: (id: string) => invoke<Note>("get_note", { id }),
  saveNote: (id: string, edit: NoteEdit) => invoke<NoteMeta>("save_note", { id, edit }),
  moveNote: (id: string, folderId: string | null) => invoke<void>("move_note", { id, folderId }),
  trashNote: (id: string) => invoke<void>("trash_note", { id }),
  restoreNote: (id: string) => invoke<void>("restore_note", { id }),
  deleteNoteForever: (id: string) => invoke<void>("delete_note_forever", { id }),
  emptyTrash: () => invoke<void>("empty_trash"),
  searchNotes: (query: string) => invoke<NoteMeta[]>("search_notes", { query }),

  saveTodo: (todo: Todo) => invoke<void>("save_todo", { todo }),
  deleteTodo: (id: string) => invoke<void>("delete_todo", { id }),
  clearCompleted: () => invoke<void>("clear_completed"),

  setSetting: (key: string, value: string) => invoke<void>("set_setting", { key, value }),

  exportText: (title: string, extension: "txt" | "md", contents: string) =>
    invoke<string | null>("export_text", { title, extension, contents }),
  exportPdf: (title: string) => invoke<string | null>("export_pdf", { title }),
};
