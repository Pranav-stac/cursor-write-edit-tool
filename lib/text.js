export function detectNewline(text) {
  if (text.includes("\r\n")) return "\r\n";
  if (text.includes("\n")) return "\n";
  if (text.includes("\r")) return "\r";
  return "\n";
}

export function toLf(text) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function normalizeNewlines(text, newline) {
  const unified = toLf(text);
  if (newline === "\r\n") return unified.replace(/\n/g, "\r\n");
  if (newline === "\r") return unified.replace(/\n/g, "\r");
  return unified;
}

export function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}
