# ATL-006 — sourced jurisdiction status on every public identity surface

ATL-006 makes `jurisdiction-status/v1` the public identity contract rather than
leaving it as a database-only safeguard. The closed 253-entry catalog now
drives the country directory, global and homepage search, Compare selection,
not-found suggestions, country jump controls, and sitemap. Sovereign-state
analytical universes remain available through the separate fail-closed query.

Country mastheads and Compare cards expose the record-specific label, neutral
note, review date, countability rule, administering relationship, and source
links. The Atlas map keeps its map-eligible sovereign-state universe but names
that scope and links to the full catalog. Structured data emits schema.org
`Country` only for the closed sovereign class and neutral `Place` nodes for
other sourced identities. General country APIs accept an optional status
filter and return the full status object; country JSON/CSV research exports
carry the same metadata and source links.

Sensitive browser fixtures covered Cook Islands, West Bank, Falkland Islands
(Islas Malvinas), Antarctica, Japan, the country directory, Compare, and Atlas.
The 253 directory labels and the desktop/mobile profile disclosures produced no
horizontal page overflow. The opened mobile disclosure remained inside the
viewport after the responsive alignment correction.

Focused validation:

```text
npx tsc --noEmit
npm run validate:jurisdiction-status
npm run validate:api-docs
npm run validate:design-tokens
npm run validate:atlas-surface-data-matrix
node --import tsx --test \
  src/lib/jurisdictions/status-presentation.test.ts \
  src/lib/seo/__tests__/jurisdiction-jsonld.test.ts \
  src/lib/exports/country-research-export.test.ts \
  src/lib/api/contract/__tests__/contract.test.ts
```

Live API evidence confirmed two associated states, a 253-row default catalog,
the sourced Palestine status, and full Cook Islands status metadata in JSON
and CSV exports. No outreach, deployment, or database migration occurred.

Final release evidence:

```text
npm run validate:index-change-control:run
  949 tests passed; all eight declared Index validations passed
  version: civica-index-atlas-jurisdiction-status-presentation-v26
  snapshot: a6077f3c46321b7469fc683c3a7e534e2b5baf61187d42b11b21207f63aa120c

npm run build
  949 tests passed
  105/105 static pages generated
  all data, rights, research, claims, documentation, and metadata gates passed
```

The first build attempt exposed a formatting-sensitive DAT-031 source guard:
the protected live-fallback ternary had been line-wrapped without changing its
meaning. Restoring the validator-recognized expression made the focused gate
and the complete build pass. The build retained the pre-existing Turbopack
whole-project tracing warning from `next.config.ts`; ATL-006 introduced no new
build warning.
