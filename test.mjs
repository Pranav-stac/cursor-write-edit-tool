import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EditError } from "./lib/errors.js";
import {
  applyPatch,
  batchEdit,
  editLines,
  replaceInFile,
  verifyFile,
  writeFile,
} from "./lib/fileOps.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cursor-write-edit-tool-"));
const filePath = path.join(dir, "sample.ts");

writeFile(filePath, 'export const greeting = "hello";\n');
if (verifyFile(filePath).status !== "ok") throw new Error("write verification failed");

const replaced = replaceInFile(filePath, "hello", "world");
if (!replaced.diff?.added.includes("world")) throw new Error("replace diff missing");
if (fs.readFileSync(filePath, "utf8") !== 'export const greeting = "world";\n') {
  throw new Error("replace verification failed");
}

const crlfPath = path.join(dir, "crlf.tsx");
const crlfContent = "<div>\r\n  <span>OLD</span>\r\n</div>\r\n";
fs.writeFileSync(crlfPath, crlfContent, "utf8");
const crlfReplace = replaceInFile(
  crlfPath,
  "<div>\n  <span>OLD</span>\n</div>\n",
  "<div>\n  <span>NEW</span>\n</div>\n"
);
if (crlfReplace.match_strategy !== "file_newline" && crlfReplace.match_strategy !== "lf_normalized") {
  throw new Error(`unexpected match strategy: ${crlfReplace.match_strategy}`);
}
const crlfResult = fs.readFileSync(crlfPath, "utf8");
if (!crlfResult.includes("NEW") || !crlfResult.includes("\r\n")) {
  throw new Error("CRLF multi-line replace failed");
}

const linesPath = path.join(dir, "lines.tsx");
fs.writeFileSync(linesPath, "line1\r\nline2\r\nline3\r\n", "utf8");
editLines(linesPath, 2, 2, "changed");
if (fs.readFileSync(linesPath, "utf8") !== "line1\r\nchanged\r\nline3\r\n") {
  throw new Error("edit_lines failed");
}

try {
  replaceInFile(filePath, "does-not-exist", "x");
  throw new Error("expected rich not-found error");
} catch (error) {
  if (!(error instanceof EditError) || !error.details?.candidates) {
    throw new Error("rich not-found error missing candidates");
  }
}

const batch = batchEdit([
  {
    type: "replace",
    path: filePath,
    old_string: "world",
    new_string: "batch",
  },
  {
    type: "edit_lines",
    path: linesPath,
    start_line: 1,
    end_line: 1,
    new_string: "top",
  },
]);
if (!batch.ok || batch.results.length !== 2) throw new Error("batch edit failed");

const patchPath = path.join(dir, "patch.ts");
fs.writeFileSync(patchPath, "alpha\nbeta\ngamma\n", "utf8");
applyPatch(
  patchPath,
  "@@ -2,1 +2,1 @@\n-beta\n+bravo\n"
);
if (fs.readFileSync(patchPath, "utf8") !== "alpha\nbravo\ngamma\n") {
  throw new Error("patch apply failed");
}

const badPath = path.join(dir, "bad.ts");
const utf16 = Buffer.from(
  "69 00 6d 00 70 00 6f 00 72 00 74 00 20 00 78 00 0a 00"
    .split(" ")
    .map((value) => Number.parseInt(value, 16))
);
fs.writeFileSync(badPath, utf16);
if (verifyFile(badPath, true).status !== "fixed") throw new Error("utf-16 fix failed");

console.log("All tests passed");
