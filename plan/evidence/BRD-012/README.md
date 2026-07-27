# BRD-012 privacy alignment evidence

Status: agent-executable preparation complete; checklist item remains open.

## Completed locally

- Added the closed `civica-privacy-data-handling/v1` inventory and rendered its
  public rows on `/privacy`.
- Removed raw-IP collection from new contact submissions; advisory
  applications already stored `null`.
- Added authenticated permanent deletion for retained contact messages.
- Added a default-read-only, aggregate-only legacy identifier purge command
  with a two-part mutation confirmation.
- Registered privacy validation in the build and documented current provider,
  retention, access, deletion, and security boundaries.
- Verified the production state without reading or retaining sensitive values;
  see `privacy-live-audit.v1.json`.
- Verified `/privacy` in installed Google Chrome: HTTP 200, both data-flow
  tables and captions, all 11 flows, required notices, and zero browser errors;
  see `privacy-browser-check.v1.json`.

## Remaining before completion

1. Fernando authorizes the production minimization command after reviewing its
   zero-write aggregate plan.
2. Run the command with both mutation confirmations and retain only timestamp
   plus before/after aggregate counts; both post-run counts must be zero.
3. Verify the actual Vercel log plan/settings, Anthropic organization retention
   arrangement, and configured map/flag/PMTiles provider boundary.
4. Queue and record professional privacy review of operator identity,
   jurisdictional scope, lawful bases, notices/consent, subprocessors,
   transfers, retention, and rights-request handling.

No production purge, provider-setting change, agreement, consent, or
professional review is claimed by this evidence.
