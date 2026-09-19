# Cursor Write Edit Tool

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=cursor-write-edit-tool&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImdpdGh1YjpQcmFuYXYtc3RhYy9jdXJzb3Itd3JpdGUtZWRpdC10b29sIl19)

An MCP server for **Cursor** that writes and edits files as UTF-8 on Windows.

## Why I built this

I was hitting a frustrating issue on **Windows** with **Cursor's** built-in Agent `Write` and `StrReplace` tools — files were sometimes saved as **UTF-16** instead of UTF-8. That broke builds (`SyntaxError`, `illegal character '\0'`, etc.) and wasted time fixing corrupted source files.

So I made this tool. It uses **MCP** to write and edit files directly as UTF-8. In my experience it works well and fixes the encoding problem.

**One drawback:** you usually **can't see the edits inline** in Cursor the same way you do with the built-in Write/StrReplace diff view. The file changes on disk, but Cursor may not show a nice side-by-side preview of what changed.

**Line endings:** Windows files often use `CRLF` while the agent sends `LF`. `utf8_replace` now normalizes line endings before matching, so multi-line JSX/TSX edits should work. If a replace still fails, use `utf8_write` to rewrite the full file.

## Tools

| Tool | Use when | Description |
|------|----------|-------------|
| `utf8_edit_lines` | Multi-line JSX/TSX | Replace lines by number (no unique `old_string` needed) |
| `utf8_replace` | Small text swaps | EOL-aware replace; returns diff; rich errors on failure |
| `utf8_batch` | Many edits | Several write/replace/edit ops in one call |
| `utf8_patch` | Unified diff | Apply a single `@@` hunk |
| `utf8_write` | New files / full rewrite | UTF-8 write; returns diff when overwriting |
| `utf8_verify` | Encoding check | Detect/fix UTF-16 corruption |

**MCP server id in Cursor:** `user-cursor-write-edit-tool`

## Requirements

- Node.js 18+
- Cursor with MCP support
- **Windows** (this is mainly for the Cursor UTF-16 write bug on Windows)

## Install in Cursor

### One-click install

1. Click **Add to Cursor** above
2. Approve the install prompt
3. Restart Cursor if the tools do not appear immediately

No clone or manual `mcp.json` editing required — it runs via `npx` from GitHub.

### Manual install

Add to `~/.cursor/mcp.json` (global) or `.cursor/mcp.json` (project):

```json
{
  "mcpServers": {
    "cursor-write-edit-tool": {
      "command": "npx",
      "args": ["-y", "github:Pranav-stac/cursor-write-edit-tool"]
    }
  }
}
```

Restart Cursor after saving.

## Agent usage

Prefer this MCP for **source files on Windows**. If `utf8_replace` fails twice, use `utf8_edit_lines` with line numbers. Built-in Write/StrReplace are fine as a fallback.

Tool results include a `diff` field (`removed` / `added` / `unified`) — show that to the user since inline diffs may not appear.

### Write a file

```json
{
  "path": "C:\\project\\src\\app.ts",
  "contents": "export const app = 'ok';\n"
}
```

### Replace text

```json
{
  "path": "C:\\project\\src\\app.ts",
  "old_string": "'ok'",
  "new_string": "'ready'",
  "replace_all": false
}
```

On failure you get `reason`, `candidates` (line + snippet), and hints — not just `old_string not found`.

### Edit by line range (best for multi-line JSX)

```json
{
  "path": "C:\\project\\src\\page.tsx",
  "start_line": 42,
  "end_line": 48,
  "new_string": "<section>\n  <h1>Title</h1>\n</section>"
}
```

### Verify / fix encoding

```json
{
  "path": "C:\\project\\src\\app.ts",
  "fix": true
}
```

## Revert limitations

This tool writes files **directly to disk** through MCP. That means:

| Action | Works? |
|--------|--------|
| Cursor Agent **Revert** button in chat | **Usually no** — MCP edits are not tracked like built-in Write/StrReplace |
| Editor **Undo** (Ctrl+Z) | **Sometimes** — only if the file is open and you undo right away |
| **Git** revert / restore | **Yes** — recommended |
| Cursor **Local History** / Timeline | **Often yes** |

**Use git carefully.** Commit or stash before long agent sessions. Do not rely on Cursor's revert for MCP-made changes.

```bash
git add -A && git commit -m "checkpoint before agent session"
```

If something goes wrong:

```bash
git restore .
# or
git checkout -- path/to/file
```

## Development

```bash
git clone https://github.com/Pranav-stac/cursor-write-edit-tool.git
cd cursor-write-edit-tool
npm install
npm test
npm start
```

## License

MIT
