#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { replaceInFile, verifyFile, writeFile } from "./lib/fileOps.js";

const server = new McpServer({
  name: "cursor-write-edit-tool",
  version: "1.0.1",
});

function textResult(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function errorResult(error) {
  return {
    isError: true,
    content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
  };
}

server.registerTool(
  "utf8_write",
  {
    description:
      "Create or overwrite a file as UTF-8 (no BOM). Use instead of Cursor Write on Windows.",
    inputSchema: {
      path: z.string().describe("Absolute path to the file"),
      contents: z.string().describe("Full file contents"),
      newline: z
        .enum(["auto", "lf", "crlf", "cr"])
        .optional()
        .describe("Line ending style (default: auto)"),
    },
  },
  async ({ path, contents, newline = "auto" }) => {
    try {
      const result = writeFile(path, contents, newline);
      return textResult({ ok: true, ...result });
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "utf8_replace",
  {
    description:
      "Replace text in an existing file and save as UTF-8. Use instead of Cursor StrReplace on Windows.",
    inputSchema: {
      path: z.string().describe("Absolute path to the file"),
      old_string: z.string().describe("Exact text to find"),
      new_string: z.string().describe("Replacement text"),
      replace_all: z
        .boolean()
        .optional()
        .describe("Replace all occurrences (default: false)"),
    },
  },
  async ({ path, old_string, new_string, replace_all = false }) => {
    try {
      const result = replaceInFile(path, old_string, new_string, replace_all);
      return textResult({ ok: true, ...result });
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "utf8_verify",
  {
    description: "Check whether a file is valid UTF-8 and optionally fix UTF-16 corruption.",
    inputSchema: {
      path: z.string().describe("Absolute path to the file"),
      fix: z.boolean().optional().describe("Re-save as UTF-8 if corrupted (default: false)"),
    },
  },
  async ({ path, fix = false }) => {
    try {
      const result = verifyFile(path, fix);
      return textResult({ ok: result.status !== "bad", ...result });
    } catch (error) {
      return errorResult(error);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
