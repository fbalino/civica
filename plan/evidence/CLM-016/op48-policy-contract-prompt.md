# OP48 CLM-016 policy and acceptance contract

Project root: `/Users/fernandobalino/Projects/civica`

Role: independent academic-publication policy architect.

Objective: define the smallest honest, executable CLM-016 contract and write it to `plan/evidence/CLM-016/op48-policy-contract.md`.

CLM-016:

> Publish correction, retraction, version, and known-limitations policies linked from every research artifact. Done when: policies define severity, response time, historical preservation, API/data corrections, notification, and version increments; a simulated correction produces the expected changelog, supersession marker, and release-note entry.

Read only the directly relevant current files: the public corrections route/form/API, correction/dispute schemas, `site-state.ts`, public claims and documentation registry, methodology/replication/Pulse surfaces, API docs, README/CITATION, and existing validators/tests. You may read the Sonnet inventory if it exists, but do not wait for it.

Do not edit application or plan files other than the owned contract. Do not use a browser, server, or production database. Use no more than 30 tool calls.

The contract must adjudicate:

- one canonical public policy location and appropriate link-only mirrors;
- precise severity classes and response/disposition targets that do not promise staffing Civica does not have;
- distinctions among correction, retraction, supersession, clarification, and methodological/version change;
- historical preservation, API/data correction behavior, notification posture, and version-increment rules;
- what “every research artifact” means as a closed, mechanically registered set for this prelaunch repo;
- a pure simulated-correction fixture and its expected changelog, supersession marker, and release-note outputs without production writes;
- fail-closed validator rules and false-positive/negative fixtures;
- explicit boundaries deferred to later data-release and governance tasks.

End with a file-by-file implementation map and an ACCEPT/REJECT checklist that an independent reviewer can apply. Avoid migration theater: public policy states current truth, not a history of prelaunch changes.

Expected worker result envelope: return a normal structured worker result naming the contract artifact, files changed (only the contract), commands run, verification, and next action.
