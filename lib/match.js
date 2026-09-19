import { EditError } from "./errors.js";
import { lineNumberAt, lineRangeAt, snippetAround } from "./lines.js";
import { collapseWhitespace, normalizeNewlines, toLf } from "./text.js";

export function findReplacement(text, oldString, newString, newline) {
  const strategies = [
    { name: "exact", searchText: text, searchOld: oldString, searchNew: newString },
    {
      name: "file_newline",
      searchText: text,
      searchOld: normalizeNewlines(oldString, newline),
      searchNew: normalizeNewlines(newString, newline),
    },
    {
      name: "lf_normalized",
      searchText: toLf(text),
      searchOld: toLf(oldString),
      searchNew: toLf(newString),
    },
  ];

  for (const strategy of strategies) {
    if (!strategy.searchOld || !strategy.searchText.includes(strategy.searchOld)) {
      continue;
    }
    return { ...strategy, matchIndex: strategy.searchText.indexOf(strategy.searchOld) };
  }

  return null;
}

function findOccurrences(text, search) {
  const hits = [];
  let index = text.indexOf(search);
  while (index !== -1) {
    hits.push(index);
    index = text.indexOf(search, index + search.length);
  }
  return hits;
}

function findCandidates(text, oldString) {
  const lfText = toLf(text);
  const lfOld = toLf(oldString);
  const needle = lfOld.split("\n").find((line) => line.trim().length > 0) ?? lfOld;
  if (!needle.trim()) return [];

  const candidates = [];
  const lines = lfText.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes(needle.trim())) continue;
    const index = lfText.indexOf(lines[i]);
    const { snippet, line } = snippetAround(lfText, index, 1);
    candidates.push({ line, snippet });
    if (candidates.length >= 3) break;
  }
  return candidates;
}

export function buildReplaceFailure(path, text, oldString, newline) {
  const adaptedOld = normalizeNewlines(oldString, newline);
  const lfText = toLf(text);
  const lfOld = toLf(oldString);
  const reasons = [];

  if (!text.includes(oldString) && text.includes(adaptedOld)) {
    reasons.push("crlf_mismatch");
  }
  if (!text.includes(oldString) && !text.includes(adaptedOld) && lfText.includes(lfOld)) {
    reasons.push("line_ending_normalization_required");
  }
  if (collapseWhitespace(text).includes(collapseWhitespace(oldString)) && !text.includes(oldString)) {
    reasons.push("whitespace_mismatch");
  }

  const exactCount = findOccurrences(text, oldString).length;
  const adaptedCount = findOccurrences(text, adaptedOld).length;
  const lfCount = findOccurrences(lfText, lfOld).length;
  const collisionCount = Math.max(exactCount, adaptedCount, lfCount);

  if (collisionCount > 1) {
    const search = exactCount > 0 ? oldString : adaptedCount > 0 ? adaptedOld : lfOld;
    const searchText = exactCount > 0 || adaptedCount > 0 ? text : lfText;
    const occurrences = findOccurrences(searchText, search).map((index) => {
      const { snippet, line } = snippetAround(searchText, index, 1);
      return { line, snippet };
    });
    throw new EditError(`old_string appears ${collisionCount} times; set replace_all=true or make old_string unique`, {
      path,
      reason: "duplicate_match",
      reasons,
      occurrences,
      file_newline: newline === "\r\n" ? "crlf" : newline === "\r" ? "cr" : "lf",
    });
  }

  throw new EditError("old_string not found", {
    path,
    reason: reasons[0] ?? "no_match",
    reasons,
    file_newline: newline === "\r\n" ? "crlf" : newline === "\r" ? "cr" : "lf",
    old_string_newlines: oldString.includes("\r\n") ? "crlf" : "lf",
    candidates: findCandidates(text, oldString),
    hint:
      reasons.includes("crlf_mismatch") || reasons.includes("line_ending_normalization_required")
        ? "Retry with utf8_edit_lines using line numbers, or ensure old_string uses the file's line endings."
        : "Use utf8_edit_lines with start_line/end_line, or widen old_string with more surrounding context.",
  });
}

export function buildDiff(text, matchIndex, oldString, newString) {
  const range = lineRangeAt(text, matchIndex, oldString.length);
  const removed = text.slice(matchIndex, matchIndex + oldString.length);
  const added = newString;
  const unified = [
    `@@ -${range.start_line},${range.end_line - range.start_line + 1} +${range.start_line},${toLf(newString).split("\n").length} @@`,
    ...removed
      .split(/\r\n|\n|\r/)
      .map((line) => `- ${line}`)
      .concat(added.split(/\r\n|\n|\r/).map((line) => `+ ${line}`)),
  ].join("\n");

  return {
    start_line: range.start_line,
    end_line: range.end_line,
    removed,
    added,
    unified,
  };
}
