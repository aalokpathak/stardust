import { FolderOpen20Regular } from "@fluentui/react-icons";
import { openPath } from "@tauri-apps/plugin-opener";
import { useEffect, useState, type ReactNode } from "react";
import { api, type SystemInfo } from "../lib/api";
import { formatBytes } from "../lib/format";
import { showError, updateSettings, useStore, type EditorFont, type ThemeChoice } from "../lib/store";
import { Button, PageHeader } from "./ui";

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-16 items-center justify-between gap-6 rounded-lg border border-line bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="text-ink">{label}</div>
        {hint && <div className="mt-0.5 break-words text-xs text-ink-2 select-text">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Segmented<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: Value;
  options: { value: Value; label: string }[];
  onChange: (value: Value) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded border border-line bg-card p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={`h-7 rounded-[3px] px-3 transition-colors duration-100 ${
            value === option.value ? "bg-accent-fill text-on-accent" : "text-ink-2 hover:bg-hover hover:text-ink"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function NameField() {
  const saved = useStore((state) => state.settings.displayName);
  const [name, setName] = useState(saved);

  const commit = () => {
    const trimmed = name.trim();
    setName(trimmed);
    if (trimmed !== saved) void updateSettings({ displayName: trimmed });
  };

  return (
    <input
      aria-label="Your name"
      className="field w-56!"
      maxLength={40}
      placeholder="Your name"
      value={name}
      onChange={(event) => setName(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}

export function SettingsView() {
  const theme = useStore((state) => state.settings.theme);
  const editorFont = useStore((state) => state.settings.editorFont);
  const [info, setInfo] = useState<SystemInfo | null>(null);

  useEffect(() => {
    void api.systemInfo().then(setInfo).catch(showError);
  }, []);

  return (
    <div className="h-full overflow-y-auto">
      <div className="page-in mx-auto max-w-[760px] px-8 pt-8 pb-10">
        <PageHeader title="Settings" />

        <div className="mt-6 space-y-1.5">
          <Row label="Your name" hint="Shown in the greeting on Home">
            <NameField />
          </Row>
          <Row label="Theme">
            <Segmented<ThemeChoice>
              label="Theme"
              value={theme}
              options={[
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ]}
              onChange={(value) => void updateSettings({ theme: value })}
            />
          </Row>
          <Row label="Writing font" hint="Applies to every note">
            <Segmented<EditorFont>
              label="Writing font"
              value={editorFont}
              options={[
                { value: "sans", label: "Sans" },
                { value: "serif", label: "Serif" },
                { value: "mono", label: "Mono" },
              ]}
              onChange={(value) => void updateSettings({ editorFont: value })}
            />
          </Row>
          <Row label="Library" hint={info ? `${info.dataDir} · ${formatBytes(info.libraryBytes)}` : undefined}>
            <Button
              disabled={!info}
              onClick={() => {
                if (info) void openPath(info.dataDir).catch(showError);
              }}
            >
              <FolderOpen20Regular /> Open folder
            </Button>
          </Row>
          <Row label="About" hint={`Stardust ${info?.version ?? ""}${info?.portable ? " (portable)" : ""}. scattered thoughts, gathered`}>
            <img src="/logo.svg" alt="" className="size-9" />
          </Row>
        </div>
      </div>
    </div>
  );
}
