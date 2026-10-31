import {
  ArrowLeft20Regular,
  PanelLeftContract20Regular,
  PanelLeftExpand20Regular,
  WeatherMoon20Regular,
  WeatherSunny20Regular,
} from "@fluentui/react-icons";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { currentTheme, goBack, toggleSidebar, updateSettings, useStore } from "../lib/store";
import { IconButton } from "./ui";

const appWindow = getCurrentWindow();

// Segoe Fluent Icons glyphs, the same ones Windows draws on native caption buttons.
const MINIMIZE = "";
const MAXIMIZE = "";
const RESTORE = "";
const CLOSE = "";

function CaptionButton({
  label,
  glyph,
  danger,
  onClick,
}: {
  label: string;
  glyph: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`grid h-10 w-[46px] place-items-center text-ink transition-colors duration-100 ${
        danger ? "hover:bg-[#c42b1c] hover:text-white active:bg-[#c83c31]" : "hover:bg-hover active:bg-press"
      }`}
    >
      <span className="caption-icon">{glyph}</span>
    </button>
  );
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const sync = () => void appWindow.isMaximized().then(setMaximized);
    sync();
    const unlisten = appWindow.onResized(sync);
    return () => void unlisten.then((stop) => stop());
  }, []);

  return (
    <div className="flex shrink-0">
      <CaptionButton label="Minimize" glyph={MINIMIZE} onClick={() => void appWindow.minimize()} />
      <CaptionButton
        label={maximized ? "Restore" : "Maximize"}
        glyph={maximized ? RESTORE : MAXIMIZE}
        onClick={() => void appWindow.toggleMaximize()}
      />
      <CaptionButton label="Close" glyph={CLOSE} danger onClick={() => void appWindow.close()} />
    </div>
  );
}

function ThemeToggle() {
  useStore((state) => state.settings.theme);
  const dark = currentTheme() === "dark";
  return (
    <IconButton
      label={dark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={() => void updateSettings({ theme: dark ? "light" : "dark" })}
    >
      {dark ? <WeatherSunny20Regular /> : <WeatherMoon20Regular />}
    </IconButton>
  );
}

export function TitleBar({ minimal }: { minimal: boolean }) {
  const canGoBack = useStore((state) => state.past.length > 0);
  const sidebarOpen = useStore((state) => state.sidebarOpen);

  return (
    <header data-tauri-drag-region className="flex h-10 shrink-0 items-center pl-1.5">
      {!minimal && (
        <>
          <IconButton label="Back (Alt+Left)" disabled={!canGoBack} onClick={goBack}>
            <ArrowLeft20Regular />
          </IconButton>
          <IconButton label="Toggle sidebar (Ctrl+\)" onClick={toggleSidebar}>
            {sidebarOpen ? <PanelLeftContract20Regular /> : <PanelLeftExpand20Regular />}
          </IconButton>
        </>
      )}
      <div data-tauri-drag-region className="flex h-full min-w-0 flex-1 items-center gap-2 pl-2">
        <img src="/logo.svg" alt="" width={16} height={16} className="pointer-events-none" />
        <span className="pointer-events-none text-xs text-ink-2">Stardust</span>
      </div>
      <ThemeToggle />
      <div className="ml-1.5">
        <WindowControls />
      </div>
    </header>
  );
}
