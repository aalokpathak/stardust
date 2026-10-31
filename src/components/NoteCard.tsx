import { DocumentText20Regular } from "@fluentui/react-icons";
import type { MouseEvent } from "react";
import type { NoteMeta } from "../lib/api";
import { noteTitle, relativeTime } from "../lib/format";
import { noteMenu } from "../lib/menus";
import { folderPath, openMenu, openNote } from "../lib/store";

export function NoteCard({ note }: { note: NoteMeta }) {
  const title = noteTitle(note);
  const location = folderPath(note.folderId).at(-1)?.name;
  // The title borrows the snippet when there is none, so don't print those words twice.
  const preview = note.title.trim() ? note.snippet : note.snippet.slice(title.length).trim();

  const onContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    openMenu(event.clientX, event.clientY, noteMenu(note));
  };

  return (
    <button
      type="button"
      onClick={() => openNote(note.id)}
      onContextMenu={onContextMenu}
      className="flex h-[108px] min-w-0 flex-col rounded-lg border border-line bg-card p-3 text-left transition-colors duration-100 hover:bg-hover active:bg-press"
    >
      <span className="flex w-full items-center gap-2">
        <DocumentText20Regular className="shrink-0 text-accent" />
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</span>
      </span>
      <span className="mt-1 line-clamp-2 text-[13px] leading-[18px] text-ink-2">
        {preview || "No additional text"}
      </span>
      <span className="mt-auto truncate text-xs text-ink-3">
        {location ? `${location} · ` : ""}
        {relativeTime(note.updatedAt)}
      </span>
    </button>
  );
}
