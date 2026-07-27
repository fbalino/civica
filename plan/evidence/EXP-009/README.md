# EXP-009 — failed-illustration regeneration candidates

Status: agent-executable candidate preparation complete; human approval and
production replacement remain open.

Two failures were inherited from the adopted EXP-005/006/008 contract:

- France was a semantic/style regeneration candidate; color grading alone
  could not make it pass.
- The United Kingdom was a family outlier and was excluded from the approved
  dark-corpus grade.

This evidence contains one new light/dark pair for each country. The pairs use
the same composition across themes, carry no text or source-evidence role, and
leave the four live production assets byte-for-byte unchanged.

## Candidate files

| Country | Light | Dark |
| --- | --- | --- |
| France | `candidates/fra-candidate-light.webp` | `candidates/fra-candidate-dark.webp` |
| United Kingdom | `candidates/gbr-candidate-light.webp` | `candidates/gbr-candidate-dark.webp` |

All four files are 1500×1000 sRGB WebP at q88 and remain within the existing
75–750 KB delivery bound. Both light candidates pass every quantitative light
reference range in `civica-engraving-color/v1`; both dark candidates exceed
the minimum dark tone range. Dark corpus saturation/orange ranges are batch
statistics, not per-image acceptance rules, so no individual color approval is
inferred from them.

`candidate-manifest.json` records hashes, byte counts, source PNG hashes,
tool/model/seed disclosure, post-processing, measured values, the rejected
France attempt, production-asset hashes, landmark sources, and the empty
approval record. `PROMPTS.md` contains the exact five prompts.

## Landmark review

The first France output was rejected because it invented a winged monument at
the Pont d'Iéna approach. The retained correction uses a five-arch bridge and
an equestrian approach sculpture. The United Kingdom pair keeps Elizabeth
Tower joined to the Palace of Westminster beside Westminster Bridge and
excludes the unrelated Tower Bridge and Tower of London.

These are bounded illustration checks, not claims of architectural
documentation. The cited landmark sources are in the manifest, and a human
reviewer must still inspect factual/style fit at the intended hero crops.

## Completion boundary

EXP-009 stays unchecked. A qualified reviewer must approve, reject, or request
changes to each pair. Approval must name the exact candidate hashes and record
the reviewer/date/reason. Only then may a separate implementation replace the
production assets, update the illustration manifest/captions, and rerun
`validate:editorial-illustrations`, desktop/mobile light/dark browser checks,
and the master-plan gate.

No production image, manifest row, route, or public copy changed in this
preparation.
