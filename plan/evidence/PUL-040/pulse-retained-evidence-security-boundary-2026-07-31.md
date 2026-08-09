# Pulse retained-evidence security boundary

Change-control version: `civica-index-pulse-retained-evidence-v55`.

Publisher headlines and descriptions are untrusted evidence. The classifier and
subject-country prompts now render those fields as JSON data and explicitly
reject embedded commands. Prompt wording is defense in depth: automatic
publication additionally requires each supporting classifier to return an
exact retained quote, and every resolved country attribution must bind an exact
retained quote to the named versioned jurisdiction entity.

Instruction-like publisher text cannot become automatic evidence. A non-`none`
classification is queued for review; a `none` response follows the existing
bounded retry path and ends as a terminal failure rather than silently writing
a non-event. The final persistence boundary repeats the retained-evidence check
before any automatic publication.

This change does not alter the Pulse taxonomy, category weights, severity
ranges, provider roster, or `pulse-v2.15-beta` method identifier. It changes the
eligibility rule for automatic publication and the disclosed response contract.

