import {
  Add20Regular,
  CheckboxChecked20Filled,
  CheckboxChecked20Regular,
  ChevronRight12Regular,
  Delete20Filled,
  Delete20Regular,
  DocumentText20Regular,
  Folder20Regular,
  FolderAdd20Regular,
  FolderOpen20Regular,
  Home20Filled,
  Home20Regular,
  Search16Regular,
  Settings20Filled,
  Settings20Regular,
} from "@fluentui/react-icons";
import { memo, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import type { Folder, NoteMeta } from "../lib/api";
import { localDate, noteTitle } from "../lib/format";
import { folderMenu, noteMenu } from "../lib/menus";
import {
  activeFolderId,
  createFolder,
  createNote,
  deleteFolder,
  descendantIds,
  moveFolder,
  moveNote,
  navigate,
  openFolder,
  openMenu,
  openNote,
  renameFolder,
  setSearch,
  startRename,
  stopRename,
  toggleExpanded,
  trashNote,
  useStore,
  type View,
} from "../lib/store";
import { IconButton } from "./ui";

type Dragged = { kind: "note" | "folder"; id: string };

// A drag can only carry its payload to `drop`, but `dragover` has to decide validity too.
let dragged: Dragged | null = null;

function canDropInto(folderId: string | null) {
  if (!dragged) return false;
  if (dragged.kind === "note") return true;
  return folderId === null || !descendantIds(dragged.id).has(folderId);
}

function dropInto(folderId: string | null) {
  if (!dragged) return;
  if (dragged.kind === "note") void moveNote(dragged.id, folderId);
  else void moveFolder(dragged.id, folderId);
  dragged = null;
}

function NavItem({
  label,
  icon,
  activeIcon,
  active,
  badge,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  activeIcon: ReactNode;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`relative flex h-9 w-full items-center gap-3 rounded px-3 text-left transition-colors duration-100 hover:bg-hover active:bg-press ${
        active ? "bg-hover font-semibold" : ""
      }`}
    >
      <SelectionPill visible={active} />
      <span className={active ? "text-accent" : "text-ink-2"}>{active ? activeIcon : icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {!!badge && (
        <span
          aria-label={`${badge} due`}
          className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent-fill px-1 text-[11px] leading-none font-semibold text-on-accent"
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function SelectionPill({ visible }: { visible: boolean }) {
  return (
    <span
      className={`absolute top-1/2 left-0 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent transition-transform duration-150 ease-fluent ${
        visible ? "scale-y-100" : "scale-y-0"
      }`}
    />
  );
}

function RenameInput({ folder }: { folder: Folder }) {
  const [name, setName] = useState(folder.name);
  const finished = useRef(false);

  const finish = (save: boolean) => {
    if (finished.current) return;
    finished.current = true;
    stopRename();
    const trimmed = name.trim();
    if (save && trimmed && trimmed !== folder.name) void renameFolder(folder.id, trimmed);
  };

  return (
    <input
      autoFocus
      aria-label="Folder name"
      value={name}
      maxLength={120}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => finish(true)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") finish(true);
        if (event.key === "Escape") finish(false);
      }}
      className="field h-6! min-w-0 flex-1 px-1.5!"
    />
  );
}

function useDropTarget(folderId: string | null) {
  const [over, setOver] = useState(false);
  return {
    over,
    handlers: {
      onDragOver: (event: DragEvent) => {
        if (!canDropInto(folderId)) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        dropInto(folderId);
      },
    },
  };
}

function startDrag(event: DragEvent, item: Dragged) {
  dragged = item;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", "");
}

const FolderRow = memo(function FolderRow({ folder, depth, count }: { folder: Folder; depth: number; count: number }) {
  const selected = useStore((state) => state.view.kind === "folder" && state.view.id === folder.id);
  const expanded = useStore((state) => state.expanded.has(folder.id));
  const renaming = useStore((state) => state.renamingId === folder.id);
  const { over, handlers } = useDropTarget(folder.id);

  return (
    <div
      {...handlers}
      role="treeitem"
      aria-expanded={expanded}
      aria-selected={selected}
      aria-level={depth + 1}
      tabIndex={0}
      data-tree-row
      draggable={!renaming}
      onDragStart={(event) => startDrag(event, { kind: "folder", id: folder.id })}
      onClick={() => openFolder(folder.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu(event.clientX, event.clientY, folderMenu(folder));
      }}
      onKeyDown={(event) => {
        if (renaming) return;
        if (event.key === "Enter") openFolder(folder.id);
        if (event.key === "F2") startRename(folder.id);
        if (event.key === "Delete") void deleteFolder(folder);
        if (event.key === "ArrowRight" && !expanded) toggleExpanded(folder.id);
        if (event.key === "ArrowLeft" && expanded) toggleExpanded(folder.id);
      }}
      style={{ paddingLeft: 4 + depth * 16 }}
      className={`group relative flex h-[30px] items-center gap-1 rounded pr-1 transition-colors duration-100 hover:bg-hover ${
        selected ? "bg-hover font-semibold" : ""
      } ${over ? "bg-accent-soft ring-1 ring-accent" : ""}`}
    >
      <SelectionPill visible={selected} />
      <button
        type="button"
        tabIndex={-1}
        aria-label={expanded ? "Collapse" : "Expand"}
        onClick={(event) => {
          event.stopPropagation();
          toggleExpanded(folder.id);
        }}
        className="grid size-5 shrink-0 place-items-center rounded text-ink-3 hover:text-ink"
      >
        <ChevronRight12Regular className={`transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
      </button>
      <span className={`shrink-0 ${selected ? "text-accent" : "text-ink-2"}`}>
        {expanded ? <FolderOpen20Regular /> : <Folder20Regular />}
      </span>
      {renaming ? (
        <RenameInput folder={folder} />
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate pl-1">{folder.name}</span>
          {count > 0 && <span className="pr-1.5 text-xs text-ink-3 group-hover:hidden">{count}</span>}
          <button
            type="button"
            tabIndex={-1}
            title={`New note in ${folder.name}`}
            aria-label={`New note in ${folder.name}`}
            onClick={(event) => {
              event.stopPropagation();
              void createNote(folder.id);
            }}
            className="hidden size-6 shrink-0 place-items-center rounded text-ink-2 group-hover:grid hover:bg-hover hover:text-ink"
          >
            <Add20Regular />
          </button>
        </>
      )}
    </div>
  );
});

const NoteRow = memo(function NoteRow({ id, title, depth }: { id: string; title: string; depth: number }) {
  const selected = useStore((state) => state.view.kind === "note" && state.view.id === id);

  const note = () => useStore.getState().notes.find((item) => item.id === id) as NoteMeta;

  return (
    <div
      role="treeitem"
      aria-selected={selected}
      aria-level={depth + 1}
      tabIndex={0}
      data-tree-row
      draggable
      onDragStart={(event) => startDrag(event, { kind: "note", id })}
      onClick={() => openNote(id)}
      onContextMenu={(event) => {
        event.preventDefault();
        openMenu(event.clientX, event.clientY, noteMenu(note()));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") openNote(id);
        if (event.key === "Delete") void trashNote(id);
      }}
      style={{ paddingLeft: 4 + depth * 16 + 24 }}
      className={`relative flex h-[30px] items-center gap-1 rounded pr-2 transition-colors duration-100 hover:bg-hover ${
        selected ? "bg-hover font-semibold" : ""
      }`}
    >
      <SelectionPill visible={selected} />
      <DocumentText20Regular className={`shrink-0 ${selected ? "text-accent" : "text-ink-3"}`} />
      <span className="min-w-0 flex-1 truncate pl-1 text-ink-2">{title}</span>
    </div>
  );
});

type Branch = { folders: Folder[]; notes: { id: string; title: string }[] };

function FolderBranch({
  parent,
  depth,
  tree,
}: {
  parent: string | null;
  depth: number;
  tree: Map<string | null, Branch>;
}) {
  const expanded = useStore((state) => state.expanded);
  const branch = tree.get(parent);
  if (!branch) return null;

  return (
    <>
      {branch.folders.map((folder) => (
        <div key={folder.id} role="group">
          <FolderRow folder={folder} depth={depth} count={tree.get(folder.id)?.notes.length ?? 0} />
          {expanded.has(folder.id) && <FolderBranch parent={folder.id} depth={depth + 1} tree={tree} />}
        </div>
      ))}
      {branch.notes.map((note) => (
        <NoteRow key={note.id} id={note.id} title={note.title} depth={depth} />
      ))}
    </>
  );
}

function branchOf(tree: Map<string | null, Branch>, key: string | null) {
  let branch = tree.get(key);
  if (!branch) {
    branch = { folders: [], notes: [] };
    tree.set(key, branch);
  }
  return branch;
}

function FolderTree() {
  const folders = useStore((state) => state.folders);
  // Autosave replaces a note on every keystroke. Keying the tree on what it shows
  // means typing in a note's body doesn't rebuild the sidebar.
  const shape = useStore((state) =>
    state.notes
      .filter((note) => !note.deletedAt)
      .map((note) => `${note.id}\u0001${note.folderId}\u0001${note.createdAt}\u0001${noteTitle(note)}`)
      .join("\u0002"),
  );

  const tree = useMemo(() => {
    const result = new Map<string | null, Branch>();
    for (const folder of [...folders].sort((a, b) => a.name.localeCompare(b.name))) {
      branchOf(result, folder.parentId).folders.push(folder);
    }
    const notes = shape ? shape.split("\u0002").map((row) => row.split("\u0001")) : [];
    notes.sort((a, b) => Number(b[2]) - Number(a[2]));
    for (const [id, folderId, , title] of notes) {
      branchOf(result, folderId === "null" ? null : folderId).notes.push({ id, title });
    }
    return result;
  }, [folders, shape]);

  const { over, handlers } = useDropTarget(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if ((event.target as HTMLElement).tagName === "INPUT") return;
    event.preventDefault();
    const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-tree-row]")];
    const current = rows.indexOf(document.activeElement as HTMLElement);
    rows[current + (event.key === "ArrowDown" ? 1 : -1)]?.focus();
  };

  const empty = !tree.size;

  return (
    <div
      {...handlers}
      role="tree"
      aria-label="Library"
      onKeyDown={onKeyDown}
      className={`min-h-0 flex-1 overflow-y-auto rounded px-2 pb-2 ${over ? "bg-accent-soft" : ""}`}
    >
      {empty ? (
        <p className="px-3 py-2 text-[13px] leading-[18px] text-ink-3">
          Your notes and folders will appear here.
        </p>
      ) : (
        <FolderBranch parent={null} depth={0} tree={tree} />
      )}
    </div>
  );
}

function isView(view: View, kind: View["kind"]) {
  return view.kind === kind;
}

export function Sidebar() {
  const open = useStore((state) => state.sidebarOpen);
  const view = useStore((state) => state.view);
  const query = useStore((state) => state.query);
  const target = useStore((state) => {
    const id = activeFolderId(state);
    return id ? state.folders.find((folder) => folder.id === id)?.name ?? null : null;
  });
  const dueCount = useStore((state) => {
    const today = localDate();
    return state.todos.filter((todo) => !todo.done && !todo.parentId && todo.dueDate && todo.dueDate <= today).length;
  });

  return (
    <aside
      aria-label="Navigation"
      aria-hidden={!open}
      inert={!open}
      className={`flex w-[264px] shrink-0 flex-col transition-[margin] duration-200 ease-fluent ${
        open ? "ml-0" : "-ml-[264px]"
      }`}
    >
      <div className="px-2 pt-1 pb-1">
        <label className="relative block">
          <Search16Regular className="pointer-events-none absolute top-2 left-2.5 text-ink-3" />
          <input
            data-search
            type="search"
            aria-label="Search notes"
            placeholder="Search notes"
            value={query}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setSearch("");
            }}
            className="field pl-8!"
          />
        </label>
      </div>

      <nav className="space-y-0.5 px-2 py-1">
        <NavItem
          label="Home"
          icon={<Home20Regular />}
          activeIcon={<Home20Filled />}
          active={isView(view, "home")}
          onClick={() => navigate({ kind: "home" })}
        />
        <NavItem
          label="To-Do"
          icon={<CheckboxChecked20Regular />}
          activeIcon={<CheckboxChecked20Filled />}
          active={isView(view, "todos")}
          badge={dueCount}
          onClick={() => navigate({ kind: "todos" })}
        />
      </nav>

      <div className="mx-2 my-1 flex items-center gap-1">
        <button
          type="button"
          title={target ? `New note in ${target} (Ctrl+N)` : "New note (Ctrl+N)"}
          onClick={() => void createNote()}
          className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded bg-accent-fill px-2.5 text-on-accent transition-colors duration-100 hover:bg-accent-hover active:opacity-85"
        >
          <Add20Regular className="shrink-0" />
          <span className="truncate">{target ? `New note in ${target}` : "New note"}</span>
        </button>
        <IconButton
          label={target ? `New folder in ${target} (Ctrl+Shift+N)` : "New folder (Ctrl+Shift+N)"}
          onClick={() => void createFolder()}
        >
          <FolderAdd20Regular />
        </IconButton>
      </div>

      <div className="px-5 pt-2 pb-1 text-xs font-semibold text-ink-3">Library</div>
      <FolderTree />

      <div className="space-y-0.5 border-t border-line p-2">
        <NavItem
          label="Trash"
          icon={<Delete20Regular />}
          activeIcon={<Delete20Filled />}
          active={isView(view, "trash")}
          onClick={() => navigate({ kind: "trash" })}
        />
        <NavItem
          label="Settings"
          icon={<Settings20Regular />}
          activeIcon={<Settings20Filled />}
          active={isView(view, "settings")}
          onClick={() => navigate({ kind: "settings" })}
        />
      </div>
    </aside>
  );
}
