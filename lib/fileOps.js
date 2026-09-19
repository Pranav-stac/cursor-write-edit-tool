import fs from "node:fs";
import path from "node:path";
import { EditError } from "./errors.js";
import { joinLfLines, lineRangeAt, splitLfLines, snippetAround } from "./lines.js";
import { buildDiff, buildReplaceFailure, findReplacement } from "./match.js";
import { detectNewline, normalizeNewlines, toLf } from "./text.js";

export function looksLikeUtf16(raw) {
  if (
    (raw.length >= 2 && raw[0] === 0xff && raw[1] === 0xfe) ||
    (raw[0] === 0xfe && raw[1] === 0xff)
  ) {
    return true;
  }

  if (raw.length < 4) return false;

  const sample = raw.subarray(0, Math.min(raw.length, 200));
  if (sample.length % 2 !== 0) return false;

  let zerosAtOdd = 0;
  for (let i = 1; i < sample.length; i += 2) {
    if (sample[i] === 0) zerosAtOdd += 1;
  }

  return zerosAtOdd >= Math.max(3, sample.length / 2 * 0.6);
}

export function readTextWithFallback(filePath) {
  const raw = fs.readFileSync(filePath);

  if (raw.length === 0) {
    return { text: "", newline: "\n" };
  }

  if (raw[0] === 0xff && raw[1] === 0xfe) {
    const text = raw.subarray(2).toString("utf16le");
    return { text, newline: detectNewline(text) };
  }

  if (raw[0] === 0xfe && raw[1] === 0xff) {
    const swapped = Buffer.alloc(raw.length - 2);
    for (let i = 2; i < raw.length; i += 2) {
      swapped[i - 2] = raw[i + 1];
      swapped[i - 1] = raw[i];
    }
    const text = swapped.toString("utf16le");
    return { text, newline: detectNewline(text) };
  }

  if (looksLikeUtf16(raw)) {
    const text = raw.toString("utf16le");
    return { text, newline: detectNewline(text) };
  }

  const text = raw.toString("utf8");
  return { text, newline: detectNewline(text) };
}

export function writeUtf8(filePath, text, newline = "\n") {
  const resolved = path.resolve(filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const normalized = normalizeNewlines(text, newline);
  fs.writeFileSync(resolved, normalized, { encoding: "utf8" });
  return resolved;
}

function resolvePath(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new EditError(`File not found: ${resolved}`, { path: resolved, reason: "file_not_found" });
  }
  return resolved;
}

export function writeFile(filePath, contents, newlineMode = "auto") {
  const resolved = path.resolve(filePath);
  const previous = fs.existsSync(resolved) ? readTextWithFallback(resolved) : null;
  let newline = "\n";

  if (newlineMode === "auto" && previous) {
    newline = previous.newline;
  } else if (newlineMode === "crlf") {
    newline = "\r\n";
  } else if (newlineMode === "cr") {
    newline = "\r";
  }

  writeUtf8(resolved, contents, newline);
  const result = {
    path: resolved,
    chars: contents.length,
    encoding: "utf-8",
    operation: previous ? "overwrite" : "create",
  };

  if (previous) {
    result.diff = {
      start_line: 1,
      end_line: splitLfLines(previous.text).length,
      removed: previous.text,
      added: normalizeNewlines(contents, newline),
      unified: buildDiff(previous.text, 0, previous.text, normalizeNewlines(contents, newline)).unified,
    };
  }

  return result;
}

function replaceText(text, oldString, newString, replaceAll, path) {
  const count = text.split(oldString).length - 1;
  if (count === 0) {
    buildReplaceFailure(path, text, oldString, detectNewline(text));
  }

  if (!replaceAll && count > 1) {
    const occurrences = [];
    let index = text.indexOf(oldString);
    while (index !== -1) {
      const { snippet, line } = snippetAround(text, index, 1);
      occurrences.push({ line, snippet });
      index = text.indexOf(oldString, index + oldString.length);
    }
    throw new EditError(
      `old_string appears ${count} times; set replace_all=true or make old_string unique`,
      {
        path,
        reason: "duplicate_match",
        occurrences,
      }
    );
  }

  const matchIndex = text.indexOf(oldString);
  const updated = replaceAll
    ? text.split(oldString).join(newString)
    : text.replace(oldString, newString);

  return {
    updated,
    count: replaceAll ? count : 1,
    matchIndex,
    diff: buildDiff(text, matchIndex, oldString, newString),
  };
}

export function replaceInFile(filePath, oldString, newString, replaceAll = false) {
  const resolved = resolvePath(filePath);
  const { text, newline } = readTextWithFallback(resolved);
  const match = findReplacement(text, oldString, newString, newline);

  if (!match) {
    buildReplaceFailure(resolved, text, oldString, newline);
  }

  const { updated, count, diff } = replaceText(
    match.searchText,
    match.searchOld,
    match.searchNew,
    replaceAll,
    resolved
  );

  writeUtf8(resolved, updated, newline);

  return {
    path: resolved,
    replacements: count,
    encoding: "utf-8",
    match_strategy: match.name,
    diff,
  };
}

export function editLines(filePath, startLine, endLine, newString) {
  const resolved = resolvePath(filePath);
  const { text, newline } = readTextWithFallback(resolved);
  const lines = splitLfLines(text);

  if (startLine < 1 || endLine < startLine || endLine > lines.length) {
    throw new EditError("Invalid line range", {
      path: resolved,
      reason: "invalid_line_range",
      start_line: startLine,
      end_line: endLine,
      file_lines: lines.length,
    });
  }

  const removed = lines.slice(startLine - 1, endLine).join("\n");
  const replacementLines = splitLfLines(newString);
  const updatedLines = [
    ...lines.slice(0, startLine - 1),
    ...replacementLines,
    ...lines.slice(endLine),
  ];
  const updated = joinLfLines(updatedLines, newline);
  writeUtf8(resolved, updated, newline);

  const diff = {
    start_line: startLine,
    end_line: endLine,
    removed,
    added: newString,
    unified: [
      `@@ -${startLine},${endLine - startLine + 1} +${startLine},${replacementLines.length} @@`,
      ...removed.split("\n").map((line) => `- ${line}`),
      ...replacementLines.map((line) => `+ ${line}`),
    ].join("\n"),
  };

  return {
    path: resolved,
    encoding: "utf-8",
    operation: "edit_lines",
    diff,
  };
}

export function applyPatch(filePath, patch) {
  const resolved = resolvePath(filePath);
  const { text, newline } = readTextWithFallback(resolved);
  const lines = splitLfLines(text);
  const patchLines = toLf(patch).split("\n");
  const hunkHeader = patchLines.find((line) => line.startsWith("@@"));
  if (!hunkHeader) {
    throw new EditError("Invalid patch: missing @@ hunk header", {
      path: resolved,
      reason: "invalid_patch",
    });
  }

  const match = hunkHeader.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
  if (!match) {
    throw new EditError("Invalid patch hunk header", { path: resolved, reason: "invalid_patch" });
  }

  const oldStart = Number.parseInt(match[1], 10);
  const oldCount = Number.parseInt(match[2] ?? "1", 10);
  const bodyStart = patchLines.indexOf(hunkHeader) + 1;
  const removed = [];
  const added = [];

  for (let i = bodyStart; i < patchLines.length; i++) {
    const line = patchLines[i];
    if (line.startsWith("@@")) break;
    if (line.startsWith("-")) removed.push(line.slice(1));
    else if (line.startsWith("+")) added.push(line.slice(1));
    else if (line.startsWith(" ")) {
      removed.push(line.slice(1));
      added.push(line.slice(1));
    }
  }

  const endLine = oldStart + oldCount - 1;
  const current = lines.slice(oldStart - 1, endLine).join("\n");
  const expectedRemoved = removed.join("\n");
  if (current !== expectedRemoved) {
    throw new EditError("Patch context does not match file", {
      path: resolved,
      reason: "patch_context_mismatch",
      start_line: oldStart,
      end_line: endLine,
      expected_removed: expectedRemoved,
      actual_removed: current,
      candidates: [{ line: oldStart, snippet: snippetAround(text, 0, 0).snippet }],
      hint: "Use utf8_edit_lines with explicit line numbers instead.",
    });
  }

  return editLines(resolved, oldStart, endLine, added.join("\n"));
}

export function batchEdit(operations) {
  const results = [];
  for (const [index, operation] of operations.entries()) {
    try {
      let result;
      switch (operation.type) {
        case "write":
          result = writeFile(operation.path, operation.contents, operation.newline ?? "auto");
          break;
        case "replace":
          result = replaceInFile(
            operation.path,
            operation.old_string,
            operation.new_string,
            operation.replace_all ?? false
          );
          break;
        case "edit_lines":
          result = editLines(
            operation.path,
            operation.start_line,
            operation.end_line,
            operation.new_string
          );
          break;
        case "patch":
          result = applyPatch(operation.path, operation.patch);
          break;
        default:
          throw new EditError(`Unknown operation type: ${operation.type}`, {
            index,
            reason: "unknown_operation",
          });
      }
      results.push({ index, ok: true, ...result });
    } catch (error) {
      results.push({
        index,
        ok: false,
        error: error.message,
        ...(error.details ?? {}),
      });
      break;
    }
  }

  return {
    ok: results.every((item) => item.ok),
    results,
  };
}

export function verifyFile(filePath, fix = false) {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new EditError(`File not found: ${resolved}`, { path: resolved, reason: "file_not_found" });
  }

  const raw = fs.readFileSync(resolved);

  if (raw.length === 0) {
    return { path: resolved, status: "ok", detail: "empty", fixed: false };
  }

  if (looksLikeUtf16(raw)) {
    if (!fix) {
      return { path: resolved, status: "bad", detail: "utf-16 detected", fixed: false };
    }

    const { text, newline } = readTextWithFallback(resolved);
    writeUtf8(resolved, text, newline);
    return { path: resolved, status: "fixed", detail: "utf-16 -> utf-8", fixed: true };
  }

  try {
    raw.toString("utf8");
    return { path: resolved, status: "ok", detail: "utf-8", fixed: false };
  } catch (error) {
    if (!fix) {
      return {
        path: resolved,
        status: "bad",
        detail: `not valid utf-8: ${error.message}`,
        fixed: false,
      };
    }

    const { text, newline } = readTextWithFallback(resolved);
    writeUtf8(resolved, text, newline);
    return { path: resolved, status: "fixed", detail: "re-encoded to utf-8", fixed: true };
  }
}
