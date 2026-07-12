# ATL-004 — source agreement and resolver reasoning

Completed 2026-07-12.

## Result

The existing `FactValuePanel` now turns retained reconciliation evidence into a
plain-language reader explanation wherever the shared `FactValueDot` appears,
including the country masthead, representative Factbook leaves, additional
indicators, and Compare overview facts.

Each panel now shows:

- the selected value and every retained alternative;
- source, observation date, captured vintage, projection state, and rejection
  reason per row;
- `Single-source fact`, `Source records agree`, or `Source records differ` as
  the evidence posture;
- verified producing-family counts under DAT-006, with republishers collapsed
  to their upstream family and compilation/unknown lineage excluded from
  independent corroboration;
- the applicable precedence rationale and an expandable six-step resolver
  trace.

Single-source facts explicitly make no source-agreement claim. Multiple source
records are never presented as a vote, and a visible source count is not called
independent corroboration when the rows share one upstream family.

## Representative check

Argentina population retained five visible rows. Four measured records formed
the decision pool; the IMF projection remained visible but did not corroborate
them. UN Data and World Bank both resolve to the UN WPP producing family, while
CIA and Wikidata remain non-independent compilations. The panel correctly
reported source disagreement and explained the deterministic UN Data selection.

## Browser verification

- Desktop 1440×1000 and mobile 390×844.
- Light and dark themes.
- Population panel opens from the country masthead by pointer/role control.
- Complete resolver trace expands to six ordered steps.
- Panel height is viewport-bounded with internal scrolling.
- No page-level horizontal overflow.

## Automated verification

- 23 focused evidence-family and precedence tests passed.
- TypeScript, design-token, and freshness-write guards passed.
- The full claims/documentation gate passed with all 939 tests.
- The complete production build passed and generated all 105 static pages.
