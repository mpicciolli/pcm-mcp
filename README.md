# Pro Cycling Manager MCP Server

A Model Context Protocol (MCP) server for querying Pro Cycling Manager (PCM) game databases. This server provides tools to discover and inspect PCM career save files via the MCP protocol, allowing AI assistants to explore your saves in a structured way.

## Read-Only Access

This server is strictly **read-only**. PCM stores careers as binary `.cdb` files; this server discovers and inspects those saves but **never writes to or modifies them**. Save files are loaded into an in-memory SQLite database for querying, and changes are never written back to disk.

## Available Tools

All tools are read-only and carry `readOnlyHint: true`, so clients like Claude Desktop can approve them automatically without a confirmation prompt.

| Tool                     | Description                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **pcm_list_saves**       | Discover PCM `.cdb` career save files on this machine by scanning the `Pro Cycling Manager <year>/Cloud` folders under `%APPDATA%` (Windows only). Returns each save's absolute path, file name, last modified date and size (newest first). |
| **pcm_select_save**      | Validate that an absolute path points to an existing `.cdb` save file and return its metadata. Stateless — keep the returned path in conversation context to pass to later tools.                                                            |
| **pcm_get_save_schema**  | List every table inside a `.cdb` save file, with its ID and name, plus the total table count.                                                                                                                                                |
| **pcm_get_table_schema** | Inspect a single table by name. Returns its columns (name, SQL type, NOT NULL and primary key flags) and its row count. Use `pcm_get_save_schema` first to discover available table names.                                                   |
| **pcm_get_player_info**  | Get the active human player and their team from a save file. Returns the player login plus team details (name, resolved division name, resolved country name, evaluation and manager).                                                       |
| **pcm_query_save**       | Run a read-only SQL query (`SELECT` / `WITH … SELECT` only) against any table in a save file. Write/DDL statements are rejected. Results are capped (default 100, max 1000 rows).                                                            |

## Installation

```bash
npm install
```

## Available Scripts

### Build

```bash
npm run build
```

Bundles `src/` to `dist/` with tsup (ESM output; `.d.ts` generation is currently disabled).

### Test

```bash
npm test
```

### Lint & Format

```bash
npm run lint
```

Runs Biome lint with autofixes (`biome lint --write .`).

```bash
npm run format
```

Formats the codebase with Biome (`biome format --write .`).

## Platform Support

PCM only ships on Windows, where careers live under:

```
%APPDATA%/Pro Cycling Manager <year>/Cloud/<profile>/
```

Auto-discovery via `list_saves` is therefore **Windows only**. On macOS/Linux the saves live inside a Wine/Proton prefix that can't be reliably located — pass an absolute `.cdb` path directly to `select_save` instead.

## Usage with Claude Desktop

Add the following configuration to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pcm-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/pcm-mcp/dist/index.js"]
    }
  }
}
```

The server communicates over stdio.
