---
name: pcm-startlist
description: >-
  Build a Pro Cycling Manager (PCM) race startlist and export it as the .xml
  file PCM imports. Use when the user wants to create, compose, or generate a
  startlist for a PCM race — picking which teams take part and which riders
  each team brings. Orchestrates the read-only PCM MCP tools (pcm_search_team,
  pcm_get_team_roster, pcm_get_player_info, pcm_search_cyclist, pcm_query_save)
  to gather data and pcm_generate_startlist_xml to produce the file. Use this
  whenever the user wants to decide who lines up for a PCM race, even if they
  never say the word "startlist" — e.g. "who's racing tomorrow's stage",
  "compose the field for race X", "entries for Paris-Roubaix". Triggers on
  phrases like "startlist", "start list", "field", "line-up", "entries for the
  race", "generate the xml file for race X".
---

# PCM startlist builder

Compose a startlist for a Pro Cycling Manager race and write the `.xml` file PCM
imports. This skill owns the *workflow* (find the race, choose teams, choose
riders); the deterministic serialization is delegated to the
`pcm_generate_startlist_xml` MCP tool — never hand-write the XML.

## Output format (for reference only — the tool emits this)

```xml
<startlist>
    <team id="34">
        <cyclist id="7602" />
        <cyclist id="5996" />
    </team>
</startlist>
```

`<team id>` = `DYN_team.IDteam`, `<cyclist id>` = `DYN_cyclist.IDcyclist`. The file
name is `STA_race.gene_sz_filename` + `.xml` (e.g. `c0_almeria.xml`) and is
returned by the tool — don't invent it.

The DB columns and the tool parameters use slightly different names; they map
one-to-one: `pcm_generate_startlist_xml`'s `raceId` is the `IDrace` value, each
team's `id` is its `IDteam`, and the entries in `cyclists` are `IDcyclist`
values. Resolve every name to one of these IDs before calling the tool.

## Workflow

### 1. Get a save path
Every step reads a `.cdb` save. If the user hasn't given an absolute `savePath`:
- Try `pcm_list_saves` (Windows only — fails on macOS/Linux Wine/Proton prefixes).
- Otherwise ask the user for the absolute `.cdb` path. Keep it in context; the
  tools are stateless and need it on every call.

### 2. Identify the race (get `IDrace`)
The user names a race; resolve it to an `IDrace` with `pcm_query_save`:

```sql
SELECT IDrace, gene_sz_race_name, gene_sz_filename
FROM STA_race
WHERE gene_sz_race_name LIKE '%almeria%';
```

If several match, show the candidates (name + id) and let the user pick. Confirm
the `gene_sz_filename` so the user knows the output file name up front.

### 3. Decide which teams take part
Either the user supplies the teams, or you propose them. Resolve names to
`IDteam` with `pcm_search_team` (case-insensitive partial match on full and short
name; returns the resolved division, country, evaluation and general manager —
handy for proposing a coherent field):

```
pcm_search_team(savePath, query: "ineos")
```

If the user means "my team", get it from `pcm_get_player_info`, which returns the
active human player's team. For raw control you can still query `DYN_team`
directly via `pcm_query_save`.

A typical startlist has ~18–25 teams. If the user just says "the usual teams",
ask which division/tier or list candidates rather than guessing.

### 4. Pick riders per team
A team's full squad is the candidate pool — a startlist usually brings **7** of
them (the count is free; the example pack mixes 6 and 7). Prefer
`pcm_get_team_roster`, which returns each rider's name, country, age, rider type,
overall ability, contract details and all per-terrain ratings in one call
(defaults to the active player's team when `teamId` is omitted):

```
pcm_get_team_roster(savePath, teamId: 34)
```

Use those ratings to pick riders that fit the race profile — favour the relevant
specialty: sprinters for flat finishes, climbers for mountain stages, cobble
specialists for the classics, etc. For ad-hoc lookups across teams use
`pcm_search_cyclist` (same ratings, searched by name); for full control fall back
to `pcm_query_save`. If the user has preferences (leaders, exclusions), apply
them. Confirm the selection before generating when there's any ambiguity.

On a big field, one `pcm_get_team_roster` call per team adds up to a lot of
round-trips. To narrow down a large field quickly, pull every candidate in a single
`pcm_query_save` over `DYN_cyclist WHERE fkIDteam IN (...)` (add the `charac_i_*`
rating columns you care about), then reserve the richer `pcm_get_team_roster`
for the teams you actually keep.

### 5. Generate the file
Call `pcm_generate_startlist_xml` with `savePath`, `raceId`, and `teams`:

```json
{
  "savePath": "/abs/path/Career.cdb",
  "raceId": 128,
  "teams": [
    { "id": 34, "cyclists": [7602, 5996, 1381, 3291, 6342, 3912, 5613] },
    { "id": 25, "cyclists": [6346, 8702, 17152, 15300, 7048, 6433, 15398] }
  ]
}
```

The tool returns `{ fileName, xml }`. If a team has no riders or `teams` is empty
the tool errors — fix the selection and retry.

### 6. Deliver
Present the returned `fileName` and `xml`. Offer to write it to disk (e.g. the
user's PCM `Startlists`/race-import folder or the working directory) — the MCP
server is read-only and does not write files, so saving is done outside it.

## Notes
- All PCM MCP tools are read-only; this workflow never modifies the save.
- IDs, not names, go into the XML — always resolve names to `IDteam`/`IDcyclist`
  via the queries above before calling the tool.
- Each `IDcyclist` must belong to the team it's listed under, and no rider should
  appear twice. The roster you pulled in step 4 is the source of truth for who is
  eligible under a given `IDteam` — don't mix riders across teams.
