# Ask Civica evidence, privacy, and failure contract

**Contract:** `ask-civica-contract/v1`
**Owner:** Fernando Baliño
**Public disclosure:** `/privacy#ask-civica`
**Updated:** 2026-07-16

## Scope and evidence boundary

Ask Civica is a convenience layer over a deliberately small, current country-evidence bundle. It is not a research source, a correction decision, or a publication workflow.

For each request, the browser can provide only a country route slug and a closed tab name. The server resolves that slug and constructs a bounded bundle from canonical country facts: capital, population, GDP (PPP), currency, official languages, real GDP growth, inflation, and unemployment. Each value retains its selected source label and as-of value. No browser-supplied country name, party list, coalition, election date, prose, or source link reaches the model as evidence.

The model receives a static system prompt plus a JSON-encoded user payload. It may answer only from `allowed_evidence`, must name source labels, and must say that the current Civica bundle does not establish a claim when it lacks the evidence. The server appends a deterministic country-profile source footer to every completed answer. The country page remains the public source trail.

## Injection and exfiltration boundary

The route rejects direct attempts to override instructions or reveal a system prompt, credential, token, or secret before any model call. The static system prompt treats both the question and evidence strings as untrusted data. There are no model tools, file access, database access, browser access, network retrieval, account access, or secrets in the model request. This keeps an injection from acquiring a capability that the feature does not need.

This implements the applicable parts of Anthropic's current guidance on separating untrusted content, JSON-delimiting data, minimizing model privilege, and red-teaming injection attempts. See <https://docs.anthropic.com/en/docs/test-and-evaluate/strengthen-guardrails/mitigate-jailbreaks> (retrieved 2026-07-16).

## Privacy and retention

Civica does not write Ask Civica questions or replies to its own application database and does not create a server-side conversation history. The browser stores the visible conversation under its country-specific local-storage key until the reader clears the conversation or clears site data.

The application emits only a content-free operational event: contract version, prompt version, model identifier, closed outcome, and a bounded evidence-fact count. It never logs the question, reply, country, source names, URLs, raw facts, provider exception, authorization header, or API key.

The request is sent from Civica's server to Anthropic's Messages API to obtain the reply. Anthropic's handling is governed by the arrangement on the actual Civica API organization. Civica does **not** claim that zero-data retention is enabled; an owner must confirm any organization-level arrangement before that claim could be added. Provider-level retention can differ for standard API, zero-data-retention, flagged-content, and legal-hold cases. See <https://docs.anthropic.com/en/docs/build-with-claude/zero-data-retention> (retrieved 2026-07-16).

## Versions and safe failure

`ASK_CIVICA_PROMPT_VERSION` is a content hash of the checked-in static system prompt. The configured model identifier is `claude-sonnet-4-6`. A prompt or model/provider change requires a new checked version and this document's review; it is not silently folded into historical operations.

If the model key is absent, the country evidence cannot be read, or the provider fails, the feature returns a fixed unavailable message. It does not fall back to a different provider, stale chat history, broader web knowledge, or a cached answer. Failures produce a closed PLT-018 monitoring identity and the content-free audit event only.

## Validation and owner follow-up

`npm run validate:ask-civica` runs the contract tests and checks the public disclosure, route boundary, evidence artifact, and checklist record. The fixtures prove server-side source context, explicit unavailable handling, source footer behavior, prompt-injection rejection, no secret/tool context, and content-free operational logging.

Before a production release, Fernando must confirm the Anthropic organization and workspace retention arrangement without recording a credential, account identifier, or console screenshot in the repository. If the arrangement or provider terms change, update this contract and `/privacy#ask-civica` first.
