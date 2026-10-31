import { api, type NoteEdit } from "./api";
import { applyNoteMeta, setSaveState, showError } from "./store";

const RETRY_DELAY = 1500;
const FLUSH_LIMIT = 3000;

type ReadBody = () => { content: string; body: string };

type Draft = { title?: string; read?: ReadBody; edit?: NoteEdit };

const drafts = new Map<string, Draft>();
const running = new Map<string, Promise<void>>();

function takeEdit(id: string): NoteEdit | null {
  const draft = drafts.get(id);
  if (!draft) return null;
  drafts.delete(id);
  return { ...draft.edit, ...(draft.title === undefined ? {} : { title: draft.title }), ...draft.read?.() };
}

/**
 * Saves as fast as the disk allows. Each keystroke queues a save, and any keystrokes
 * that land while one is in flight collapse into the next, so nothing waits on a timer
 * and the document is only serialized when it is actually about to be written.
 */
async function pump(id: string) {
  let warned = false;
  for (let edit = takeEdit(id); edit; edit = takeEdit(id)) {
    try {
      applyNoteMeta(await api.saveNote(id, edit));
      warned = false;
    } catch (error) {
      setSaveState("failed");
      if (!warned) showError(error);
      warned = true;
      // Put the failed edit back behind anything newer and try again.
      const newer = drafts.get(id);
      drafts.set(id, { ...newer, edit: { ...edit, ...newer?.edit } });
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
    }
  }
}

function schedule(id: string) {
  setSaveState("saving");
  if (running.has(id)) return;
  const task = pump(id).finally(() => {
    running.delete(id);
    if (running.size === 0) setSaveState("saved");
  });
  running.set(id, task);
}

export function queueTitle(id: string, title: string) {
  drafts.set(id, { ...drafts.get(id), title });
  schedule(id);
}

export function queueContent(id: string, read: ReadBody) {
  drafts.set(id, { ...drafts.get(id), read });
  schedule(id);
}

/** Captures a queued edit now, for an editor about to be destroyed. */
export function detachDraft(id: string) {
  const draft = drafts.get(id);
  if (draft?.read) drafts.set(id, { title: draft.title, edit: { ...draft.edit, ...draft.read() } });
}

/**
 * Waits for queued saves. A save that keeps failing retries forever, so the wait is
 * bounded: a full disk must not stop the window closing or another note opening.
 */
export async function flushSaves() {
  const settled = (async () => {
    while (running.size > 0) await Promise.all(running.values());
  })();
  await Promise.race([settled, new Promise((resolve) => setTimeout(resolve, FLUSH_LIMIT))]);
}
