# utf8-file-ops-mcp

MCP server that writes and edits files as **UTF-8** on Windows.

Cursor's built-in Agent `Write` and `StrReplace` tools can save files as UTF-16 LE on Windows, which breaks Node, TypeScript, C#, Dart, Java, and other toolchains. This MCP server is a drop-in replacement.

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=utf8-file-ops&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImdpdGh1YjpQcmFuYXYtc3RhYy91dGY4LWZpbGUtb3BzLW1jcCJdfQ%3D%3D)

## Tools

| Tool | Replaces | Description |
|------|----------|-------------|
| `utf8_write` | Cursor `Write` | Create or overwrite a file as UTF-8 |
| `utf8_replace` | Cursor `StrReplace` | Search/replace in an existing file |
| `utf8_verify` | — | Check encoding; optionally fix UTF-16 corruption |

## Requirements

- Node.js 18+
- Cursor with MCP support

## Install in Cursor

### One-click install

1. Click **Add to Cursor** at the top of this README
2. Approve the install prompt in Cursor
3. Restart Cursor if the tools do not appear immediately

Uses `npx` to run from GitHub — no clone or manual `mcp.json` edit required.

### Manual install (GitHub)

Add to your Cursor MCP config.

**Global** (`~/.cursor/mcp.json` on macOS/Linux, `%USERPROFILE%\.cursor\mcp.json` on Windows):

```json
{
  "mcpServers": {
    "utf8-file-ops": {
      "command": "npx",
      "args": ["-y", "github:Pranav-stac/utf8-file-ops-mcp"]
    }
  }
}
```

**Project** (`.cursor/mcp.json` in your repo):

```json
{
  "mcpServers": {
    "utf8-file-ops": {
      "command": "npx",
      "args": ["-y", "github:Pranav-stac/utf8-file-ops-mcp"]
    }
  }
}
```

Restart Cursor after saving.

### Manual install (npm, when published)

```json
{
  "mcpServers": {
    "utf8-file-ops": {
      "command": "npx",
      "args": ["-y", "utf8-file-ops-mcp"]
    }
  }
}
```

### Manual install (local clone)

```bash
git clone https://github.com/Pranav-stac/utf8-file-ops-mcp.git
cd utf8-file-ops-mcp
npm install
```

```json
{
  "mcpServers": {
    "utf8-file-ops": {
      "command": "node",
      "args": ["C:\\path\\to\\utf8-file-ops-mcp\\server.mjs"]
    }
  }
}
```

## Agent usage

Tell your agent (or add a Cursor rule):

> On Windows, use the `utf8-file-ops` MCP tools (`utf8_write`, `utf8_replace`) instead of built-in Write/StrReplace for source files.

### Examples

**Write a file**

```json
{
  "path": "C:\\project\\src\\app.ts",
  "contents": "export const app = 'ok';\n"
}
```

**Replace text**

```json
{
  "path": "C:\\project\\src\\app.ts",
  "old_string": "'ok'",
  "new_string": "'ready'",
  "replace_all": false
}
```

**Verify / fix encoding**

```json
{
  "path": "C:\\project\\src\\app.ts",
  "fix": true
}
```

## Development

```bash
npm install
npm test
npm start
```

## Why this exists

On Windows, Cursor Agent file writes sometimes land as UTF-16 LE (often without BOM). Hex looks like `69 00 6D 00 70 00` instead of `69 6D 70` for `imp`. This MCP server always writes UTF-8.

## License

MIT
