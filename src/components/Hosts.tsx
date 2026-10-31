import { CheckmarkCircle20Filled, Dismiss16Regular, ErrorCircle20Filled, Folder20Regular, Home20Regular } from "@fluentui/react-icons";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Folder } from "../lib/api";
import { closeDialog, closeMenu, descendantIds, dismissToast, useStore } from "../lib/store";
import { Button } from "./ui";

const EDGE_GAP = 8;

export function MenuHost() {
  const menu = useStore((state) => state.menu);
  const surface = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!menu || !surface.current) return;
    const { width, height } = surface.current.getBoundingClientRect();
    setPosition({
      left: Math.max(EDGE_GAP, Math.min(menu.x, innerWidth - width - EDGE_GAP)),
      top: Math.max(EDGE_GAP, Math.min(menu.y, innerHeight - height - EDGE_GAP)),
    });
    surface.current.focus();
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!surface.current?.contains(event.target as Node)) closeMenu();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menu]);

  if (!menu) return null;

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      closeMenu();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = [...surface.current!.querySelectorAll<HTMLElement>("[role^='menuitem']")];
    const current = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    const next = current < 0 && step < 0 ? items.length - 1 : (current + step + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div
      ref={surface}
      role="menu"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={position}
      className="menu-surface fixed z-50 min-w-48 p-1 outline-none"
    >
      {menu.items.map((item, index) => {
        if (item === "separator") return <div key={index} className="my-1 h-px bg-line" />;
        return (
          <button
            key={item.label}
            type="button"
            role={item.checked === undefined ? "menuitem" : "menuitemcheckbox"}
            aria-checked={item.checked}
            onClick={() => {
              closeMenu();
              item.run();
            }}
            className={`flex h-8 w-full items-center gap-2.5 rounded px-2 text-left transition-colors duration-75 hover:bg-hover focus-visible:bg-hover focus-visible:outline-none ${
              item.danger ? "text-danger" : "text-ink"
            } ${item.checked ? "font-semibold" : ""}`}
          >
            {item.icon && <span className="grid size-5 place-items-center text-[20px]">{item.icon}</span>}
            <span className="flex-1 truncate">{item.label}</span>
            {item.shortcut && <span className="pl-6 text-xs text-ink-3">{item.shortcut}</span>}
          </button>
        );
      })}
    </div>
  );
}

function flattenFolders(folders: Folder[], parent: string | null = null, depth = 0): { folder: Folder; depth: number }[] {
  return folders
    .filter((folder) => folder.parentId === parent)
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((folder) => [{ folder, depth }, ...flattenFolders(folders, folder.id, depth + 1)]);
}

function MoveDialogBody({ exclude, onPick }: { exclude?: string; onPick: (id: string | null) => void }) {
  const folders = useStore((state) => state.folders);
  const rows = useMemo(() => {
    const blocked = exclude ? descendantIds(exclude, folders) : new Set<string>();
    return flattenFolders(folders.filter((folder) => !blocked.has(folder.id)));
  }, [folders, exclude]);

  return (
    <div className="max-h-72 overflow-y-auto">
      <button
        type="button"
        onClick={() => onPick(null)}
        className="flex h-8 w-full items-center gap-2 rounded px-2 text-left hover:bg-hover"
      >
        <Home20Regular /> Library root
      </button>
      {rows.map(({ folder, depth }) => (
        <button
          key={folder.id}
          type="button"
          onClick={() => onPick(folder.id)}
          style={{ paddingLeft: 8 + (depth + 1) * 16 }}
          className="flex h-8 w-full items-center gap-2 rounded pr-2 text-left hover:bg-hover"
        >
          <Folder20Regular className="shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
      ))}
    </div>
  );
}

export function DialogHost() {
  const dialog = useStore((state) => state.dialog);
  const element = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (dialog) element.current?.showModal();
  }, [dialog]);

  if (!dialog) return null;

  const dismiss = () => {
    closeDialog();
    if (dialog.kind === "confirm") dialog.resolve(false);
    else dialog.resolve(undefined);
  };

  return (
    <dialog
      ref={element}
      aria-label={dialog.title}
      onCancel={(event) => {
        event.preventDefault();
        dismiss();
      }}
      className="w-[420px] max-w-[calc(100vw-32px)]"
    >
      <div className="p-6 pb-5">
        <h2 className="font-display text-xl font-semibold">{dialog.title}</h2>
        <div className="mt-3 text-ink-2">
          {dialog.kind === "confirm" ? (
            dialog.body
          ) : (
            <MoveDialogBody
              exclude={dialog.exclude}
              onPick={(id) => {
                closeDialog();
                dialog.resolve(id);
              }}
            />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-line bg-hover p-4">
        {dialog.kind === "confirm" && (
          <Button
            variant={dialog.danger ? "danger" : "primary"}
            className="min-w-24"
            onClick={() => {
              closeDialog();
              dialog.resolve(true);
            }}
          >
            {dialog.confirm}
          </Button>
        )}
        <Button autoFocus className="min-w-24" onClick={dismiss}>
          Cancel
        </Button>
      </div>
    </dialog>
  );
}

export function ToastHost() {
  const toasts = useStore((state) => state.toasts);
  return (
    <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-10 z-40 flex w-80 flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className="toast-in menu-surface pointer-events-auto flex items-center gap-2.5 py-2.5 pr-2 pl-3"
        >
          {toast.tone === "error" ? (
            <ErrorCircle20Filled className="shrink-0 text-danger" />
          ) : (
            <CheckmarkCircle20Filled className="shrink-0 text-accent" />
          )}
          <span className="min-w-0 flex-1 break-words text-[13px] leading-[18px] text-ink">{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                dismissToast(toast.id);
                toast.action?.run();
              }}
              className="shrink-0 rounded px-2 py-1 text-[13px] font-semibold text-accent hover:bg-hover"
            >
              {toast.action.label}
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismissToast(toast.id)}
            className="grid size-6 shrink-0 place-items-center rounded text-ink-3 hover:bg-hover hover:text-ink"
          >
            <Dismiss16Regular />
          </button>
        </div>
      ))}
    </div>
  );
}
