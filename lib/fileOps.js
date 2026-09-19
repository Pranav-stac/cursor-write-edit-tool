import fs from "node:fs";
import path from "node:path";

function detectNewline(text) {
  if (text.includes("\r\n")) return "\r\n";
  if (text.includes("\n")) return "\n";
  if (text.includes("\r")) return "\r";
  return "\n";
}

function normalizeNewlines(text, newline) {
  const unified = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (newline === "\r\n") return unified.replace(/\n/g, "\r\n");
  if (newline === "\r") return unified.replace(/\n/g, "\r");
  return unified;
}

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

export function writeFile(filePath, contents, newlineMode = "auto") {
  const resolved = path.resolve(filePath);
  let newline = "\n";

  if (newlineMode === "auto" && fs.existsSync(resolved)) {
    newline = readTextWithFallback(resolved).newline;
  } else if (newlineMode === "crlf") {
    newline = "\r\n";
  } else if (newlineMode === "cr") {
    newline = "\r";
  }

  writeUtf8(resolved, contents, newline);
  return {
    path: resolved,
    chars: contents.length,
    encoding: "utf-8",
  };
}

export function replaceInFile(filePath, oldString, newString, replaceAll = false) {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
  }

  const { text, newline } = readTextWithFallback(resolved);

  if (!text.includes(oldString)) {
    throw new Error(`old_string not found in ${resolved}`);
  }

  const count = text.split(oldString).length - 1;
  if (!replaceAll && count > 1) {
    throw new Error(
      `old_string appears ${count} times; set replace_all=true or make old_string unique`
    );
  }

  const updated = replaceAll
    ? text.split(oldString).join(newString)
    : text.replace(oldString, newString);

  writeUtf8(resolved, updated, newline);

  return {
    path: resolved,
    replacements: replaceAll ? count : 1,
    encoding: "utf-8",
  };
}

export function verifyFile(filePath, fix = false) {
  const resolved = path.resolve(filePath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`File not found: ${resolved}`);
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
