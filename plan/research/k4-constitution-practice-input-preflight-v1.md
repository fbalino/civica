# K4 constitution-to-practice input preflight v1

**Date:** 2026-07-11

## Result

The current database cannot support a fair constitution-to-practice pairing. The constitutional side has broad coverage, including excerpts for freedom of expression, association, assembly, religion, court structure, judicial councils, executive powers, and election rules. The external time-series table contains only five broad measures: V-Dem Liberal Democracy Index, Freedom House total score, WGI Rule of Law, CPI, and HDI.

None is specific enough to serve as the practice counterpart for a constitutional commitment. Liberal Democracy and the Freedom House total combine many concepts. WGI Rule of Law combines courts, contracts, policing, property, and crime. CPI and HDI do not measure the listed constitutional commitments.

## Rejected mappings

| Constitutional topic | Available external field | Decision | Reason |
|---|---|---|---|
| Freedom of expression | V-Dem Liberal Democracy Index | Reject | The index contains several institutions and rights; it does not isolate expression. |
| Freedom of association or assembly | Freedom House total score | Reject | The total includes political rights and many civil-liberties questions. |
| Judicial independence | WGI Rule of Law | Reject | Rule of Law is a broad composite and cannot stand in for judicial independence. |
| Constitutional term limits | Liberal Democracy or Rule of Law | Reject | Neither field measures compliance with a term-limit rule. |

The prototype emits no pairings from these fields. This prevents a broad country judgment from being relabelled as evidence about one constitutional promise.

## Required input work

K4 needs a small frozen set of practice-specific publisher indicators with exact definitions, source vintages, uncertainty where published, rights, hashes, missingness, and temporal breaks. Candidate mappings must be written before values are inspected. Examples may include a publisher-defined freedom-of-expression indicator, high-court independence indicator, and clean-election indicator, but their exact identifiers require codebook review and semantic justification.

After ingestion, two blinded coders apply the mapping codebook to the frozen sample. The constitutional-scholar fairness review remains a separate external gate. Agent agreement can screen candidate mappings but cannot satisfy either threshold.
