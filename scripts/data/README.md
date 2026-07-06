# `scripts/data/`

Checked-in source-data extracts consumed by ingest scripts.

## `vparty-positions-v2.csv`

A slim extract of the **V-Dem V-Party v2** dataset (the frozen Feb-2022 academic
release, coverage 1970–2019), consumed by `scripts/ingest-vparty-positions.ts`
(`npm run ingest:vparty`) to attach ideology positions to Civica's
`legislature_parties`. Contract: `plan/party-ideology-sourcing-resolution-v1.md`.

- **Source dataset:** V-Party v2, bundled by the `vdemdata` R package
  (`github.com/vdeminstitute/vdemdata`, `data/vparty.RData`) — the resolution's
  documented access path (§2.2). V-Party's canonical download is
  <https://www.v-dem.net/data/v-party-dataset/>.
- **License:** CC-BY-SA — commercial use allowed with attribution + share-alike
  (source id `vparty`).
- **Identity crosswalk:** V-Party party identity **is** Party Facts (Döring &
  Regel 2019); `v2paid` = the Party Facts core id. The `aliases` column folds in
  every historical / alternate / short name that Party Facts records for each
  core party (from the open external-parties CSV,
  <https://partyfacts.herokuapp.com/download/external-parties-csv/>). Those
  aliases are what let the matcher recover post-2019 party renames (e.g.
  "National Rally" ↔ the party V-Party coded as "Front National").

### Rows and columns

One row per V-Party party at its **most recent coded year** that carries **both**
compass axes:

| Column | V-Party variable | Meaning |
|---|---|---|
| `v2paid` | `v2paid` | Numeric party id (= Party Facts core id) |
| `country_text_id` | `country_text_id` | ISO3 country code |
| `v2paenname` | `v2paenname` | Harmonized English name |
| `v2paorname` | `v2paorname` | Harmonized original-language name |
| `v2pashname` | `v2pashname` | Harmonized short name / abbreviation |
| `aliases` | Party Facts | ` \| `-delimited alternate names for the core id |
| `year` | `year` | The coded election year the position is from |
| `v2pariglef` | `v2pariglef` | Economic left–right (interval; compass X) |
| `v2pariglef_ord` | `v2pariglef_ord` | Economic L–R 0–6 ordinal bucket |
| `v2xpa_antiplural` | `v2xpa_antiplural` | Anti-Pluralism Index 0–1 (compass Y) |
| `v2xpa_popul` | `v2xpa_popul` | Populism Index 0–1 (optional) |

### Regenerating

The extract is produced from `vparty.RData` (any tool that reads R data frames —
e.g. R itself, or Python `pyreadr` — plus the Party Facts external-parties CSV).
Because V-Party v2 is a fixed vintage, the extract only changes if V-Dem ships a
new V-Party release; the ingest is otherwise a re-runnable, idempotent curation
pass.
