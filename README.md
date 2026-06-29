<p align="center">
  <img src="assets/icon.png" alt="PCM MCP" width="150" />
</p>

# Pro Cycling Manager MCP Server

A Model Context Protocol (MCP) server for querying Pro Cycling Manager (PCM) game databases. This server provides tools to discover and inspect PCM career save files via the MCP protocol, allowing AI assistants to explore your saves in a structured way.

This server is strictly **read-only**. PCM stores careers as binary `.cdb` files; this server discovers and inspects those saves but **never writes to or modifies them**. Save files are loaded into an in-memory SQLite database for querying, and changes are never written back to disk.

## Installation

### MCP Bundle

Download the latest `pcm-mcp.mcpb` from the [Releases page](https://github.com/mpicciolli/pcm-mcp/releases) and open it with **Claude for macOS or Windows**. An installation dialog will appear — no terminal required.

> **Note:** This method does not auto-update. To get a newer version, download and re-install the latest `.mcpb` from the Releases page.

### Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pcm-mcp": {
      "command": "npx",
      "args": ["-y", "pcm-mcp"]
    }
  }
}
```

### ChatGPT Desktop

Add the following to your ChatGPT MCP configuration file:

```json
{
  "mcpServers": {
    "pcm-mcp": {
      "command": "npx",
      "args": ["-y", "pcm-mcp"]
    }
  }
}
```

### Gemini

Add the following to your Gemini CLI settings file:

```json
{
  "mcpServers": {
    "pcm-mcp": {
      "command": "npx",
      "args": ["-y", "pcm-mcp"]
    }
  }
}
```

## Platform Support

PCM only ships on Windows, where careers live under:

```
%APPDATA%/Pro Cycling Manager <year>/Cloud/<profile>/
```

Auto-discovery via `pcm_list_saves` is therefore **Windows only**. On macOS/Linux the saves live inside a Wine/Proton prefix that can't be reliably located — pass an absolute `.cdb` path directly to `pcm_select_save` instead.

## Available Tools

All tools are read-only and carry `readOnlyHint: true`, so clients like Claude Desktop can approve them automatically without a confirmation prompt.

| Tool | Description |
| --- | --- |
| **pcm_list_saves** | Discover PCM `.cdb` career save files on this machine by scanning the `Pro Cycling Manager <year>/Cloud` folders under `%APPDATA%` (Windows only). Returns each save's absolute path, file name, last modified date and size (newest first). |
| **pcm_select_save** | Validate that an absolute path points to an existing `.cdb` save file and return its metadata. Stateless — keep the returned path in conversation context to pass to later tools. |
| **pcm_get_save_schema** | List every table inside a `.cdb` save file, with its ID and name, plus the total table count. |
| **pcm_get_table_schema** | Inspect a single table by name. Returns its columns (name, SQL type, NOT NULL and primary key flags) and its row count. Use `pcm_get_save_schema` first to discover available table names. |
| **pcm_get_player_info** | Get the active human player and their team from a save file. Returns the player login plus team details (name, resolved division name, resolved country name, evaluation and manager). |
| **pcm_search_cyclist** | Search for a cyclist by first name and/or last name (case-insensitive partial match). Returns up to 10 matches with all ratings (plain, mountain, medium mountain, downhilling, cobble, time trial, prologue, sprint, acceleration, endurance, resistance, recuperation, hill, baroudeur, current ability) and the resolved country name. `mediumMountain` and `currentAbility` are `null` on saves that pre-date those columns. |
| **pcm_get_team_roster** | List a team's roster (defaults to the active player's team when `teamId` is omitted). Joins DYN_cyclist with its active DYN_contract_cyclist and STA_type_rider; per rider returns name, country, age (derived from birth date and the current game date), rider type, overall ability, contract end year, wage, market value and all per-terrain ability ratings. Ordered by overall ability, highest first. Errors if `teamId` does not exist. |
| **pcm_search_team** | Search for a team by name (case-insensitive partial match against both the full name and short name). Returns up to 10 matches with the resolved division name, country name, evaluation and general manager. |
| **pcm_query_save** | Run a read-only SQL query (`SELECT` / `WITH … SELECT` only) against any table in a save file. Write/DDL statements are rejected. Results are capped (default 100, max 1000 rows). |
| **pcm_generate_startlist_xml** | Generate a PCM startlist XML document from a list of teams and their cyclist rosters. Looks up the race by `IDrace` in the save to derive the output file name from `STA_race.gene_sz_filename` (e.g. `c0_almeria.xml`), and returns both the file name and the XML as text. Team and cyclist IDs map to `DYN_team.IDteam` / `DYN_cyclist.IDcyclist` (look them up with `pcm_search_cyclist` or `pcm_query_save`). |

## Development

### Build

```bash
npm run build
```

Bundles `src/` to `dist/` with tsup (ESM output).

### Test

```bash
npm test
```

### Lint & Format

```bash
npm run lint     # Biome lint with autofixes
npm run format   # Biome formatter
```

### Pack a bundle

```bash
npm run pack     # produces pcm-mcp.mcpb
```
