# PLT-030 — current release stabilization

**Opened:** 2026-09-17
**Status:** complete — 2026-09-17; bounded release stabilization only.

The August 24 deployment stayed live because replacement builds were blocked by missing capital-cache values and the current dependency audit had critical findings.

## Capital data repair

The CIA seed retained government payloads and populated the capital cache, but omitted canonical capital facts. The nightly resolver correctly cleared caches with no canonical evidence, undoing the earlier cache-only repair. The authorized repair restores the retained evidence through the fact/history writer and refreshes only capital; the seed now emits canonical capital facts.

`canonical-capital-repair-2026-09-17.json` records the private backup identity, isolated restore, exact dry-run, timestamp-safe replay, normal-cache-refresh rehearsal, production apply, 229 history events, zero-write repeat, 253-row directory match, and unchanged non-target/source/schema fingerprints. Runtime PR: https://github.com/fbalino/civica/pull/30.

## Dependency repair

PR #29 resolves the two critical findings with the supported framework and map-library fixes, preserves the frozen July research bundles, and retains their exact historical lockfile separately. The complete GitHub CI run and Vercel preview passed before merge. Eighteen lower-severity audit findings remain outside this bounded repair. This is not a clean bill of health for the entire dependency tree.

## Repository hygiene

The owner-authorized cleanup removed 23 obsolete remote branches and closed PRs 2, 3, 4, 6, 7, 9, 10, 11, 12, 13, and 20. Exact heads, reasons, and retained links are in `branch-cleanup-record-2026-09-17.json`. Optional major upgrades were deferred; PRs 13 and 20 were superseded by #29. The inventory, dependency, capital, and sharing-card branches were removed after their merges. The only remaining release branch at this evidence capture is the checklist PR #28 itself; remove it on merge.

## Release evidence and recovery

- The blocked September replacement at `dpl_4mw14pc4sTMcbjbPauP8MmKDB3ec`
  (main `583e4edf`) retained the country-directory mismatch; the dependency
  gate also failed in [CI run 35256874358](https://github.com/fbalino/civica/actions/runs/35256874358).
  No gate was weakened to release the replacement.
- PRs #26, #29, #30, and #27 are merged. Their scoped repairs reached production
  as `dpl_77DvkLZewq1hzgf2kH45e1jUPnL7`, main
  `5203cb7ba6d7da723a7f38b47cefeeb8c86568b4`. Both canonical domains are
  attached. `production-release-check-2026-09-17.json` retains the exact check
  time, deployment identity, HTTP/health results, metadata, image hash, and
  browser observations. This September release supersedes August 24.
- The home, Uruguay, and About reader routes returned 200. Application,
  database, and critical assets were operational. Health remains degraded
  for existing scheduled-data freshness and optional classification limits;
  these are disclosed, not silently closed. The bounded browser check found
  no console errors and opened a working source disclosure.
- Twitterbot requests received the approved card metadata and exact 1200×630
  PNG with the selected tagline. An actual X composer preview was not observed;
  this proves the site's delivery, not X's cache state.
- The capital repair retained a private fresh backup and an isolated restore.
  Recovery is restore or a separately reviewed forward compensation; no
  ad-hoc reverse mutation. The exact repair is repeat-safe and the canonical
  facts survive the ordinary nightly refresh in the isolated rehearsal.
  Application containment can retain the last known Ready deployment while
  a tested forward fix builds; do not roll back dependency fixes casually.

## Completion boundary

PLT-030 is complete. PLT-025 is refreshed with this dated proof and G4 remains
blocked. The map remains deferred. No source-refresh completion, research
validation, external review, beta approval, or broader roadmap approval is
implied. The remaining lower-severity dependency findings and provider/manual
follow-ups stay visible in `data/OPERATIONS-READINESS.md`.
