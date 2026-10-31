import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "./ui";

export function FatalScreen({ error }: { error: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <img src="/logo.svg" alt="" className="size-14" />
      <h1 className="font-display text-xl font-bold">Stardust couldn't open your library</h1>
      <p className="max-w-md text-ink-2">
        Your notes haven't been changed. Close the app and try again. If this keeps happening, check that the
        drive holding your library is available.
      </p>
      <code className="max-w-md text-xs break-words text-ink-3 select-text">{error}</code>
      <Button variant="primary" onClick={() => void getCurrentWindow().close()}>
        Close Stardust
      </Button>
    </div>
  );
}
