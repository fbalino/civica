# Main working-tree integration — protected Index contract (2026-08-09)

Owner-directed integration of the outstanding `codex/civica-academic-readiness`
working tree into `main`. Four protected Index files changed:

- `src/lib/pulse/v2/country-attribution.ts` (weight_or_model) — retained
  source-evidence context added to subject-country attribution.
- `src/lib/pulse/v2/classify.ts` (weight_or_model) — classification now
  records retained source evidence alongside votes.
- `src/lib/pulse/v2/runtime-contract.ts` (presentation) — runtime contract
  extended with the retained-source-evidence surface.
- `src/components/factbook/FactbookHeaderStrip.tsx` (presentation) — masthead
  updates from the EXP-015 tranche.

No score, weight, normalization, or published value changed; the Pulse
classification pipeline gains retained evidence recording, gated by the same
publication rules. The regenerated runtime-method contract hash is recorded in
`src/lib/pulse/v2/runtime-method.generated.json`. The change-specific validator
is `npm run validate:index-pulse-retained-evidence`.
