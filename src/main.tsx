import { getCurrentWindow } from "@tauri-apps/api/window";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { FatalScreen } from "./components/FatalScreen";
import { loadApp } from "./lib/store";
import "./index.css";

/** Mica only exists on Windows 11, which reports platform version 13 or newer. */
async function detectMica() {
  const data = (navigator as Navigator & {
    userAgentData?: { getHighEntropyValues: (hints: string[]) => Promise<{ platformVersion?: string }> };
  }).userAgentData;

  const version = await data?.getHighEntropyValues(["platformVersion"]).catch(() => null);
  const major = Number.parseInt(version?.platformVersion ?? "0", 10);
  document.documentElement.classList.toggle("no-mica", major < 13);
}

async function start() {
  const root = createRoot(document.getElementById("root")!);
  try {
    await Promise.all([detectMica(), loadApp()]);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (error) {
    root.render(<FatalScreen error={String(error)} />);
  }

  // Revealing only after the first paint avoids a flash of an empty window.
  requestAnimationFrame(() => requestAnimationFrame(() => void getCurrentWindow().show()));
}

void start();
