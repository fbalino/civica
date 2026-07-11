import { researchPanelHash } from "./research-panel";

export const INDEX_READER_TASK_PROTOCOL = Object.freeze({
  schemaVersion: "civica-index-reader-task-protocol/v1",
  protocolId: "index-reader-task-protocol-v1",
  status: "preregistered_before_human_responses",
  conditions: {
    K0: "source-native dashboard with native scales, provenance, vintage, direction, uncertainty or explicit absence, and no composite",
    K1: "current derivative composite with score position, four component values, provenance, missingness, and uncertainty limitations",
  },
  design: {
    type: "within-participant randomized crossover",
    minimumQualifiedParticipants: 30,
    allocation: "Latin-square condition and task-order balancing with deterministic assignment from anonymous participant id",
    qualification: [
      "comparative-politics or governance researcher",
      "data journalist who uses cross-country indicators",
      "civil-society or public-sector analyst who evaluates governance evidence",
    ],
    exclusions: ["Civica owner or contributor", "prior access to answer key", "failed attention check", "duplicate participant"],
    noTrainingOnTestItems: true,
  },
  tasks: [
    { id: "direction", construct: "native-scale comprehension", promptKind: "identify whether a higher displayed value has better, worse, or source-specific meaning", scored: "exact" },
    { id: "comparison", construct: "cross-country comparison", promptKind: "identify which source supports a stated difference and whether all sources agree", scored: "two-part exact" },
    { id: "uncertainty", construct: "uncertainty awareness", promptKind: "state which inputs have publisher bounds and whether the display supports a composite confidence interval", scored: "three-part exact" },
    { id: "trace", construct: "citation and source tracing", promptKind: "locate owner, vintage, observation, and source link for one value", scored: "four-part exact plus completion time" },
    { id: "missingness", construct: "missing-data comprehension", promptKind: "explain why one country has fewer inputs and whether absence means a zero", scored: "three-part exact" },
    { id: "nonclaim", construct: "misuse resistance", promptKind: "select every conclusion the artifact does not support", scored: "all-and-only exact" },
  ],
  outcomes: {
    primary: ["participant-level task accuracy", "median correct-task completion time"],
    secondary: ["uncertainty misconception rate", "source-trace completion", "unsupported country-verdict selection", "self-rated confidence"],
    timing: "monotonic client timer from first render to final answer; idle periods above five minutes flagged before exclusion review",
  },
  decisionRule: {
    accuracyGainPercentagePoints: 10,
    medianTimeReductionFraction: 0.2,
    comprehensionNoninferiorityMarginPercentagePoints: 0,
    boundedDerivativeUtilityPass: "K1 must improve accuracy by at least 10 percentage points or reduce median correct-task time by at least 20%, with no loss in comprehension, source tracing, uncertainty awareness, or nonclaim accuracy.",
    tie: "prefer K0",
  },
  analysis: {
    unit: "participant",
    accuracy: "paired participant-level difference with exact randomization interval and bootstrap interval",
    time: "paired median ratio among correct responses; report timeout and incorrect-response counts separately",
    multiplicity: "primary family evaluated as the frozen noncompensating utility rule; secondary outcomes descriptive with Holm-adjusted tests",
    subgroups: "report expertise family only when each cell has at least 10; never winner-select on subgroup",
    missingResponses: "no imputation; report by condition and task",
  },
  agentDryRun: {
    allowedPurpose: "detect ambiguous prompts, broken links, answer-key leakage, and instrumentation failures",
    prohibitedPurpose: "claim human comprehension, utility, interpretability, or G5 passage",
    labeling: "provisional_agent_simulation",
  },
  dependencies: ["IDX-031 K0 dashboard fixture", "frozen K1 fixture", "G5 qualified human recruitment", "GOV-014 reviewer packet"],
} as const);

export const INDEX_READER_TASK_PROTOCOL_SHA256 = researchPanelHash(INDEX_READER_TASK_PROTOCOL);

export function readerTaskProtocolErrors(protocol = INDEX_READER_TASK_PROTOCOL): string[] {
  const errors: string[] = [];
  if (protocol.status !== "preregistered_before_human_responses") errors.push("protocol is not preregistered");
  if (protocol.design.minimumQualifiedParticipants < 30) errors.push("qualified sample is below 30");
  if (protocol.tasks.length < 6) errors.push("task family is incomplete");
  for (const required of ["uncertainty", "trace", "missingness", "nonclaim"]) if (!protocol.tasks.some((task) => task.id === required)) errors.push(`missing ${required} task`);
  if (!protocol.agentDryRun.prohibitedPurpose.includes("G5")) errors.push("agent simulation can be mistaken for G5 evidence");
  if (protocol.decisionRule.tie !== "prefer K0") errors.push("tie rule drifted");
  return errors;
}
