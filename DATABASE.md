# PCM save database reference

Pro Cycling Manager stores a career as a binary `.cdb` file. This server converts
it to an in-memory SQLite database on every call via `cdb-converter` (`cdbToSql`).

## Table prefixes

The prefix of a table name tells you what it holds:

| Prefix         | Meaning     | Contents                                                                  | Examples                                                                                     |
| -------------- | ----------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `DYN_`         | **Dynamic** | Career state that mutates as the career is played — the actual save data  | `DYN_cyclist`, `DYN_team`, `DYN_contract_cyclist`, `DYN_finance`, `DYN_transfer`, `DYN_news` |
| `STA_`         | **Static**  | Reference/lookup catalogs and enums, largely constant across a career     | `STA_country`, `STA_division`, `STA_race`, `STA_type_rider`, `STA_stage`                     |
| `GAM_`         | **Game**    | Career session config and player state                                    | `GAM_config`, `GAM_user`, `GAM_career_data`, `GAM_calendar_event`                            |
| `INF_`         | Preset      | Rare preset table                                                         | `INF_contract_preference_preset`                                                             |
| `DB_STRUCTURE` | Meta        | Lists every table; used to validate table names before interpolating them | —                                                                                            |

This `DYN_` vs `STA_` split is what drives the display-column rule below.

## Column naming encodes the type

The prefix of a _column_ name tells you its type:

| Column prefix         | Type                    | SQLite affinity |
| --------------------- | ----------------------- | --------------- |
| `_i_` / `fkID` / `ID` | integer                 | `INTEGER`       |
| `_sz_`                | string                  | `TEXT`          |
| `_f_`                 | float                   | `REAL`          |
| `_b_`                 | boolean                 | `NUMERIC`       |
| `_ilist_`             | serialized list of ints | `TEXT`          |

Note that `cdb-converter` appends a numeric offset to the declared type
(e.g. `INTEGER 499717`), so match on affinity / `startsWith`, not equality.

## Foreign keys

Foreign keys follow `fkID{Suffix}` → `{DYN|STA|GAM}_{Suffix}`, joined on the
target table's `ID{Suffix}`. The suffix is _semantic_, not literal, so watch for
exceptions:

- `fkIDteam_duplicate` → `DYN_team` (`IDteam`)
- `fkIDnextdivision` → `STA_division` (`IDdivision`)
- `fkIDfirst_stage` / `fkIDlast_stage` → `STA_stage`

All joins in the tools are hand-written — there is no generic FK resolver.

## Display columns for FK lookups

Which column carries a human-readable label depends on the table family:

- **Dynamic tables (`DYN_*`)** expose a name in `gene_sz_name` (e.g. `DYN_team`).
- **Static lookup tables (`STA_*`)** usually key off `CONSTANT` (an enum-like
  string, e.g. `STA_division`, `STA_type_rider`), with exceptions such as
  `STA_country.gene_sz_flag`.
- Columns named `gene_strID_*` are indices into a string table, **not** display
  strings.
