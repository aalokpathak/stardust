import { ArrowCounterclockwise20Regular, Delete20Regular, Delete24Regular } from "@fluentui/react-icons";
import { useMemo } from "react";
import { noteTitle, plural, relativeTime } from "../lib/format";
import { deleteNoteForever, emptyTrash, restoreNote, useStore } from "../lib/store";
import { Button, EmptyState, IconButton, PageHeader } from "./ui";

export function TrashView() {
  const notes = useStore((state) => state.notes);
  const trashed = useMemo(
    () => notes.filter((note) => note.deletedAt).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0)),
    [notes],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-in mx-auto max-w-[760px] px-8 pt-8 pb-10">
        <PageHeader
          title="Trash"
          subtitle={trashed.length ? plural(trashed.length, "note") : "Deleted notes stay here until you remove them"}
          actions={
            trashed.length > 0 && (
              <Button onClick={() => void emptyTrash()}>
                <Delete20Regular /> Empty Trash
              </Button>
            )
          }
        />

        <div className="mt-6 space-y-2">
          {trashed.length === 0 ? (
            <EmptyState icon={<Delete24Regular />} title="The Trash is empty" body="Nothing here to worry about." />
          ) : (
            trashed.map((note) => (
              <div key={note.id} className="flex items-center gap-3 rounded-lg border border-line bg-card px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-ink">{noteTitle(note)}</div>
                  <div className="truncate text-xs text-ink-3">Deleted {relativeTime(note.deletedAt ?? 0).toLowerCase()}</div>
                </div>
                <IconButton label="Restore" onClick={() => void restoreNote(note.id)}>
                  <ArrowCounterclockwise20Regular />
                </IconButton>
                <IconButton label="Delete forever" onClick={() => void deleteNoteForever(note.id)}>
                  <Delete20Regular />
                </IconButton>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
