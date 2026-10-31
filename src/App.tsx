import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { FolderView } from "./components/FolderView";
import { DialogHost, MenuHost, ToastHost } from "./components/Hosts";
import { NoteEditor } from "./components/NoteEditor";
import { Onboarding } from "./components/Onboarding";
import { SearchView } from "./components/SearchView";
import { SettingsView } from "./components/SettingsView";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { TodosView } from "./components/TodosView";
import { TrashView } from "./components/TrashView";
import { flushSaves } from "./lib/autosave";
import {
  applyTheme,
  captureText,
  createFolder,
  createNote,
  goBack,
  toast,
  toggleSidebar,
  useStore,
} from "./lib/store";

function isTextField(target: EventTarget | null) {
  return target instanceof HTMLElement && !!target.closest("input, textarea, [contenteditable='true']");
}

function focusSearch() {
  document.querySelector<HTMLInputElement>("[data-search]")?.select();
}

function useGlobalBehaviour() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (ctrl && key === "n") {
        event.preventDefault();
        void (event.shiftKey ? createFolder() : createNote());
      } else if (ctrl && (key === "k" || key === "f")) {
        event.preventDefault();
        focusSearch();
      } else if (ctrl && event.key === "\\") {
        event.preventDefault();
        toggleSidebar();
      } else if (ctrl && key === "s") {
        // Muscle memory from Notepad. There is nothing to do, so just reassure.
        event.preventDefault();
        toast("Already saved. Stardust saves as you type.");
      } else if (ctrl && (key === "p" || key === "r")) {
        event.preventDefault();
      } else if (event.key === "F5") {
        event.preventDefault();
      } else if (event.altKey && event.key === "ArrowLeft") {
        event.preventDefault();
        goBack();
      }
    };

    // Pasting anywhere outside a text field saves the clipboard as a note.
    const onPaste = (event: ClipboardEvent) => {
      if (isTextField(event.target) || isTextField(document.activeElement)) return;
      if (!useStore.getState().settings.onboarded) return;
      const text = event.clipboardData?.getData("text/plain");
      if (text?.trim()) void captureText(text);
    };

    // Keep the browser's own menu for text fields and hide it everywhere else.
    const onContextMenu = (event: MouseEvent) => {
      if (!isTextField(event.target)) event.preventDefault();
    };

    const systemTheme = matchMedia("(prefers-color-scheme: dark)");
    const onSystemTheme = () => {
      const { theme } = useStore.getState().settings;
      if (theme === "system") applyTheme(theme, true);
    };

    window.addEventListener("keydown", onKey);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onContextMenu);
    systemTheme.addEventListener("change", onSystemTheme);

    const closing = getCurrentWindow().onCloseRequested(() => flushSaves());
    const reminders = listen<[string, string]>("reminder", ({ payload }) => toast(`Reminder: ${payload[1]}`));

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onContextMenu);
      systemTheme.removeEventListener("change", onSystemTheme);
      void closing.then((stop) => stop());
      void reminders.then((stop) => stop());
    };
  }, []);
}

function Page() {
  const view = useStore((state) => state.view);
  switch (view.kind) {
    case "home":
      return <Dashboard />;
    case "todos":
      return <TodosView />;
    case "trash":
      return <TrashView />;
    case "settings":
      return <SettingsView />;
    case "search":
      return <SearchView />;
    case "folder":
      return <FolderView key={view.id} id={view.id} />;
    case "note":
      return <NoteEditor key={view.id} id={view.id} />;
  }
}

export default function App() {
  const onboarded = useStore((state) => state.settings.onboarded);
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  useGlobalBehaviour();

  return (
    <div className="flex h-full flex-col">
      <TitleBar minimal={!onboarded} />
      {onboarded ? (
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main
            className={`min-w-0 flex-1 overflow-hidden border-t border-line bg-layer ${
              sidebarOpen ? "rounded-tl-lg border-l" : ""
            }`}
          >
            <Page />
          </main>
        </div>
      ) : (
        <Onboarding />
      )}
      <MenuHost />
      <DialogHost />
      <ToastHost />
    </div>
  );
}
