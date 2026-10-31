import { Add20Regular, DocumentText24Regular, Folder20Regular, FolderAdd20Regular } from "@fluentui/react-icons";
import { useMemo } from "react";
import { plural } from "../lib/format";
import { folderMenu } from "../lib/menus";
import { createFolder, createNote, folderPath, openFolder, openMenu, useStore } from "../lib/store";
import { NoteCard } from "./NoteCard";
import { Button, EmptyState, PageHeader, SectionTitle } from "./ui";

export function FolderView({ id }: { id: string }) {
  const folders = useStore((state) => state.folders);
  const allNotes = useStore((state) => state.notes);
  const folder = folders.find((item) => item.id === id);

  const subfolders = useMemo(
    () => folders.filter((item) => item.parentId === id).sort((a, b) => a.name.localeCompare(b.name)),
    [folders, id],
  );
  const notes = useMemo(
    () =>
      allNotes
        .filter((note) => note.folderId === id && !note.deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [allNotes, id],
  );

  if (!folder) return null;

  const parents = folderPath(folder.parentId, folders);
  const summary = [plural(notes.length, "note"), subfolders.length ? plural(subfolders.length, "subfolder") : ""]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-in mx-auto max-w-[980px] px-8 pt-8 pb-10">
        <PageHeader
          eyebrow={parents.length ? parents.map((item) => item.name).join(" / ") : "Library"}
          title={folder.name}
          subtitle={summary}
          actions={
            <>
              <Button onClick={() => void createFolder(id)}>
                <FolderAdd20Regular /> New subfolder
              </Button>
              <Button variant="primary" onClick={() => void createNote(id)}>
                <Add20Regular /> New note
              </Button>
            </>
          }
        />

        {subfolders.length > 0 && (
          <section className="mt-6">
            <SectionTitle>Folders</SectionTitle>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {subfolders.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => openFolder(child.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openMenu(event.clientX, event.clientY, folderMenu(child));
                  }}
                  className="flex h-12 min-w-0 items-center gap-2.5 rounded-lg border border-line bg-card px-3 text-left transition-colors duration-100 hover:bg-hover active:bg-press"
                >
                  <Folder20Regular className="shrink-0 text-accent" />
                  <span className="truncate font-semibold">{child.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="mt-6">
          <SectionTitle>Notes</SectionTitle>
          {notes.length === 0 ? (
            <EmptyState
              icon={<DocumentText24Regular />}
              title="This folder is empty"
              body={`New notes you create here land in ${folder.name} automatically.`}
              action={
                <Button variant="primary" onClick={() => void createNote(id)}>
                  <Add20Regular /> New note
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
