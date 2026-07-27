# QA-018 staging attempt 03 — Vercel CLI isolation gate

Status: aborted before migration because the Preview deployment resolved to
the production Neon branch

Date: 2026-07-26

Candidate commit:
`8cf26c9746c079634488df53afc23d4adf6a1407`

Machine record:
[`vercel-cli-isolation-probe.v1.json`](vercel-cli-isolation-probe.v1.json)

## Accepted CLI-only evidence path

The authenticated Vercel CLI resolved the attached `neon-claret-bucket`
resource and created only Preview-targeted deployment attempts. The accepted
identity, deployment, and database evidence in this record came from that
Vercel CLI path.

During exploration, Codex mistakenly opened a Neon browser sign-in flow. It was
stopped without obtaining Neon access, credentials, provider evidence, or
database access, and the tabs Codex opened were closed. The browser detour is
not part of the accepted procedure or evidence. No production deployment,
production promotion, migration, or database write occurred.

On 2026-07-26, Vercel CLI 53.2.0 exposed integration install, access, billing,
listing, guide, and SSO-open commands. Its `integration update` command did not
support deployment-configuration fields such as automated Preview branching.
The `integration open` SSO command will not be used by Codex. Future Neon
identity, environment, migration, and validation work is restricted to Vercel
CLI-provided environments.

The installed CLI exposes a manual `deploy init` → deployment-scoped
environment pull → `build --id` → `deploy continue` sequence that would
preserve Civica's required migrate-before-build order. The team rejected the
initialization before creating a deployment because manual deployment
provisioning is not enabled.

Ordinary Preview deployments enter `BUILDING` before the public
deployment-scoped environment pull can complete. Those attempts were canceled
or ended in error and did not run a migration. The final bounded probe used the
same candidate Git identity and queried only Neon target settings plus the
authoritative migration ledger.

## Isolation result

The probe failed closed with
`Preview database resolved to the forbidden production branch`.

Before and after the probe, the configured database identity remained:

- project `ancient-art-58836757`;
- branch `br-dawn-frog-amrf0h6a`;
- endpoint `ep-bitter-night-amod9dl6`;
- authoritative head `0032_sparkling_genesis`.

The host is retained only as a SHA-256 in the machine record. No connection
string, password, database row, cookie, or provider response body is retained.

This proves that the current Vercel Preview connection does **not** supply an
isolated Neon child branch. It does not prove that the Vercel-managed
integration lacks the capability; its current connection setting has not
enabled automated Preview branching.

## Required owner/platform action

The current Vercel CLI cannot change this connection-level deployment setting.
If the owner chooses to enable it, edit the `civica` project connection for
`neon-claret-bucket` in Vercel—not Neon. Under
**Advanced Options → Deployments Configuration**:

1. enable **Required → Preview**;
2. enable **Resource must be active before deployment**;
3. save the connection.

This changes future Preview behavior and may create retained Neon branches, so
it is an owner/platform configuration decision rather than an inferred agent
permission. Production must remain connected to the current main branch.

No Neon sign-in or connection string is needed from the owner. After that
setting is confirmed, Codex can rerun the read-only isolation probe through
Vercel CLI. Only a new branch ID, a distinct endpoint/host, project
`ancient-art-58836757`, and ledger head `0032_sparkling_genesis` permit the
ordered migration plan to begin.

## Safety result

Database writes performed: zero. Migrations applied: none. Conditions runs:
none. The production ledger head was unchanged after all attempts. QA-018
remains pending external authority, and no owner sign-off is claimed.
