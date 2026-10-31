import {
  ArrowExportUp20Regular,
  ArrowRedo20Regular,
  ArrowUndo20Regular,
  ChevronDown12Regular,
  Code20Regular,
  CodeBlock20Regular,
  Delete20Regular,
  FolderArrowRight20Regular,
  LineHorizontal120Regular,
  Add16Regular,
  Subtract16Regular,
  TaskListLtr20Regular,
  TextBold20Regular,
  TextBulletListLtr20Regular,
  TextItalic20Regular,
  TextNumberListLtr20Regular,
  TextQuote20Regular,
  TextStrikethrough20Regular,
  TextUnderline20Regular,
} from "@fluentui/react-icons";
import { useEditorState, type Editor } from "@tiptap/react";
import { exportItems, moveNoteToFolder } from "../lib/menus";
import { openMenuBelow, trashNote, useStore, type MenuItem } from "../lib/store";
import { IconButton } from "./ui";

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 40, 48];
const BODY_SIZE = 16;
const HEADING_SIZES: Record<number, number> = { 1: 30, 2: 24, 3: 20 };
const STYLE_LABELS: Record<number, string> = { 0: "Normal text", 1: "Heading 1", 2: "Heading 2", 3: "Heading 3" };

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-line" />;
}

function DropdownButton({
  label,
  width,
  onOpen,
  children,
}: {
  label: string;
  width?: string;
  onOpen: (button: HTMLElement) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="menu"
      title={label}
      onClick={(event) => onOpen(event.currentTarget)}
      className={`flex h-8 shrink-0 items-center justify-between gap-1.5 rounded px-2 text-ink transition-colors duration-100 hover:bg-hover active:bg-press ${width ?? ""}`}
    >
      <span className="flex items-center gap-1.5 truncate">{children}</span>
      <ChevronDown12Regular className="shrink-0 text-ink-3" />
    </button>
  );
}

export function EditorToolbar({ editor, noteId }: { editor: Editor; noteId: string }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: live }) => {
      const level = [1, 2, 3].find((value) => live.isActive("heading", { level: value })) ?? 0;
      const explicit = live.getAttributes("textStyle").fontSize as string | undefined;
      return {
        level,
        fontSize: explicit ? Number.parseInt(explicit, 10) : (HEADING_SIZES[level] ?? BODY_SIZE),
        bold: live.isActive("bold"),
        italic: live.isActive("italic"),
        underline: live.isActive("underline"),
        strike: live.isActive("strike"),
        code: live.isActive("code"),
        codeBlock: live.isActive("codeBlock"),
        bulletList: live.isActive("bulletList"),
        orderedList: live.isActive("orderedList"),
        taskList: live.isActive("taskList"),
        blockquote: live.isActive("blockquote"),
        canUndo: live.can().undo(),
        canRedo: live.can().redo(),
      };
    },
  });

  const chain = () => editor.chain().focus();

  const setStyle = (level: number) => {
    if (level === 0) chain().setParagraph().run();
    else chain().setHeading({ level: level as 1 | 2 | 3 }).run();
  };

  const setSize = (size: number) => {
    const natural = HEADING_SIZES[state.level] ?? BODY_SIZE;
    if (size === natural) chain().unsetFontSize().run();
    else chain().setFontSize(`${size}px`).run();
  };

  const stepSize = (direction: 1 | -1) => {
    const next = direction > 0
      ? FONT_SIZES.find((size) => size > state.fontSize)
      : FONT_SIZES.findLast((size) => size < state.fontSize);
    if (next) setSize(next);
  };

  const styleItems: MenuItem[] = [0, 1, 2, 3].map((level) => ({
    label: STYLE_LABELS[level],
    checked: state.level === level,
    run: () => setStyle(level),
  }));

  const sizeItems: MenuItem[] = FONT_SIZES.map((size) => ({
    label: `${size}`,
    checked: state.fontSize === size,
    run: () => setSize(size),
  }));

  const noteItems = (): MenuItem[] => {
    const note = useStore.getState().notes.find((item) => item.id === noteId);
    return [
      ...exportItems(noteId),
      "separator",
      {
        label: "Move to...",
        icon: <FolderArrowRight20Regular />,
        run: () => {
          if (note) moveNoteToFolder(note);
        },
      },
      { label: "Move to Trash", icon: <Delete20Regular />, danger: true, run: () => void trashNote(noteId) },
    ];
  };

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex h-11 shrink-0 items-center gap-0.5 overflow-x-auto overflow-y-hidden border-b border-line px-2"
    >
      <IconButton label="Undo (Ctrl+Z)" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <ArrowUndo20Regular />
      </IconButton>
      <IconButton label="Redo (Ctrl+Y)" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <ArrowRedo20Regular />
      </IconButton>
      <Divider />

      <DropdownButton label="Text style" width="w-[116px]" onOpen={(button) => openMenuBelow(button, styleItems)}>
        {STYLE_LABELS[state.level]}
      </DropdownButton>
      <Divider />

      <IconButton label="Smaller text" onClick={() => stepSize(-1)}>
        <Subtract16Regular />
      </IconButton>
      <DropdownButton label="Font size" width="w-[54px]" onOpen={(button) => openMenuBelow(button, sizeItems)}>
        <span className="tabular-nums">{state.fontSize}</span>
      </DropdownButton>
      <IconButton label="Larger text" onClick={() => stepSize(1)}>
        <Add16Regular />
      </IconButton>
      <Divider />

      <IconButton label="Bold (Ctrl+B)" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <TextBold20Regular />
      </IconButton>
      <IconButton label="Italic (Ctrl+I)" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <TextItalic20Regular />
      </IconButton>
      <IconButton label="Underline (Ctrl+U)" active={state.underline} onClick={() => chain().toggleUnderline().run()}>
        <TextUnderline20Regular />
      </IconButton>
      <IconButton label="Strikethrough" active={state.strike} onClick={() => chain().toggleStrike().run()}>
        <TextStrikethrough20Regular />
      </IconButton>
      <Divider />

      <IconButton label="Bulleted list" active={state.bulletList} onClick={() => chain().toggleBulletList().run()}>
        <TextBulletListLtr20Regular />
      </IconButton>
      <IconButton label="Numbered list" active={state.orderedList} onClick={() => chain().toggleOrderedList().run()}>
        <TextNumberListLtr20Regular />
      </IconButton>
      <IconButton label="Checklist" active={state.taskList} onClick={() => chain().toggleTaskList().run()}>
        <TaskListLtr20Regular />
      </IconButton>
      <IconButton label="Quote" active={state.blockquote} onClick={() => chain().toggleBlockquote().run()}>
        <TextQuote20Regular />
      </IconButton>
      <IconButton label="Inline code" active={state.code} onClick={() => chain().toggleCode().run()}>
        <Code20Regular />
      </IconButton>
      <IconButton label="Code block" active={state.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        <CodeBlock20Regular />
      </IconButton>
      <IconButton label="Divider line" onClick={() => chain().setHorizontalRule().run()}>
        <LineHorizontal120Regular />
      </IconButton>

      <span className="min-w-2 flex-1" />
      <DropdownButton label="Export and note options" onOpen={(button) => openMenuBelow(button, noteItems())}>
        <ArrowExportUp20Regular /> Export
      </DropdownButton>
    </div>
  );
}
