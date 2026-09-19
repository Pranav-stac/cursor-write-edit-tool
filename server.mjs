#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  applyPatch,
  batchEdit,
  editLines,
  replaceInFile,
  verifyFile,
  writeFile,
} from "./lib/fileOps.js";

const server = new McpServer({
  name: "cursor-write-edit-tool",
  version: "1.1.0",
});

function textResult(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

function errorResult(error) {
  const payload =
    error?.details
      ? { ok: false, error: error.message, ...error.details }
      : { ok: false, error: error instanceof Error ? error.message : String(error) };
  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
  };
}

server.registerTool(
  "utf8_write",
  {
    description:
      "Create or overwrite a file as UTF-8 (no BOM). Prefer on Windows over Cursor Write. Returns a diff when overwriting.",
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
      return textResult({ ok: true, ...writeFile(path, contents, newline) });
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "utf8_replace",
  {
    description:
      "Replace text in a file as UTF-8. EOL-aware matching (CRLF/LF). Returns diff and rich errors with line numbers on failure.",
    inputSchema: {
      path: z.string().describe("Absolute path to the file"),
      old_string: z.string().describe("Text to find"),
      new_string: z.string().describe("Replacement text"),
      replace_all: z.boolean().optional().describe("Replace all occurrences (default: false)"),
    },
  },
  async ({ path, old_string, new_string, replace_all = false }) => {
    try {
      return textResult({ ok: true, ...replaceInFile(path, old_string, new_string, replace_all) });
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "utf8_edit_lines",
  {
    description:
      "Replace a line range (1-based, inclusive) without needing a unique old_string. Best for multi-line JSX/TSX on Windows.",
    inputSchema: {
      path: z.string().describe("Absolute path to the file"),
      start_line: z.number().int().positive().describe("First line to replace (1-based)"),
      end_line: z.number().int().positive().describe("Last line to replace (1-based, inclusive)"),
      new_string: z.string().describe("Replacement text for that line range"),
    },
  },
  async ({ path, start_line, end_line, new_string }) => {
    try {
      return textResult({ ok: true, ...editLines(path, start_line, end_line, new_string) });
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "utf8_patch",
  {
    description: "Apply a single unified-diff hunk to a file. Use utf8_edit_lines if patch context fails.",
    inputSchema: {
      path: z.string().describe("Absolute path to the file"),
      patch: z.string().describe("Unified diff hunk with @@ header and +/- lines"),
    },
  },
  async ({ path, patch }) => {
    try {
      return textResult({ ok: true, ...applyPatch(path, patch) });
    } catch (error) {
      return errorResult(error);
    }
  }
);

server.registerTool(
  "utf8_batch",
  {
    description: "Run multiple write/replace/edit_lines/patch operations in one call. Stops on first failure.",
    inputSchema: {
      operations: z
        .array(
          z.object({
            type: z.enum(["write", "replace", "edit_lines", "patch"]),
            path: z.string(),
            contents: z.string().optional(),
            old_string: z.string().optional(),
            new_string: z.string().optional(),
            replace_all: z.boolean().optional(),
            start_line: z.number().int().positive().optional(),
            end_line: z.number().int().positive().optional(),
            patch: z.string().optional(),
            newline: z.enum(["auto", "lf", "crlf", "cr"]).optional(),
          })
        )
        .describe("Ordered list of edit operations"),
    },
  },
  async ({ operations }) => {
    try {
      return textResult(batchEdit(operations));
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
      return textResult({ ok: true, ...verifyFile(path, fix) });
    } catch (error) {
      return errorResult(error);
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
