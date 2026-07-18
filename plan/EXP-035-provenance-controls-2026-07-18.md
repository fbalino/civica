# EXP-035 — Precise and accessible provenance controls

## Scope

Upgrade the canonical `<SourceDot>` instead of adding page-local provenance
markers. The compact control must retain five distinct facts in both the
keyboard-accessible name and the CSS tooltip:

1. source name;
2. source update state (live, frozen, experimental, or unknown);
3. exact source timestamp, preserving date-only precision where that is all
   the surface received;
4. upstream vintage, or an explicit statement that the surface did not supply
   one; and
5. rights status, including a pending state rather than an inferred license.

## Boundary

The authoritative machine-readable rights registry remains
`src/lib/rights/manifest.ts` / `/api/rights-manifest`. That module deliberately
depends on server-only release-input validation, so the compact client-safe
disclosure lists only the source terms already verified there. Every other
source is rendered as rights-pending; this does not imply public reuse.

## Verification plan

- pure fixture: exact UTC timestamp, date-only timestamp, malformed/missing
  timestamp, verified rights, pending rights, and experimental/missing-vintage
  state;
- type check and design-token validator;
- browser: the canonical `/design-system` examples render exact timestamp,
  rights, frozen, experimental, and keyboard-focus behavior in light and dark
  themes;
- update both master-checklist mirrors, `plan/PROGRESS.md`, and the evidence
  directory only after those checks pass.
