# PUL-015 evidence

## Outcome

`pulse-country-day-evaluation-set/v1` draws 536 country-days from the frozen 17,460-unit sovereign-country-day population. It assigns 482 packets to analysis and retains 54 same-primary-stratum reserves. The draw covers 181 jurisdictions across all six inhabited continent groups represented in Civica.

The sample links to population artifact `26e3f46b395dc968afeb4803b2eeb7c48aeb94f05f4f1a41c70a6d51eda01e92` and country-day frame `12237e228a521da32e6ac66fb9f39ff50878a437a83a1aabb951df3677272f7f`. Its semantic SHA-256 is `ebbcd1cf02e73332690876c76e98fafb4e054ef9a23a8255e7a55d927512ec77`.

The set was assembled before gold-label access. It includes all five country-days with at least five retained documents from two source families, 30 days with retained evidence below that threshold, and 501 days with no retained Pulse documents. Thirty-five packets link to retained private evidence snapshots by immutable evidence identity. The set was not derived from published Pulse events.

## Search evidence

Every packet carries three date-bounded query traces: institutions, accountability and security, and a broad country-day search. The complete artifact therefore retains 1,608 query traces. Each trace records the frozen query, provider, Firecrawl CLI version, capture time, result count, and at most five result titles, URLs, and reported publication dates.

The completed capture retains 6,086 result records. Firecrawl news search supplied 1,592 query traces and the web fallback supplied 16. Three hundred sixty individual query traces returned no result; five country-day packets returned no result across all three families. The raw-cache audit found zero remaining malformed URLs or blank titles after fallback repair.

Publisher snippets, images, page bodies, HTML, and raw provider payloads are excluded from the checked research artifact. Raw capture wrappers remain ignored under `.firecrawl/`. Unusable provider-relative links are reissued through the web fallback before validation.

A zero-result query is preserved as retrieval evidence, not converted into a true-negative label. Coders must distinguish qualifying events, true negatives, retrieval misses, insufficient observation, and out-of-scope cases under PUL-016 and PUL-017.

## Integrity

The sample, each query trace, each combined country-day trace, the trace set, and the final evaluation set carry SHA-256 integrity fields. The trace-set SHA-256 is `cb38263f63756abad121dec5a1a5af6325359d58eac4d1422f5be1c9f87d4106`; the final unlabeled evaluation-set SHA-256 is `4d34bca5997d680b245f08917ccb92c04f4a1cca5241d79cbfdf10866afbb162`. Validation rejects label leakage, bad weights, incomplete or changed query families, unsafe publisher payloads, malformed results, duplicate or missing packets, and any mismatch among a packet's frozen sample row, evidence references, analysis status, and search trace.

## Verification

```sh
npm run validate:pulse-country-day-evaluation
npx tsc --noEmit
npx eslint scripts/generate-pulse-country-day-sample.ts scripts/run-pulse-country-day-searches.ts scripts/validate-pulse-country-day-evaluation.ts src/lib/pulse/v2/country-day-evaluation.ts src/lib/pulse/v2/country-day-evaluation.test.ts
npm test
npm run validate:claims-docs
npm run build
```

PUL-015 supplies an unlabeled evaluation input. It makes no accuracy claim about Pulse. Independent instructions, blinded double coding, adjudication, and performance estimation remain assigned to PUL-016 through PUL-020.

The complete suite finishes with 811 passing tests, and the production build renders 98 static pages. The existing non-fatal Next.js file-tracing warning remains.
