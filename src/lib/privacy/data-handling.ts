/**
 * Canonical privacy/data-handling inventory.
 *
 * This registry describes current behavior, including incomplete controls. It
 * is not a promise that a missing automatic deletion job exists. Public copy
 * renders from the visitor-facing rows; the full registry is validated against
 * implementation sources by `scripts/validate-privacy-data-handling.ts`.
 */

export const PRIVACY_DATA_HANDLING_VERSION =
  "civica-privacy-data-handling/v1" as const;
export const PRIVACY_DATA_HANDLING_EFFECTIVE_ON = "2026-07-23";

export const PRIVACY_FLOW_IDS = [
  "browser-preferences",
  "contact-messages",
  "advisory-applications",
  "ask-civica",
  "remote-reader-resources",
  "hosting-request-logs",
  "route-performance",
  "rate-limits",
  "owner-admin",
  "pulse-coding",
  "error-monitoring",
] as const;

export type PrivacyFlowId = (typeof PRIVACY_FLOW_IDS)[number];
export type PrivacyAudience =
  | "ordinary-reader"
  | "voluntary-submitter"
  | "owner-admin"
  | "research-reviewer";

export interface PrivacyDataFlow {
  id: PrivacyFlowId;
  label: string;
  audiences: readonly PrivacyAudience[];
  trigger: string;
  data: string;
  purpose: string;
  destinations: string;
  retention: string;
  access: string;
  deletion: string;
  safeguards: string;
  providers: readonly string[];
  sourcePaths: readonly string[];
  publicSummary: boolean;
}

export const PRIVACY_DATA_FLOWS: readonly PrivacyDataFlow[] = [
  {
    id: "browser-preferences",
    label: "Browser preferences and chat display history",
    audiences: ["ordinary-reader"],
    trigger: "A reader changes theme or uses Ask Civica.",
    data:
      "Theme under `theme`; Ask Civica messages under a country/thread-scoped `civica.chat.*` key.",
    purpose: "Remember reader-controlled interface state on that device.",
    destinations:
      "The reader's browser local storage. Civica does not receive local-storage history merely because a page is opened.",
    retention: "Until the reader clears the conversation, site data, or browser storage.",
    access: "The reader and scripts running on the Civica origin.",
    deletion: "Clear the conversation or browser site data.",
    safeguards:
      "No cookie identifier or server-side profile is created for these preferences.",
    providers: [],
    sourcePaths: [
      "src/components/ThemeProvider.tsx",
      "src/components/factbook/CivicaAIDrawer.tsx",
    ],
    publicSummary: true,
  },
  {
    id: "contact-messages",
    label: "Contact messages",
    audiences: ["voluntary-submitter"],
    trigger: "A person submits the public contact form.",
    data: "Name, email address, subject, message, status, and submission time.",
    purpose: "Read, triage, and reply to the requested contact.",
    destinations:
      "Civica's Neon database and the authenticated owner-admin message queue.",
    retention:
      "No automatic maximum is currently implemented. Messages remain until the owner deletes them after the request or a related complaint/security need is resolved.",
    access: "Fernando Balino through the authenticated owner-admin surface.",
    deletion:
      "A sender may request deletion through the contact route; the owner-admin message detail supports permanent deletion.",
    safeguards:
      "Bounded input, honeypot, shared HMAC rate limit, no new raw-IP retention, private no-store admin responses, and common admin mutation audit.",
    providers: ["Vercel", "Neon"],
    sourcePaths: [
      "src/app/api/contact/route.ts",
      "src/app/api/admin/messages/[id]/route.ts",
      "src/app/(admin)/admin/messages/[id]/page.tsx",
      "src/lib/db/schema.ts",
    ],
    publicSummary: true,
  },
  {
    id: "advisory-applications",
    label: "Advisory-board applications",
    audiences: ["voluntary-submitter"],
    trigger:
      "An applicant submits the advisory-board form after accepting the versioned notice.",
    data:
      "Name, email, institution, role, expertise area, experience, optional links/CV URL, status, consent-version evidence, and submission time.",
    purpose:
      "Assess an expression of interest and contact the applicant about that application or a separately accepted review opportunity.",
    destinations:
      "Civica's Neon database and the authenticated owner-admin application queue.",
    retention:
      "Delete within 18 months of submission, including when a later appointment or review relationship receives its own record.",
    access: "Fernando Balino through the authenticated owner-admin surface.",
    deletion:
      "Applicants may request access, correction, or earlier deletion; the owner-admin application detail supports permanent deletion.",
    safeguards:
      "Explicit versioned consent, bounded input, honeypot, shared HMAC rate limit, no new raw-IP retention, and common admin mutation audit.",
    providers: ["Vercel", "Neon"],
    sourcePaths: [
      "src/lib/research/advisory-application.ts",
      "src/app/api/advisory-applications/route.ts",
      "src/app/api/admin/advisory-applications/[id]/route.ts",
      "src/lib/db/schema.ts",
    ],
    publicSummary: true,
  },
  {
    id: "ask-civica",
    label: "Ask Civica requests",
    audiences: ["ordinary-reader"],
    trigger: "A reader sends a question to Ask Civica.",
    data:
      "The question, selected public country/tab context, and a server-selected source-labelled evidence bundle are sent to Anthropic. Civica logs only closed contract/model/outcome fields and a bounded evidence count.",
    purpose: "Generate a bounded explanatory response and monitor safe operation.",
    destinations:
      "Anthropic's API for generation; bounded operational lines in Vercel Runtime Logs. Civica's application database stores no question, answer, or conversation history.",
    retention:
      "Browser history remains until the reader clears it. Provider/API and Vercel log retention follow the configured account arrangements; Civica does not claim Anthropic zero-data retention is enabled.",
    access:
      "Anthropic processes the request; Fernando can access bounded deployment logs, not a Civica database chat transcript.",
    deletion:
      "Clear browser history locally. Provider-managed request/log deletion follows the applicable provider arrangement.",
    safeguards:
      "Bounded body, server-selected evidence, prompt-injection rejection, shared HMAC rate limits, scoped API key, fixed safe errors, and no raw provider exception logging.",
    providers: ["Vercel", "Neon", "Anthropic"],
    sourcePaths: [
      "src/app/api/chat/route.ts",
      "src/lib/ask-civica/contract.ts",
      "src/components/factbook/CivicaAIDrawer.tsx",
    ],
    publicSummary: true,
  },
  {
    id: "remote-reader-resources",
    label: "Remote maps and flags",
    audiences: ["ordinary-reader"],
    trigger:
      "A reader opens a page that requests a remote flag/base map, or explicitly opens the optional Mapbox 3D view.",
    data:
      "Standard connection metadata visible to the remote host, such as IP address, browser/request headers, requested resource, and time. The public Mapbox token is sent for the 3D service.",
    purpose: "Display flags, a fallback base map, or the optional 3D map.",
    destinations:
      "FlagCDN, OpenFreeMap, the configured PMTiles host, or Mapbox depending on the exact surface and configuration.",
    retention: "Controlled by the selected remote provider and its terms.",
    access: "The relevant remote resource provider.",
    deletion:
      "Civica does not hold these provider logs; requests must be directed to the relevant provider.",
    safeguards:
      "Mapbox loads only after the reader selects 3D; missing configuration degrades visibly. Civica does not use these requests as behavioral analytics.",
    providers: ["FlagCDN", "OpenFreeMap", "configured PMTiles host", "Mapbox"],
    sourcePaths: [
      "src/components/CountryFlag.tsx",
      "src/lib/map/civica-map-style.ts",
      "src/components/factbook/Country3DView.tsx",
    ],
    publicSummary: true,
  },
  {
    id: "hosting-request-logs",
    label: "Hosting and delivery logs",
    audiences: ["ordinary-reader", "voluntary-submitter", "owner-admin", "research-reviewer"],
    trigger: "A browser or client requests a Civica page, asset, or API route.",
    data:
      "Routine delivery metadata the hosting platform can process, including IP address, request path, time, response status, and user-agent/browser information.",
    purpose: "Deliver, protect, and operate the website.",
    destinations: "Vercel's hosting and Runtime Logs systems.",
    retention:
      "Controlled by the configured Vercel plan/account and provider policy; Civica's repository does not enforce or claim an exact provider-log period.",
    access: "Fernando Balino and authorized Vercel service personnel under provider controls.",
    deletion:
      "Provider-managed; privacy requests can be routed through Civica for account-specific follow-up.",
    safeguards:
      "No third-party behavioral analytics or advertising tracker is installed; application telemetry below is separately content-free.",
    providers: ["Vercel"],
    sourcePaths: [
      "src/proxy.ts",
      "instrumentation.ts",
      "src/app/privacy/page.tsx",
    ],
    publicSummary: true,
  },
  {
    id: "route-performance",
    label: "Self-hosted route performance telemetry",
    audiences: ["ordinary-reader", "voluntary-submitter", "owner-admin", "research-reviewer"],
    trigger: "A production request or registered job completes.",
    data:
      "Route template, method, metric, bounded duration/status, cache profile, release identifier, and telemetry version.",
    purpose: "Measure reliability and performance by route class and release.",
    destinations: "Civica's Neon database.",
    retention: "30 days, with best-effort scheduled pruning.",
    access: "Fernando Balino through internal operational reporting.",
    deletion: "Rows older than the retention boundary are pruned.",
    safeguards:
      "No raw path parameter, query string, cookie, IP address, user agent, request body, account identifier, or exception text.",
    providers: ["Neon", "Vercel"],
    sourcePaths: [
      "src/lib/platform/route-performance-telemetry.ts",
      "src/lib/db/schema.ts",
      "plan/PLT-016-route-performance-telemetry-2026-07-15.md",
    ],
    publicSummary: false,
  },
  {
    id: "rate-limits",
    label: "Abuse-prevention counters",
    audiences: ["ordinary-reader", "voluntary-submitter", "owner-admin", "research-reviewer"],
    trigger: "A rate-limited route is requested.",
    data:
      "A scope-specific HMAC-SHA-256 request-identity digest, fixed-window count, and expiry time.",
    purpose: "Protect public forms, chat, authentication, and sensitive routes from abuse.",
    destinations: "Civica's Neon database.",
    retention:
      "Only through the active fixed window; expired rows are deleted by subsequent counter operations.",
    access: "Application enforcement code and Fernando Balino for bounded operations.",
    deletion: "Automatic expiry cleanup in the atomic counter statement.",
    safeguards:
      "Raw IP addresses never cross the durable-store boundary; an independent secret domain-separates the digest.",
    providers: ["Neon", "Vercel"],
    sourcePaths: [
      "src/lib/api/rate-limit.ts",
      "src/lib/api/rate-limit-subject.ts",
      "src/lib/db/schema.ts",
    ],
    publicSummary: false,
  },
  {
    id: "owner-admin",
    label: "Owner-admin sessions and audit",
    audiences: ["owner-admin"],
    trigger: "The owner signs in, signs out, or performs an admin mutation.",
    data:
      "Signed session identity/issued/expiry/random ID in an HttpOnly cookie; hashed revocation key; bounded actor, action, target, route, result, and time in append-only audit rows. Google OAuth handles bootstrap identity when used.",
    purpose: "Authenticate the owner, revoke sessions, and preserve accountable security/mutation evidence.",
    destinations:
      "Browser cookie, Civica's Neon database, Vercel, and Google only for optional owner OAuth.",
    retention:
      "The browser session expires after seven days. Revocation and append-only audit rows currently have no automatic deletion because they preserve security/accountability evidence.",
    access: "Fernando Balino through authenticated admin/operational tooling.",
    deletion:
      "Logout clears the browser cookie and stores a non-reversible revocation digest. Audit evidence is not user-editable.",
    safeguards:
      "HttpOnly/SameSite/Secure cookie, timing-safe checks, exact-origin mutation guard, hashed session identity, bounded closed audit fields, and no request body/IP/credential retention in the common audit.",
    providers: ["Vercel", "Neon", "Google (owner OAuth only)"],
    sourcePaths: [
      "src/lib/admin/session.ts",
      "src/lib/admin/mutation-audit.ts",
      "data/ADMIN-AUTHENTICATION.md",
      "src/lib/db/schema.ts",
    ],
    publicSummary: false,
  },
  {
    id: "pulse-coding",
    label: "Independent reviewer/coder workspace",
    audiences: ["research-reviewer", "owner-admin"],
    trigger:
      "The owner issues a pseudonymous participant credential and a coder/adjudicator uses the private workspace.",
    data:
      "Pseudonym, role, actor/use status, credential hash, expiry/access/revocation times, assignments, drafts, locked submissions, comparisons, adjudications, reason codes, notes, and bounded audit evidence.",
    purpose:
      "Run blinded double coding and adjudication while preserving the exact evaluation evidence and separation of roles.",
    destinations: "Civica's Neon database and authenticated coding/admin surfaces.",
    retention:
      "Research evidence is retained with the versioned study and append-only audit history; credentials can expire or be revoked. No automatic deletion period is currently declared.",
    access:
      "The assigned coder sees only their workspace; adjudicators and the owner receive role-bounded access.",
    deletion:
      "Credentials can be revoked. Locked research evidence is not overwritten or silently deleted; any participant-data request requires a study-specific disposition that preserves research integrity and applicable rights.",
    safeguards:
      "Pseudonyms, hashed credentials, narrow HttpOnly cookie, role separation, blind packets, immutable hashes, restrictive foreign keys, and append-only audit.",
    providers: ["Vercel", "Neon"],
    sourcePaths: [
      "src/lib/pulse/v2/coding-session.ts",
      "src/lib/pulse/v2/coding-store.ts",
      "src/lib/db/schema.ts",
    ],
    publicSummary: false,
  },
  {
    id: "error-monitoring",
    label: "Scrubbed error monitoring",
    audiences: ["ordinary-reader", "voluntary-submitter", "owner-admin", "research-reviewer"],
    trigger: "A registered server, client-boundary, cron, or script failure occurs.",
    data:
      "Closed surface/route-or-job/error/release/source-map identifiers, timestamps, count, status, and opaque correction/status record links.",
    purpose: "Detect, group, remediate, and resolve released-surface failures.",
    destinations: "Civica's Neon database and bounded Vercel alert logs.",
    retention: "90 days, with best-effort pruning.",
    access: "Fernando Balino through internal operational reporting.",
    deletion: "Rows older than the retention boundary are pruned.",
    safeguards:
      "No exception text, stack, digest, raw path, parameter, query, header, cookie, IP, user agent, request body, account identifier, source-map content, or reporter prose.",
    providers: ["Neon", "Vercel"],
    sourcePaths: [
      "src/lib/platform/error-monitoring.ts",
      "data/ERROR-MONITORING.md",
      "src/lib/db/schema.ts",
    ],
    publicSummary: false,
  },
];

export function privacyDataHandlingErrors(
  flows: readonly PrivacyDataFlow[] = PRIVACY_DATA_FLOWS,
): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const flow of flows) {
    if (ids.has(flow.id)) errors.push(`duplicate flow id: ${flow.id}`);
    ids.add(flow.id);
    for (const [label, value] of Object.entries({
      label: flow.label,
      trigger: flow.trigger,
      data: flow.data,
      purpose: flow.purpose,
      destinations: flow.destinations,
      retention: flow.retention,
      access: flow.access,
      deletion: flow.deletion,
      safeguards: flow.safeguards,
    })) {
      if (!value.trim()) errors.push(`${flow.id}: empty ${label}`);
    }
    if (flow.audiences.length === 0)
      errors.push(`${flow.id}: no audience declared`);
    if (flow.sourcePaths.length === 0)
      errors.push(`${flow.id}: no source path declared`);
  }
  for (const id of PRIVACY_FLOW_IDS) {
    if (!ids.has(id)) errors.push(`missing flow id: ${id}`);
  }
  for (const id of ids) {
    if (!(PRIVACY_FLOW_IDS as readonly string[]).includes(id))
      errors.push(`unknown flow id: ${id}`);
  }
  return errors;
}

export const PUBLIC_PRIVACY_DATA_FLOWS = PRIVACY_DATA_FLOWS.filter(
  (flow) => flow.publicSummary,
);
