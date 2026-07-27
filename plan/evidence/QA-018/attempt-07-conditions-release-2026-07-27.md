# QA-018 attempt 07 — isolated Conditions release rehearsal

Status: child release, immutable-replay, exact Preview, API, cache, protected
route, cron dry-run, and responsive-browser gates passed; owner sign-off
remains pending.

The guarded target was Neon project `ancient-art-58836757`, disposable branch
`br-gentle-paper-amsh6g7c`, and endpoint `ep-holy-wave-amcnk005`. Its hostname
SHA-256 was
`927dbb0aec671e18fc4b632a8e466b1e312bee6f35c1190c11084d5c5266bb79`.
Every command also rejected production branch `br-dawn-frog-amrf0h6a` and
production hostname SHA-256
`c0ca2046b194c5a2a9db23679062055eb075b8183500889dde1968466be2425b`.
The required and observed authoritative migration head was
`0051_eminent_jocasta`.

The input was a fresh World Bank capture for 2020–2024 with 717 successful
response envelopes. The temporary file SHA-256 was
`8dcd03657db039941b9ca05acb1bc1a694f91d45ea3df7012d2b50aac0062e54`;
the capture's internal payload SHA-256 was
`67e55f3f5f944d7e8e3f78d5f29385cd776f240ec6f8f2337e517a9f731336b4`.
Retrievals ran from `2026-07-27T04:24:01.898Z` through
`2026-07-27T04:24:15.434Z`. The raw publisher response bodies were moved out of
the worktree, restricted to mode `0600`, and are not committed.

The direct zero-write dry run produced
[`attempt-07-release-expectations-2026-07-27.v1.json`](../ATL-027/attempt-07-release-expectations-2026-07-27.v1.json).
Its artifact SHA-256 is
`ea707e427b1c263596a2aa67124b2018350b50c9a325f6c0b052a2412b4ed05d`.
It binds release `conditions-20260727-v1`, manifest
`267cf0f2680bc94153a85386e08ce222c6797b2c26a6a9116de4d24573301743`,
and expected calculation counts of 51 human-development, 50 peace/security,
and 239 economic-stability rows.

The first atomic apply wrote 340 calculations, 818 component rows, and 101
scores. The immediate and final live validations both passed:

- three reference sets and five normalization-parameter rows were retained;
- all 340 calculation keys and the manifest replay matched;
- all six Conditions release tables had enabled retention triggers;
- release mutation-history rows remained zero;
- the three source freshness rows matched the release transaction timestamp
  `2026-07-27T04:46:11.578Z`; and
- economic rows retained 162 aligned, six mixed-year-refused, and 71
  missing-component calculations without a score or composite.

The exact input and expectations were then applied again. The replay proposed
the same 340 calculations and wrote zero scores and zero component rows. A
separate internally valid altered capture produced manifest
`4b23826bea95c8df4b1ac697d82b5fbe960d4d2b27bfd7c50c097c0712814fc7`
and temporary expectations SHA-256
`dbeeffd2065c5ed2093cce980664a6da507fb8d8da8cb8c19efcf68eee96eaec`.
Applying that changed manifest under the existing release ID exited nonzero
and failed closed. The final live validator still matched the original
manifest, counts, freshness, replay, and zero mutation-history state.

Final child-only gates also passed:

- 51 of 51 authoritative migrations and public-schema fingerprint
  `5b4e4b180158b583e4db879b4ecfcaae6c3ca81caaeea28118cd0f83b3c6bd3b`;
- 42 research-evidence triggers;
- source/indicator lineage across Conditions and the retained legacy rows; and
- the closed data-value-state contract.

## Exact Preview and publication pointers

Candidate `61351a43ac4e381fd409f4939845c6aac4ef6305` passed both the
repository production build and Vercel Build Output build. The 737-file,
245,926,508-byte static output is bound by SHA-256
`2a355ac33fc110eac1046810d86687b0dbca272b5e043cd6f82c642879b2ff88`.
That exact prebuilt output reached Ready as isolated Preview deployment
`dpl_2qPLXMA651ixPRrKLQaM7ZizuAak`.

The first Preview smoke correctly failed closed because migration `0050` had
staged, but not published, the three Index release headers and the fresh child
had no complete Pulse score publication pointer. All three Index releases
reproduced their checked row sets and were published in dependency order
(Beta-R3, Beta-R4, then Beta-R5). A zero-write Pulse score plan was followed by
one deterministic child-only corroboration and score run: 380 corroboration
rows, 13 considered events, 65 jurisdictions, and 325 dimension rows. It made
no model or paid API calls.

The passing rerun then reconciled the exact Conditions, Index, and Pulse
publication pointers through the deployed host. Mutable, checked-artifact, and
frozen-release cache policies passed; an unauthenticated protected route
returned 401; the authorized cron dry run returned 200 and an identical replay
was duplicate-suppressed. Source freshness stayed unchanged during the smoke,
active cron leases were zero before and after, and read-only production checks
confirmed production remained on branch `br-dawn-frog-amrf0h6a` at
`0032_sparkling_genesis`.

The deployment environment pull was attempted once after Vercel had reached
Ready. Vercel rejected the out-of-window request and created no temporary
environment file, so the accepted fallback is the exact-host runtime
attestation bound to the child database, candidate commit, migration head, and
three release pointers. No provider error body is retained.

The browser matrix passed 11 checks across the Conditions explorer, three
country panels, and the three-country comparison at desktop and 390px mobile.
All three alignment states, sources, native units, component years,
missingness, release identity, and the no-composite boundary were visible with
no console errors or horizontal overflow.

No production database, production deployment, production Cron job, paid
model, or owner sign-off was changed or claimed. QA-018 remains unchecked until
Fernando records a dated approval or rejection of this exact Preview.
