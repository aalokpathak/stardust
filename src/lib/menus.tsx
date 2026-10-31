import {
  Add20Regular,
  Delete20Regular,
  Document20Regular,
  DocumentPdf20Regular,
  DocumentText20Regular,
  FolderAdd20Regular,
  FolderArrowRight20Regular,
  Rename20Regular,
} from "@fluentui/react-icons";
import type { Folder, NoteMeta } from "./api";
import { exportNote } from "./export";
import {
  createFolder,
  createNote,
  deleteFolder,
  moveFolder,
  moveNote,
  pickFolder,
  startRename,
  trashNote,
  type MenuItem,
} from "./store";

export function exportItems(id: string): MenuItem[] {
  return [
    { label: "Export as PDF", icon: <DocumentPdf20Regular />, run: () => void exportNote(id, "pdf") },
    { label: "Export as Markdown", icon: <DocumentText20Regular />, run: () => void exportNote(id, "md") },
    { label: "Export as text", icon: <Document20Regular />, run: () => void exportNote(id, "txt") },
  ];
}

export function moveNoteToFolder(note: NoteMeta) {
  void pickFolder("Move note to").then((target) => {
    if (target !== undefined) void moveNote(note.id, target);
  });
}

export function noteMenu(note: NoteMeta): MenuItem[] {
  return [
    { label: "Move to...", icon: <FolderArrowRight20Regular />, run: () => moveNoteToFolder(note) },
    "separator",
    ...exportItems(note.id),
    "separator",
    { label: "Move to Trash", icon: <Delete20Regular />, danger: true, run: () => void trashNote(note.id) },
  ];
}

export function folderMenu(folder: Folder): MenuItem[] {
  return [
    { label: "New note", icon: <Add20Regular />, run: () => void createNote(folder.id) },
    { label: "New subfolder", icon: <FolderAdd20Regular />, run: () => void createFolder(folder.id) },
    "separator",
    { label: "Rename", icon: <Rename20Regular />, shortcut: "F2", run: () => startRename(folder.id) },
    {
      label: "Move to...",
      icon: <FolderArrowRight20Regular />,
      run: () => {
        void pickFolder("Move folder to", folder.id).then((target) => {
          if (target !== undefined) void moveFolder(folder.id, target);
        });
      },
    },
    "separator",
    { label: "Delete", icon: <Delete20Regular />, danger: true, run: () => void deleteFolder(folder) },
  ];
}
