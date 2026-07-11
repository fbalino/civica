export const PULSE_LEDGER_CHARTER_VERSION = "pulse-ledger-charter/v1" as const;

export const PULSE_LEDGER_RESEARCH_CHARTER = Object.freeze({
  id: PULSE_LEDGER_CHARTER_VERSION,
  adoptedOn: "2026-07-11",
  status: "active_research_charter",
  canonicalUrl:
    "https://civicaatlas.org/civica-index/methodology/pulse#research-charter",
  unit: Object.freeze({
    name: "documented governance-relevant event record",
    definition:
      "One versioned ledger record asserting that an identifiable occurrence affecting a jurisdiction's domestic governing institutions took place at a stated event date, with retained source evidence and an explicit publication state.",
    evidenceUnit:
      "A source item is evidence for an event record; it is not automatically an independent event or independent corroboration.",
    excludedUnits: Object.freeze([
      "country quality",
      "country-day stability",
      "article count",
      "model vote",
      "scalar governance score",
    ]),
  }),
  targetUsers: Object.freeze([
    "Researchers auditing documented institutional events and source trails",
    "Journalists and civic educators seeking dated governance context",
    "Civica reviewers evaluating retrieval, classification, and publication errors",
    "Data users who can preserve event-level uncertainty and observability limits",
  ]),
  prohibitedUses: Object.freeze([
    "Automated eligibility, sanctions, lending, migration, hiring, or security decisions",
    "Country league tables, grades, rankings, or risk scores",
    "A substitute for specialist conflict, rights, legal, or election datasets",
    "Inference that an unobserved event did not occur",
  ]),
  inclusionRules: Object.freeze([
    Object.freeze({
      id: "INC-1",
      rule: "The occurrence concerns a domestic institution, office, law, election, constitutional process, rights restriction or protection, corruption-control action, or stability rupture covered by the versioned ontology.",
    }),
    Object.freeze({
      id: "INC-2",
      rule: "The record names an event date or a bounded date interval and distinguishes that date from retrieval and publication time.",
    }),
    Object.freeze({
      id: "INC-3",
      rule: "At least one retained source identity supports the event assertion, subject jurisdiction, and published description.",
    }),
    Object.freeze({
      id: "INC-4",
      rule: "The subject jurisdiction is explicit or supported by recorded attribution evidence; unresolved attribution does not become a published country event.",
    }),
    Object.freeze({
      id: "INC-5",
      rule: "The occurrence is distinguishable from commentary, prediction, a source outage, and a duplicate or republication of the same underlying event.",
    }),
    Object.freeze({
      id: "INC-6",
      rule: "Normatively ambiguous or lawful events may enter as descriptive records when the occurrence is in scope; inclusion does not imply that the event improves or harms governance.",
    }),
  ]),
  exclusionRules: Object.freeze([
    Object.freeze({
      id: "EXC-1",
      rule: "Opinion, analysis, rhetoric, prediction, polling movement, or a general condition without an identifiable institutional occurrence is excluded.",
    }),
    Object.freeze({
      id: "EXC-2",
      rule: "A foreign-policy act is excluded from the target country's domestic ledger unless a separately evidenced domestic institutional event occurs there.",
    }),
    Object.freeze({
      id: "EXC-3",
      rule: "Macroeconomic, disaster, crime, protest, or conflict reporting without a documented governance-relevant institutional occurrence is excluded.",
    }),
    Object.freeze({
      id: "EXC-4",
      rule: "Rumor, an inaccessible assertion with no retainable evidence identity, and model-generated claims without source support are excluded.",
    }),
    Object.freeze({
      id: "EXC-5",
      rule: "Wire copies, mirrors, summaries of one report, and duplicate articles remain evidence relationships rather than additional events or independent corroboration.",
    }),
    Object.freeze({
      id: "EXC-6",
      rule: "No qualifying event observed, low retrieval yield, and source failure are observability states, not positive stability events.",
    }),
  ]),
  nonClaims: Object.freeze([
    "The ledger is not complete, exhaustive, real-time, or continuously observed.",
    "A missing record does not establish stability, absence, or good governance.",
    "A published event is not a country-quality judgment, score, grade, rank, or causal estimate.",
    "Publication does not imply full human review, independent corroboration, calibrated confidence, or academic validation.",
    "Event counts and source counts are not comparable measures of country performance.",
  ]),
  sourceUniverse: Object.freeze({
    eligibleClasses: Object.freeze([
      "Specialist rights, democracy, conflict, constitutional, legislative, and election monitors",
      "Official institutional documents and notices when their identity and rights posture are recorded",
      "Established news reporting used for discovery or evidence, subject to republication controls",
    ]),
    currentRuntimeReference: "/api/v1/pulse/methodology",
    boundary:
      "A configured connector is not an active source. Only feeds with observed, versioned retrieval records belong to the current production basket.",
  }),
  scope: Object.freeze({
    geographic:
      "Canonical Civica jurisdictions with recorded subject-attribution evidence. Public comparative evaluation centers sovereign states; ambiguous and cross-border attribution remains unpublished until it can be represented explicitly.",
    temporal:
      "At charter adoption, the retained provisional event history began 2026-04-13. That date is the earliest stored event in the adoption snapshot, not the start of complete observation. No claim extends before retained retrieval evidence, and future releases name their own observation window.",
    languages:
      "All languages are eligible in principle, but actual language coverage is limited to operating feeds and model support disclosed by each runtime release.",
  }),
  observabilityLimitations: Object.freeze([
    "Restricted media, censorship, connectivity limits, and access barriers can suppress detectable evidence.",
    "Feed outages, query design, paywalls, language coverage, and publisher cadence can create retrieval gaps.",
    "Source concentration and republication can make apparent corroboration dependent rather than independent.",
    "No-event and low-observation states must remain separate in storage, evaluation, API output, and prose.",
  ]),
  successCriteria: Object.freeze([
    "Every released event preserves source identity, event time, subject evidence, ontology and method versions, publication state, and correction history.",
    "Representative evaluation measures retrieval, clustering, attribution, labels, severity, abstention, and publication separately under preregistered thresholds.",
    "Subgroup and source-bias results meet their preregistered gates or are reported as insufficient without compensation from other metrics.",
    "Reader studies show that qualified users can trace evidence and understand observability and uncertainty without treating the ledger as a country score.",
    "Prospective shadow results and adverse findings are retained and published before any stronger product claim.",
  ]),
  suspensionOrRetirementCriteria: Object.freeze([
    "Suspend affected publication when source rights, evidence identity, attribution, or correction trace cannot be maintained.",
    "Suspend comparative use when observability states cannot be separated from no qualifying event observed.",
    "Retire or redesign the ledger if preregistered retrieval, event-identity, attribution, or subgroup safety gates fail and a bounded repair does not pass a new versioned evaluation.",
    "Retire numeric effects if they encourage country-quality interpretation or fail the later Pulse disposition; the event ledger may continue independently.",
    "A no-value result is valid and cannot be overridden by model agreement, selected anecdotes, or owner preference.",
  ]),
  versioningRule:
    "Changing the unit, inclusion or exclusion boundary, source classes, geographic or temporal scope, success gates, or retirement rules requires a new charter version and migration note. New evidence does not rewrite this version.",
} as const);

export type PulseLedgerResearchCharter =
  typeof PULSE_LEDGER_RESEARCH_CHARTER;

export function validatePulseLedgerResearchCharter(
  charter: PulseLedgerResearchCharter,
): string[] {
  const errors: string[] = [];
  const ids = [
    ...charter.inclusionRules.map((rule) => rule.id),
    ...charter.exclusionRules.map((rule) => rule.id),
  ];
  if (new Set(ids).size !== ids.length) errors.push("rule ids must be unique");
  if (charter.inclusionRules.length < 6)
    errors.push("at least six inclusion rules are required");
  if (charter.exclusionRules.length < 6)
    errors.push("at least six exclusion rules are required");
  if (charter.nonClaims.length < 5)
    errors.push("at least five explicit non-claims are required");
  if (charter.observabilityLimitations.length < 4)
    errors.push("observability limitations are incomplete");
  if (charter.successCriteria.length < 5)
    errors.push("success criteria are incomplete");
  if (charter.suspensionOrRetirementCriteria.length < 5)
    errors.push("suspension or retirement criteria are incomplete");
  if (!charter.canonicalUrl.endsWith("#research-charter"))
    errors.push("canonical citation anchor is missing");
  return errors;
}
