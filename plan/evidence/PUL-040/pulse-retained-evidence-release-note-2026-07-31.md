# Release note — retained publisher evidence gate

Pulse automatic publication now fails closed when classifier or
subject-country output is not tied to exact, non-instructional publisher text.
The scan fixtures that attempt to force a category or Canada attribution are
rejected by deterministic guards before publication. Provider-generated output
that lacks the new evidence quote remains parse-invalid or review-only.

This branch record is not a production-deployment claim. The runtime contract
artifact is regenerated with the new publication boundary while retaining the
`pulse-v2.15-beta` public method identifier.

