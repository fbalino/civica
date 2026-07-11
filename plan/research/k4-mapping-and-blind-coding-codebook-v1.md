# K4 mapping and blind-coding codebook v1

**Frozen:** 2026-07-11, before pairing outcomes or human validation labels are inspected  
**Method:** `k4-constitution-practice-pairings/v1`

## Purpose

K4 places a constitutional passage beside a narrowly related practice indicator. It does not calculate a gap. It cannot label a country hypocritical, compliant, democratic, or undemocratic. It cannot combine constructs into a score, grade, tier, traffic light, or rank.

## Frozen mappings

| Construct | Constitute topic candidates | Practice indicator | Included meaning | Excluded meaning |
|---|---|---|---|---|
| Expression in practice | `express`, `press`, `opinion` | V-Dem `v2x_freexp_altinf` | Press/media freedom, political discussion, academic and cultural expression | Whether one clause alone fully protects expression; speech quality; truth of the constitutional promise |
| High-court independence in practice | `judind` | V-Dem `v2juhcind` | Whether salient high-court decisions merely reflect government wishes | Court appointments, lower courts, access, capacity, speed, or general rule of law |
| Clean elections in practice | `freeelec` | V-Dem `v2xel_frefair` | Registration fraud, irregularities, intimidation, vote buying, and election violence | Electoral-system design, turnout, representation, or a fresh observation in every year |

Topic tags nominate passages for coding; they do not prove that a passage creates an enforceable commitment.

## Blind coder task

Two coders independently see the constitutional passage, article context, topic label, constitution year, and this codebook. They do not see the country name, ISO code, V-Dem value, uncertainty bounds, other country passages, or another coder's answer.

For each candidate passage, record:

1. `in_scope_commitment`: yes, no, or cannot determine.
2. `commitment_direction`: protects/supports, restricts/conditions, mixed, or cannot determine.
3. `scope_note`: one sentence identifying the operative subject and any explicit exception.
4. `needs_more_context`: yes or no.

A jurisdiction-construct is eligible for display only after adjudication confirms at least one in-scope passage. Multiple passages remain visible; they are never averaged into textual strength.

## Reliability and fairness gates

The frozen threshold is Krippendorff's alpha ≥ 0.80 for `in_scope_commitment` and `commitment_direction`, calculated before adjudication. A constitutional scholar then reviews a stratified packet covering all three constructs, regions, language/translation conditions, constitution ages, and edge cases. At least 90% of reviewed pairings must be judged semantically fair. Any construct below either threshold is removed or receives a new method version and a new blind test; its thresholds cannot be relaxed.

## Display rules after validation

Show source passage first, then the named V-Dem indicator on its native scale with v15 lower and upper credible bounds, vintage, definition, and temporal caveat. Use “No tagged passage found” and “No V-Dem observation” as separate missing states. Never subtract, normalize, color-code, order countries by difference, or generate a cross-construct summary.

## Current status

The machine prototype is a candidate packet only. Human blind coding and scholar review are pending, so no pairing is validated for public interpretive use.
