import { CheckmarkCircle16Regular, ErrorCircle16Regular } from "@fluentui/react-icons";
import { openUrl } from "@tauri-apps/plugin-opener";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { api, type Note } from "../lib/api";
import { detachDraft, flushSaves, queueContent, queueTitle } from "../lib/autosave";
import { extensions } from "../lib/extensions";
import { formatCount, plural } from "../lib/format";
import { folderPath, goBack, showError, useStore } from "../lib/store";
import { looksLikeCode } from "../lib/text";
import { EditorToolbar } from "./EditorToolbar";

// A save normally lands within milliseconds. Only one that lingers is worth showing,
// otherwise the status would flicker on every keystroke.
const SAVING_LABEL_DELAY = 400;

function SaveStatus() {
  const state = useStore((store) => store.saveState);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    if (state !== "saving") {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SAVING_LABEL_DELAY);
    return () => clearTimeout(timer);
  }, [state]);

  if (state === "failed") {
    return (
      <span role="status" className="flex items-center gap-1 text-danger">
        <ErrorCircle16Regular /> Couldn't save, retrying
      </span>
    );
  }
  return (
    <span role="status" className="flex items-center gap-1">
      <CheckmarkCircle16Regular /> {slow ? "Saving" : "Saved"}
    </span>
  );
}

function StatusBar({ id }: { id: string }) {
  const words = useStore((state) => state.notes.find((note) => note.id === id)?.words ?? 0);
  const chars = useStore((state) => state.notes.find((note) => note.id === id)?.chars ?? 0);
  const folderId = useStore((state) => state.notes.find((note) => note.id === id)?.folderId ?? null);
  const folders = useStore((state) => state.folders);
  const path = folderPath(folderId, folders);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line px-3 text-xs text-ink-3">
      <span className="min-w-0 flex-1 truncate">
        {path.length ? path.map((folder) => folder.name).join(" / ") : "Library"}
      </span>
      <span className="tabular-nums">{plural(words, "word")}</span>
      <span className="tabular-nums">{formatCount(chars)} characters</span>
      <SaveStatus />
    </footer>
  );
}

function LoadedEditor({ note }: { note: Note }) {
  const [title, setTitle] = useState(note.title);
  const editorFont = useStore((state) => state.settings.editorFont);

  const editor = useEditor({
    extensions,
    content: note.content,
    autofocus: note.chars === 0 && !note.title ? "start" : false,
    editorProps: {
      attributes: { class: "prose-note", "aria-label": "Note text" },
      handleClick(_view, _pos, event) {
        const link = (event.target as HTMLElement).closest("a");
        if (!link || !(event.ctrlKey || event.metaKey)) return false;
        void openUrl(link.href).catch(showError);
        return true;
      },
      handlePaste(view, event) {
        // VS Code and rich sources bring their own structure. Only bare text needs a guess.
        const data = event.clipboardData;
        const text = data?.getData("text/plain");
        if (!text || data?.getData("text/html") || data?.getData("vscode-editor-data")) return false;
        const { state } = view;
        if (state.selection.$from.parent.type.name === "codeBlock" || !looksLikeCode(text)) return false;
        const block = state.schema.nodes.codeBlock.create(null, state.schema.text(text.replace(/\r\n/g, "\n")));
        view.dispatch(state.tr.replaceSelectionWith(block).scrollIntoView());
        return true;
      },
    },
    onUpdate: ({ editor: live }) => {
      queueContent(note.id, () => ({
        content: live.getHTML(),
        body: live.getText({ blockSeparator: "\n" }),
      }));
    },
  });

  useEffect(() => () => detachDraft(note.id), [note.id]);

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar editor={editor} noteId={note.id} />
      <div className="min-h-0 flex-1 overflow-y-auto" onClick={(event) => {
        if (event.target === event.currentTarget) editor.commands.focus("end");
      }}>
        <div className="mx-auto max-w-[760px] px-10 pt-10">
          <textarea
            rows={1}
            aria-label="Note title"
            value={title}
            maxLength={300}
            placeholder="Untitled"
            spellCheck={false}
            onChange={(event) => {
              const next = event.target.value.replace(/\r?\n/g, " ");
              setTitle(next);
              queueTitle(note.id, next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "ArrowDown") {
                event.preventDefault();
                editor.commands.focus("start");
              }
            }}
            className="mb-3 w-full resize-none overflow-hidden bg-transparent font-display text-[32px] leading-10 font-bold tracking-[-0.02em] text-ink outline-none [field-sizing:content] placeholder:text-ink-3"
          />
          <div className="stardust-editor" data-font={editorFont}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      <StatusBar id={note.id} />
    </div>
  );
}

export function NoteEditor({ id }: { id: string }) {
  const [note, setNote] = useState<Note | null>(null);

  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        await flushSaves();
        const loaded = await api.getNote(id);
        if (current) setNote(loaded);
      } catch (error) {
        showError(error);
        goBack();
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [id]);

  return note ? <LoadedEditor note={note} /> : null;
}
