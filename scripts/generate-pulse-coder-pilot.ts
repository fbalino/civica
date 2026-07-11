import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  PULSE_CODER_PILOT_VERSION,
  PULSE_INDEPENDENT_CODING_VERSION,
  type PulseCoderEvidence,
  type PulseCoderPilotPacket,
} from "../src/lib/pulse/v2/coder-protocol";
import { PULSE_EVENT_ONTOLOGY_VERSION } from "../src/lib/pulse/v2/event-ontology";

const searchFamilies = [
  "institutions",
  "accountabilitySecurity",
  "broadCountryDay",
];

function evidence(
  id: string,
  channel: PulseCoderEvidence["channel"],
  sourceFamilyId: string,
  text: string,
  reportedDate: string | null = "2026-06-15",
  accessState: PulseCoderEvidence["accessState"] = "accessible",
): PulseCoderEvidence {
  return { id, channel, sourceFamilyId, accessState, reportedDate, text };
}

function packet(
  id: string,
  split: PulseCoderPilotPacket["split"],
  countryAlias: string,
  date: string,
  items: PulseCoderEvidence[],
  options: {
    outage?: boolean;
    outageNote?: string;
    restricted?: boolean;
    teachingAnswer?: Record<string, unknown>;
  } = {},
): PulseCoderPilotPacket {
  return {
    id,
    split,
    synthetic: true,
    countryAlias,
    date,
    searchFamilies: [...searchFamilies],
    telemetry: {
      outage: options.outage ?? false,
      note: options.outageNote ?? "No source outage is supplied in the packet.",
    },
    informationEnvironment: options.restricted
      ? "restricted_sourced"
      : "not_supplied",
    evidence: items,
    ...(options.teachingAnswer
      ? { teachingAnswer: options.teachingAnswer }
      : {}),
  };
}

const training: PulseCoderPilotPacket[] = [
  packet(
    "TRAIN-ASTER-ELECTION",
    "training",
    "Republic Aster",
    "2026-06-15",
    [
      evidence("a1", "pulse_retained", "observer", "An independent observer mission assessed the completed national election as competitive and procedurally sound, with no material count irregularity."),
      evidence("a2", "pulse_retained", "election_commission", "The election commission certified the count and published station totals."),
      evidence("a3", "pulse_retained", "news_a", "The successor accepted the certified result; inauguration is scheduled for a later date."),
      evidence("a4", "pulse_retained", "rights_monitor", "Two campaign offices were attacked before polling, injuring six party workers."),
      evidence("a5", "pulse_retained", "news_b", "Police opened investigations into the campaign attacks."),
    ],
    { teachingAnswer: { packetOutcome: "qualifying_event", observationState: "sufficient_observation", categories: ["fair_election", "electoral_violence"], teachingPoint: "Separate the assessed election process from the independently evidenced violence facet; do not code peaceful_transfer before handover." } },
  ),
  packet(
    "TRAIN-BRINDLE-COUP",
    "training",
    "State Brindle",
    "2026-06-15",
    [
      evidence("b1", "pulse_retained", "news_a", "Armed officers seized the executive offices and announced that the elected government had been removed."),
      evidence("b2", "pulse_retained", "official_notice", "The takeover council dissolved the elected legislature by decree."),
      evidence("b3", "pulse_retained", "press_monitor", "A separate order closed three national broadcasters."),
    ],
    { teachingAnswer: { packetOutcome: "qualifying_event", observationState: "low_coverage", categories: ["coup", "constitutional_override_electoral", "media_shutdown"], teachingPoint: "Low observation does not erase an observed event. Each cascade label needs its own evidence and facet." } },
  ),
  packet(
    "TRAIN-CEDAR-DISASTER",
    "training",
    "Commonwealth Cedar",
    "2026-06-15",
    [
      evidence("c1", "pulse_retained", "emergency_office", "The disaster office issued a weather emergency notice without activating exceptional legal powers."),
      evidence("c2", "pulse_retained", "parliament", "Parliament met under its ordinary rules and took no emergency-power vote."),
      evidence("c3", "pulse_retained", "court", "Courts remained on their ordinary schedule."),
      evidence("c4", "pulse_retained", "news_a", "The notice concerned road closures and shelter access."),
      evidence("c5", "pulse_retained", "news_b", "No election, rights, court, cabinet, or constitutional process changed that day."),
    ],
    { teachingAnswer: { packetOutcome: "true_negative", observationState: "sufficient_observation", categories: [], teachingPoint: "A routine disaster notice with no governance-relevant legal effect is non-qualifying; true_negative remains audit-bounded." } },
  ),
  packet(
    "TRAIN-DUNE-AMBIGUITY",
    "training",
    "Federation Dune",
    "2026-06-15",
    [
      evidence("d1", "audit_search", "court", "A court convicted an opposition leader of procurement corruption."),
      evidence("d2", "context", "news_a", "The defense alleged political targeting, while the judgment described documentary procurement evidence."),
      evidence("d3", "context", "news_b", "No evidence in the packet assesses prosecutorial or judicial independence."),
    ],
    { teachingAnswer: { packetOutcome: "insufficient_observation", observationState: "low_coverage", categories: [], candidateCategories: ["corruption_conviction", "opposition_prosecution"], teachingPoint: "Retain both plausible labels as candidates; neither the conviction nor opposition status resolves institutional independence or political motive." } },
  ),
  packet(
    "TRAIN-ELM-RETRIEVAL",
    "training",
    "Republic Elm",
    "2026-06-15",
    [
      evidence("e1", "audit_search", "court", "The supreme court ordered the executive to restore the dismissed auditor."),
      evidence("e2", "audit_search", "official_notice", "The executive published a directive refusing to implement the binding order."),
      evidence("e3", "context", "news_a", "The refusal occurred on the sampled date."),
    ],
    { teachingAnswer: { packetOutcome: "retrieval_miss", observationState: "low_coverage", categories: ["executive_court_defiance"], teachingPoint: "An event supported only outside retained Pulse evidence is a retrieval miss even when general observation is low." } },
  ),
  packet(
    "TRAIN-FERN-SILENCE",
    "training",
    "Kingdom Fern",
    "2026-06-15",
    [
      evidence("f1", "context", "search_provider", "All three query families returned no result.", null, "metadata_only"),
    ],
    { teachingAnswer: { packetOutcome: "insufficient_observation", observationState: "low_coverage", categories: [], teachingPoint: "Search silence is not a true negative." } },
  ),
];

const blindPilot: PulseCoderPilotPacket[] = [
  packet("PILOT-001", "blind_pilot", "Republic Garnet", "2026-06-15", [
    evidence("g1", "pulse_retained", "election_commission", "The certified winner took the constitutional oath and the incumbent transferred the seals of office."),
    evidence("g2", "pulse_retained", "news_a", "The handover occurred without force or interruption."),
    evidence("g3", "pulse_retained", "parliament", "Parliament recorded the successor's assumption of office."),
  ]),
  packet("PILOT-002", "blind_pilot", "State Harbor", "2026-06-15", [
    evidence("h1", "audit_search", "network_monitor", "A government order disabled national mobile and fixed internet connectivity for nine hours."),
    evidence("h2", "audit_search", "news_a", "Connectivity measurements confirmed the national outage on the sampled date."),
  ]),
  packet("PILOT-003", "blind_pilot", "Commonwealth Indigo", "2026-06-15", [
    evidence("i1", "pulse_retained", "parliament", "Parliament held a routine committee hearing."),
    evidence("i2", "pulse_retained", "court", "The high court issued an ordinary commercial judgment."),
    evidence("i3", "pulse_retained", "election_commission", "The commission published unchanged voter-information material."),
    evidence("i4", "pulse_retained", "news_a", "Daily political coverage reported no institutional occurrence in scope."),
    evidence("i5", "pulse_retained", "news_b", "A second independent newsroom reported the same quiet institutional calendar without copying the first."),
  ]),
  packet("PILOT-004", "blind_pilot", "Republic Juniper", "2026-06-15", [
    evidence("j1", "context", "search_provider", "The broad query returned one inaccessible result with no usable date or text.", null, "inaccessible"),
  ]),
  packet("PILOT-005", "blind_pilot", "Federation Kestrel", "2026-06-15", [
    evidence("k1", "context", "connector_telemetry", "Every registered feed failed before returning documents.", null, "metadata_only"),
  ], { outage: true, outageNote: "The frozen telemetry records a complete source outage for the sampled day." }),
  packet("PILOT-006", "blind_pilot", "Republic Lumen", "2026-06-15", [
    evidence("l1", "pulse_retained", "press_monitor", "Authorities detained a named investigative journalist after publication of an official-corruption report."),
    evidence("l2", "pulse_retained", "court", "The detention order identifies the journalist and the sampled date."),
  ], { restricted: true }),
  packet("PILOT-007", "blind_pilot", "State Morrow", "2026-06-15", [
    evidence("m1", "pulse_retained", "election_commission", "The commission disqualified a named parliamentary candidate by formal order."),
    evidence("m2", "audit_search", "wire_origin", "A wire report describes the same order."),
    evidence("m3", "audit_search", "wire_origin", "A newspaper republishes the same wire report without new evidence."),
  ]),
  packet("PILOT-008", "blind_pilot", "Republic Northstar", "2026-06-15", [
    evidence("n1", "audit_search", "news_a", "A court-defiance event occurred on 2026-06-14, one day before the sampled date.", "2026-06-15"),
    evidence("n2", "pulse_retained", "parliament", "Parliament met routinely on the sampled date."),
    evidence("n3", "pulse_retained", "court", "Courts published their ordinary docket on the sampled date."),
    evidence("n4", "pulse_retained", "news_b", "No new institutional occurrence was reported for the sampled date."),
    evidence("n5", "pulse_retained", "official_notice", "The daily gazette contained no exceptional institutional action."),
  ]),
  packet("PILOT-009", "blind_pilot", "Commonwealth Ochre", "2026-06-15", [
    evidence("o1", "pulse_retained", "foreign_ministry", "The foreign ministry imposed a tariff on imports from another state."),
    evidence("o2", "pulse_retained", "parliament", "Domestic institutions otherwise followed the ordinary calendar."),
    evidence("o3", "pulse_retained", "court", "Courts reported no related domestic proceeding."),
    evidence("o4", "pulse_retained", "news_a", "Coverage concerned only the external trade dispute."),
    evidence("o5", "pulse_retained", "news_b", "A second source reported no separate domestic institutional occurrence."),
  ]),
  packet("PILOT-010", "blind_pilot", "Republic Plover", "2026-06-15", [
    evidence("p1", "pulse_retained", "disaster_office", "A flood warning activated shelters and road closures under ordinary disaster law."),
    evidence("p2", "pulse_retained", "parliament", "No exceptional legislative or executive authority was activated."),
    evidence("p3", "pulse_retained", "court", "Courts retained ordinary jurisdiction and schedules."),
    evidence("p4", "pulse_retained", "news_a", "No rights restriction accompanied the warning."),
    evidence("p5", "pulse_retained", "news_b", "Independent coverage confirmed only routine emergency logistics."),
  ]),
  packet("PILOT-011", "blind_pilot", "Federation Quartz", "2026-06-15", [
    evidence("q1", "audit_search", "court", "An opposition legislator was charged with bribery on the sampled date."),
    evidence("q2", "audit_search", "news_a", "The opposition called the charge political; prosecutors cited bank records that are not included in the packet."),
    evidence("q3", "context", "news_b", "No source in the packet assesses selective motive, process independence, or the underlying bank records."),
  ]),
  packet("PILOT-012", "blind_pilot", "Republic Rowan", "2026-06-15", [
    evidence("r1", "pulse_retained", "news_a", "Armed officers removed the elected government and occupied the executive offices."),
    evidence("r2", "audit_search", "official_notice", "The takeover authority dissolved the elected legislature by decree."),
    evidence("r3", "audit_search", "press_monitor", "A separate order closed the national broadcaster."),
  ]),
];

const body = {
  schemaVersion: PULSE_CODER_PILOT_VERSION,
  codebookVersion: PULSE_INDEPENDENT_CODING_VERSION,
  ontologyVersion: PULSE_EVENT_ONTOLOGY_VERSION,
  frozenOn: "2026-07-11",
  labelAccessAtFreeze: "none_for_blind_pilot",
  purpose: "Synthetic instruction and tooling pilot only; no packet may enter performance estimation or a gold release.",
  packets: [...training, ...blindPilot],
};
const artifact = {
  ...body,
  semanticSha256: createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex"),
};
const output = resolve("data/research/pulse-coder-pilot-v1.json");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(artifact, null, 2)}\n`);
console.log(`Wrote ${output}: ${training.length} training + ${blindPilot.length} blind pilot packets; hash ${artifact.semanticSha256}`);
