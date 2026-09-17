# PLT-031 — reliable routine data updates

Owner authorization: 2026-09-17, repair data updating so the owner does not have to check continuously, investigate service-email noise, and proceed with the engineering work. This does not authorize academic validation claims or enable paid classification.

## Confirmed findings

- The cabinet import requires `CIVICA_ATLAS_RELEASE_ID`, which was absent in Production. It checked this only after fetching upstream data.
- Canada, Germany, and France bill jobs failed on all 30 recent daily runs; the cabinet job failed on 29 of 30. Every failed execution had one attempt. The three-attempt safety cap did not schedule another delivery.
- The pipeline alert monitor returned failure for successfully detected alerts, and then included its own failed run as an alert input.
- Canada returned a current JSON schema that no longer matched the adapter fields. An initial HEAD/redirect check was insufficient: the actual GET returned 185 bill rows. Germany used an expired temporary key; France's current source captures parsed successfully, so its retained generic error still required runtime diagnosis. A publisher or configuration failure must not be converted into a successful or fresh import.

## Delivery controls

Routine npm version-update PRs are capped at two; GitHub Actions version updates are grouped and capped at one. Both have a seven-day cooldown. Dependabot security updates are outside that cooldown. Existing weekly checks and npm minor/patch grouping remain.

Civica project Vercel Pull Request Comments were changed from on to off on 2026-09-17. Commit Comments were already off. Commit Status, deployment-status events, and repository-dispatch events remain on. No deployment or security-failure notifications were disabled; no mailbox messages were modified.

The recent Civica notification burst included eight Dependabot closure comments, four Vercel pull-request status comments, five CI failure messages, and four deployment-failure messages from superseded attempts. The replacement production deployment was Ready. Private mail identifiers, addresses, contents, and unsubscribe tokens are intentionally not retained here.

The default branch now requires a pull request, passing `verify` from GitHub Actions and `Vercel`, current-base checks, resolved review conversations, and squash merge. Force pushes and branch deletion are blocked. There are zero required human approvals and no bypass actors. The repository already had auto-merge and automatic head-branch deletion enabled. Ruleset ID: `23623964`.

## Current status

Open: implementation, tests, deployment, and current execution evidence for the data-recovery fixes. Local tests and configuration presence alone do not prove production recovery. PLT-025 and research gates remain separate.

## Official configuration references (checked 2026-09-17)

- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#cooldown
- https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference#groups
- https://vercel.com/docs/git/vercel-for-github
