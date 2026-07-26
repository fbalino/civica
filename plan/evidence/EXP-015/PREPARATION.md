# EXP-015 replacement concept preparation

Date: 2026-07-25

Status: light masters owner-approved; matched dark variants generated and
screened; rendered-candidate owner review pending

## Owner decision

Fernando Baliño rejected all three EXP-014 directions. The required replacement
is a substantially larger, more beautiful Explore mega menu with custom images
created specifically for the menu.

On 2026-07-25 Fernando approved all eight corrected generated light masters as
the EXP-015 batch and asked Codex to build the large Explore mega menu. That
approval authorizes the local rendered candidate and matched dark generation.
It is not approval of the as-yet-unseen rendered result and is not deployment
authority.

## Prepared replacement

The replacement will use one image-led identity for each of the eight shared
destinations:

1. Countries — atlas index and laurel;
2. World Atlas — terrestrial globe;
3. Compare — paired dividers and specimen cards;
4. Constitutions — charter and civic column;
5. Parties — assembly rosette and coalition table;
6. Elections — ballot box and tally sheet;
7. Rankings — surveyor's balance and ordered markers; and
8. Organizations — interlocking geographic rings.

Desktop will use a near-page-width panel with two explicit registers: “Start
with a place” and “Research tools.” Mobile will retain the same order, labels,
descriptions, and art in a single scrollable menu. Images are decorative; the
destination name remains the accessible identity.

The native generator returned eight 1254×1254 light masters. The checked review
derivatives are 384×384 WebP files, displayed at 96 pixels during the first
menu-scale screen. Together they weigh 79,622 bytes, below the provisional
96 KB active-theme budget. The closed menu must request no Explore art; opening
it may load only the active theme. No separate decorative hero image is planned
because it would compete with the destinations.

Exact prompt specifications are in `PROMPTS.md`. The generated files, hashes,
screening record, and remaining limitations are in
`GENERATED-LIGHT-MASTERS.md` and `GENERATED-DARK-MASTERS.md`. The optimized
theme pairs are wired into a local rendered candidate, but neither that
composition nor a production release has received owner approval.

## Generation correction

The initial preparation record incorrectly treated the installed workflow as
requiring a project API key and separate paid-API authority. Fernando corrected
that assumption on 2026-07-25. Codex then used the native image-generation tool;
no project `OPENAI_API_KEY`, provider/model approval, or direct API-spend
authority was required.

The masters' embedded C2PA metadata identifies software agent `gpt-image`
version `2.0`, claim generator `OpenAI Media Service API`, and
trained-algorithmic-media origin. This corrects the initial note that no version
was exposed; it does not establish the exact marketed model release. The seed
and iterative correction wording remain unavailable rather than inferred.
Full-resolution masters remain in ignored local output; optimized candidates
and review derivatives carry checked hashes.

## Remaining acceptance sequence

1. Ask Fernando to approve, revise, or reject the exact rendered candidate,
   using `RENDERED-CANDIDATE.md` and the local browser.
2. Only after that approval, close EXP-015 and EXP-016, record the accepted or
   revised canonical pattern in a separate closure commit, and treat deployment
   as a separate authority boundary. Candidate commit `4b7385fd` is review
   evidence and does not satisfy this step.
