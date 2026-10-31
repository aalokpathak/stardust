const CODE_LINE =
  /[{};]\s*$|^\s*(\/\/|#include|import |from |def |class |function |const |let |var |public |private |return |if \(|for \(|<\/?[a-z][^>]*>)|=>|\(\)\s*[:{]|^\s{2,}\S/;

/** Pasted plain text with no structure of its own: is it a code snippet? */
export function looksLikeCode(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return false;
  return lines.filter((line) => CODE_LINE.test(line)).length / lines.length >= 0.5;
}

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turns captured text into note content: a code block for code, paragraphs otherwise. */
export function textToHtml(text: string) {
  if (looksLikeCode(text)) return `<pre><code>${escapeHtml(text)}</code></pre>`;
  return text
    .split(/\r?\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}
