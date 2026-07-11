# DAT-029 evidence — numeric validation and quarantine

## Root cause and repair

The legacy CIA parser selected the first number anywhere in prose, then applied the first scale word anywhere later. North Korea's paragraph therefore combined the year `2010` with `billion`, yielding `2,010,000,000,000` percent of GDP.

The replacement parser accepts a scale only when attached to the selected leading quantity. Percentage fields require one unambiguous percentage; ranges or multiple percentages fail closed. `validateFactNumeric()` applies each fact key's own envelope, and the Atlas writer persists a failed candidate as `status='rejected'` with its original value, source, and reason.

## Live result

- Active envelope violations: 0.
- North Korea quarantined candidates: 1; source/prose retained: 1; prior active state retained in research history: 1.
- No alternate measurement exists, so canonical resolution honestly has no numeric fallback.
- Valid small-value probes remain active for Pitcairn (population 50), Cocos (593), Vatican City (0.44 km²), Niue (1,815), and Tokelau (GDP 0.007711583 billion).
- The generated release-quality report passes all nine invariant families.
- Active fact groups changed from 17,516 to 17,515 solely because the corrupt row left the active resolver set; all 17,515 remain source-linked.

## Enforcement and verification

- Authoritative migration `0002_quarantine_numeric_outliers.sql`, SHA-256 `76cca42a16ab01d41889922b72b15b7cd84e966145871b4a17a6070dd3b4c776`.
- Live authoritative ledger: 3/3; rerun pending migrations: 0; schema fingerprint unchanged at `647e8ed0a2d95e59e46ea7a53b5c8ac56acc6b078b1053fa19ac69dbde945e54`.
- `npm run validate:numeric-quarantine` and `npm run validate:numeric-quarantine:live` pass.
- `npm run audit:release-quality` passes rather than using the previous allow-fail baseline.
- 641/641 tests pass.
- Full production build passes, including claims/docs and release gates.
