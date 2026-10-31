import { generateHTML, generateJSON, type JSONContent } from "@tiptap/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { api, type Note } from "./api";
import { flushSaves } from "./autosave";
import { extensions } from "./extensions";
import { noteTitle, plural } from "./format";
import { folderPath, showError, toast } from "./store";
import { escapeHtml } from "./text";

export type ExportFormat = "txt" | "md" | "pdf";

type Mode = "txt" | "md";

function escapeMarkdown(text: string) {
  return text
    .replace(/([\\`*[\]])/g, "\\$1")
    .replace(/(^|\s)_/g, "$1\\_")
    .replace(/_(\s|$)/g, "\\_$1");
}

function escapeLineStart(line: string) {
  return line.replace(/^(\s*)(#{1,6}\s|[-+>]\s|\d+[.)]\s)/, "$1\\$2");
}

function inline(node: JSONContent, mode: Mode): string {
  if (node.type === "hardBreak") return mode === "md" ? "  \n" : "\n";
  if (node.type !== "text") return (node.content ?? []).map((child) => inline(child, mode)).join("");

  const raw = node.text ?? "";
  if (mode === "txt") return raw;

  const isCode = node.marks?.some((mark) => mark.type === "code");
  if (isCode) return `\`${raw}\``;

  let text = escapeMarkdown(raw);
  for (const mark of node.marks ?? []) {
    if (mark.type === "bold") text = `**${text}**`;
    if (mark.type === "italic") text = `*${text}*`;
    if (mark.type === "strike") text = `~~${text}~~`;
    if (mark.type === "link") text = `[${text}](${mark.attrs?.href})`;
  }
  return text;
}

function indent(text: string, by: string) {
  return text
    .split("\n")
    .map((line, index) => (index === 0 || !line ? line : by + line))
    .join("\n");
}

function listItem(item: JSONContent, marker: string, mode: Mode) {
  const body = (item.content ?? []).map((child) => block(child, mode)).join("\n");
  return marker + indent(body, " ".repeat(marker.length));
}

function block(node: JSONContent, mode: Mode): string {
  const children = node.content ?? [];
  switch (node.type) {
    case "paragraph": {
      const text = children.map((child) => inline(child, mode)).join("");
      return mode === "md" ? escapeLineStart(text) : text;
    }
    case "heading": {
      const text = children.map((child) => inline(child, mode)).join("");
      return mode === "md" ? `${"#".repeat(node.attrs?.level ?? 1)} ${text}` : text;
    }
    case "bulletList":
      return children.map((item) => listItem(item, "- ", mode)).join("\n");
    case "orderedList":
      return children
        .map((item, index) => listItem(item, `${(node.attrs?.start ?? 1) + index}. `, mode))
        .join("\n");
    case "taskList":
      return children
        .map((item) => {
          const box = item.attrs?.checked ? "[x] " : "[ ] ";
          return listItem(item, mode === "md" ? `- ${box}` : box, mode);
        })
        .join("\n");
    case "blockquote": {
      const quote = children.map((child) => block(child, mode)).join("\n\n");
      return quote
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n");
    }
    case "codeBlock": {
      const code = children.map((child) => child.text ?? "").join("");
      return mode === "md" ? `\`\`\`${node.attrs?.language ?? ""}\n${code}\n\`\`\`` : code;
    }
    case "horizontalRule":
      return "---";
    default:
      return children.map((child) => block(child, mode)).join("\n\n");
  }
}

export function serialize(title: string, doc: JSONContent, mode: Mode) {
  const body = (doc.content ?? []).map((child) => block(child, mode)).join("\n\n").trim();
  const heading = mode === "md" ? `# ${title}` : title;
  return `${heading}\n\n${body}\n`;
}

function preparePrint(note: Note, title: string, html: string) {
  const folders = folderPath(note.folderId).map((folder) => folder.name);
  const edited = new Date(note.updatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const meta = [folders.join(" / "), edited, plural(note.words, "word")].filter(Boolean).join("  ·  ");

  const root = document.getElementById("print-root")!;
  root.innerHTML = `<header class="print-header"><h1>${escapeHtml(title)}</h1><p>${escapeHtml(meta)}</p></header>
    <main class="print-body prose-note">${html}</main>`;
  return root;
}

export async function exportNote(id: string, format: ExportFormat) {
  try {
    await flushSaves();
    const note = await api.getNote(id);
    const title = noteTitle(note);
    const doc = generateJSON(note.content || "<p></p>", extensions);

    let path: string | null;
    if (format === "pdf") {
      // Parsing through the schema first means only known, safe markup reaches the page.
      const root = preparePrint(note, title, generateHTML(doc, extensions));
      const appTitle = document.title;
      document.title = title; // Becomes the PDF's document title.
      try {
        path = await api.exportPdf(title);
      } finally {
        document.title = appTitle;
        root.replaceChildren();
      }
    } else {
      path = await api.exportText(title, format, serialize(title, doc, format));
    }

    if (path) {
      const saved = path;
      toast(`Exported ${saved.split("\\").pop()}`, {
        action: { label: "Show in folder", run: () => void revealItemInDir(saved) },
      });
    }
  } catch (error) {
    showError(error);
  }
}
