# Cursor Write Edit Tool

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=cursor-write-edit-tool&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImdpdGh1YjpQcmFuYXYtc3RhYy9jdXJzb3Itd3JpdGUtZWRpdC10b29sIl19)

An MCP server for **Cursor** that writes and edits files as UTF-8 on Windows.

## Why I built this

I was hitting a frustrating issue on **Windows** with **Cursor's** built-in Agent `Write` and `StrReplace` tools — files were sometimes saved as **UTF-16** instead of UTF-8. That broke builds (`SyntaxError`, `illegal character '\0'`, etc.) and wasted time fixing corrupted source files.

So I made this tool. It uses **MCP** to write and edit files directly as UTF-8. In my experience it works well and fixes the encoding problem.

**One drawback:** you usually **can't see the edits inline** in Cursor the same way you do with the built-in Write/StrReplace diff view. The file changes on disk, but Cursor may not show a nice side-by-side preview of what changed.

## Tools

| Tool | Replaces | Description |
|------|----------|-------------|
| `utf8_write` | Cursor `Write` | Create or overwrite a file as UTF-8 |
| `utf8_replace` | Cursor `StrReplace` | Search/replace in an existing file |
| `utf8_verify` | — | Check encoding; optionally fix UTF-16 corruption |

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

Add a Cursor rule or tell your agent:

> On Windows, use the `cursor-write-edit-tool` MCP (`utf8_write`, `utf8_replace`) instead of built-in Write/StrReplace for source files.

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
