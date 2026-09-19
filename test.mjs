import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { replaceInFile, verifyFile, writeFile } from "./lib/fileOps.js";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "utf8-file-ops-mcp-"));
const filePath = path.join(dir, "sample.ts");

writeFile(filePath, 'export const greeting = "hello";\n');
if (verifyFile(filePath).status !== "ok") {
  throw new Error("write verification failed");
}

replaceInFile(filePath, "hello", "world");
if (fs.readFileSync(filePath, "utf8") !== 'export const greeting = "world";\n') {
  throw new Error("replace verification failed");
}

const crlfPath = path.join(dir, "crlf.tsx");
const crlfContent = "<div>\r\n  <span>OLD</span>\r\n</div>\r\n";
fs.writeFileSync(crlfPath, crlfContent, "utf8");
replaceInFile(crlfPath, "<div>\n  <span>OLD</span>\n</div>\n", "<div>\n  <span>NEW</span>\n</div>\n");
const crlfResult = fs.readFileSync(crlfPath, "utf8");
if (!crlfResult.includes("NEW") || !crlfResult.includes("\r\n")) {
  throw new Error("CRLF multi-line replace failed");
}

const badPath = path.join(dir, "bad.ts");
const utf16 = Buffer.from(
  "69 00 6d 00 70 00 6f 00 72 00 74 00 20 00 78 00 0a 00"
    .split(" ")
    .map((value) => Number.parseInt(value, 16))
);
fs.writeFileSync(badPath, utf16);

const fixed = verifyFile(badPath, true);
if (fixed.status !== "fixed") {
  throw new Error("utf-16 fix failed");
}

if (fs.readFileSync(badPath).subarray(0, 6).toString("hex") !== "696d706f7274") {
  throw new Error("utf-16 bytes not converted to utf-8");
}

console.log("All tests passed");
