# Editorial illustration rights and provenance

Contract: `civica-editorial-illustration-rights/v1`

Effective: 2026-07-23

This policy covers every AI-assisted, generated, edited, or
photographic-treatment editorial image released by Civica. It complements the
reader disclosure at `/licensing#imagery`, the checked illustration manifest,
the AI-use disclosure, the asset inventory, and BRD-015 complaint handling. It
does not convert a file, model output, public landmark, or reference image into
property Civica owns.

## Ownership and provider terms

Fernando Balino records and controls Civica's human-authored selection,
arrangement, captions, edits, and release decisions to the extent those
elements are protectable. Civica does not claim ownership of upstream
references, landmarks, logos, likenesses, provider technology, or
machine-generated elements that applicable law does not protect. A provider's
permission to use an output is not a conclusion that the output is
copyrightable or free of third-party rights.

Every new or materially replaced asset must record the model, tool, version,
account terms checked on, prompt, negative prompt, seed/parameters when
available, human direction/selection/edits, and the exact provider terms
applicable to that generation. If the provider or account terms cannot be
identified, the asset cannot enter a release.

The historical corpus is different. Its original sessions did not retain model,
tool, prompt, seed, or reference-image records. Those facts remain
`unknown-not-retained`; they must never be inferred from a caption, filename,
Git timestamp, output appearance, or a later provider workflow.

## Reference images and derivative-work risk

Every uploaded or linked visual reference must have a URL or file hash, source,
author where known, license/permission, retrieval date, and intended use.
Finding an image online, crediting it, or using it only as a reference does not
by itself authorize copying protected expression. A drawing or generated image
based on a photograph can still raise derivative-work questions. Unclear
references are replaced with a documented public-domain/licensed alternative
or escalated for professional review; the release does not rely on an
unrecorded fair-use assumption.

## Subject screening

Before release, the reviewer records one disposition for each domain:

1. **Reference copyright:** protected photographs, illustrations, or other
   pre-existing expression.
2. **Architecture and panorama:** modern architecture, public art, interiors,
   or works whose freedom-of-panorama treatment can vary by jurisdiction.
3. **Trademark and insignia:** logos, trade dress, official emblems, flag
   treatments, or uses that can imply sponsorship, origin, or endorsement.
4. **Personality and likeness:** identifiable living or recently deceased
   people, or a recognizable performer/public-figure imitation.
5. **Cultural and documentary risk:** sacred/cultural sites, communities,
   events, landmark identity, or a fictional scene that could be mistaken for
   documentary evidence.

The allowed dispositions are `cleared`, `replaced`, `withheld`, or
`professional-review-required`. The last state blocks release. The
non-documentary disclosure does not cure an underlying rights or accuracy
problem.

## Manifest and evidence retention

The release record must include:

- asset and light/dark pair identity;
- route, subject, caption, file hash, dimensions, and format;
- generation/edit fields and every reference record;
- all five screening dispositions;
- reviewer, date, outcome, release, and correction/replacement history.

The checked manifest, generation/edit record, reference evidence, review
result, and correction history are retained in Git and in every frozen release.
Replacing or withdrawing an image creates a superseding record or tombstone;
it does not erase the prior release record. Secrets, private account IDs, and
unlicensed reference bytes do not enter the public repository.

The current `civica-editorial-illustration-manifest/v1` covers the checked
engraving directory but cannot restore missing historical session metadata.
Uncommitted image experiments and any asset outside the checked manifest are
not release-cleared merely because a page can reference them.

## Display and third-party reuse

Civica authorizes display on Civica Atlas under the current non-open product
posture. Civica grants no separate copyright, trademark, personality-right, or
other third-party reuse license for editorial imagery. Public file access,
attribution, citation, or a screenshot does not create such a license.
Rights available under applicable law are unaffected. Reuse requests go
through `/contact` and require a recorded disposition; silence is not
permission.

## Correction, complaint, and takedown

Accuracy and rights complaints use `data/COMPLAINT-HANDLING.md`:

1. authenticate and acknowledge the bounded claim;
2. preserve the challenged file, manifest row, references, and release state;
3. temporarily contain credible urgent rights, safety, or false-endorsement
   risk without destroying evidence;
4. separate legal, editorial, cultural, and factual review;
5. record a reasoned accept, reject, partial, or needs-more-information
   decision;
6. correct, replace, withdraw, or restore the asset through a new version;
7. publish a correction/tombstone when the public record was materially wrong;
8. retain the requester response and appeal/counter process without exposing
   personal data.

## Official sources checked on 2026-07-23

- The U.S. Copyright Office's AI initiative and January 2025 copyrightability
  report distinguish human-authored expression from material generated without
  sufficient human control:
  <https://www.copyright.gov/ai/>
- Copyright Office Circular 14 identifies a drawing based on a photograph as a
  derivative-work example:
  <https://www.copyright.gov/circs/circ14.pdf>
- WIPO materials note that architecture can be protected and that
  freedom-of-panorama exceptions depend on national law:
  <https://www.wipo.int/edocs/mdocs/copyright/en/sccr_37/sccr_37_6.pdf>
- The USPTO explains that confusing similarity and commercial impression can
  create source-confusion risk:
  <https://www.uspto.gov/trademarks/search/likelihood-confusion>

These sources support a conservative screening process; they do not determine
Civica's rights in a particular asset or replace Uruguay/launch-jurisdiction
legal advice.

## Remaining professional decision

Before broad release, qualified counsel must review the historical-corpus
posture, intended launch jurisdictions, provider terms, human-authorship and
ownership claims, reference-image process, architecture/panorama issues,
trademark/insignia and personality/likeness screening, complaint flow,
retention, and the no-separate-reuse-license language. BRD-010 remains open
until that review and owner disposition are recorded.
