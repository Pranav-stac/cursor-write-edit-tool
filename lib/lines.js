import { toLf } from "./text.js";

export function lineNumberAt(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") line += 1;
  }
  return line;
}

export function lineRangeAt(text, startIndex, length) {
  const endIndex = Math.max(startIndex, startIndex + length - 1);
  return {
    start_line: lineNumberAt(text, startIndex),
    end_line: lineNumberAt(text, endIndex),
  };
}

export function snippetAround(text, index, contextLines = 1) {
  const lf = toLf(text);
  const lines = lf.split("\n");
  const targetLine = lineNumberAt(lf, Math.min(index, lf.length)) - 1;
  const start = Math.max(0, targetLine - contextLines);
  const end = Math.min(lines.length - 1, targetLine + contextLines);
  const snippet = lines
    .slice(start, end + 1)
    .map((content, offset) => {
      const lineNo = start + offset + 1;
      const marker = lineNo === targetLine + 1 ? ">" : " ";
      return `${marker} ${lineNo}: ${content}`;
    })
    .join("\n");
  return { line: targetLine + 1, snippet };
}

export function splitLfLines(text) {
  return toLf(text).split("\n");
}

export function joinLfLines(lines, newline) {
  const joined = lines.join("\n");
  if (newline === "\r\n") return joined.replace(/\n/g, "\r\n");
  if (newline === "\r") return joined.replace(/\n/g, "\r");
  return joined;
}
