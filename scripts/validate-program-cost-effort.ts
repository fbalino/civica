import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

type Ledger = {
  schemaVersion: string;
  status: string;
  reportingPolicy: {
    nextReviewDue: string;
    instructions: string[];
  };
  budgetContract: {
    source: string;
    mode: string;
    apiApproved: boolean;
    capUSD: number;
    provider: string | null;
    model: string | null;
  };
  subscriptionAccess: Array<{
    provider: string;
    planName: string | null;
    confirmation: string;
  }>;
  billingReconciliation: {
    actualPaidApiSpendUSD: number | null;
    externalHumanSpendCommittedUSD: number | null;
    ownerBillingEvidenceReviewed: boolean;
    ownerHumanSpendConfirmed: boolean;
    status: string;
    modelAccountingEstimates: {
      artifactCount: number;
      reportedUSD: number;
      classification: string;
    };
  };
  gateRegister: Array<{
    gate: string;
    currentState: string;
    evidence: string;
  }>;
  weeklySnapshots: Array<{
    periodStart: string;
    periodEnd: string;
    throughCommit: string;
    commitsSinceProgramStart?: number;
    commitsInPeriod?: number;
    activeCommitDays: number;
    apiAuthorization: string;
    apiCapUSD: number;
    ownerConfirmation: string;
  }>;
  unresolvedOwnerFacts: string[];
};

type OrchestratorState = {
  budget: {
    mode: string;
    api_approved: boolean;
    cap_usd: number;
    provider: string | null;
    model: string | null;
  };
};

const ledgerPath = "data/program-cost-effort-ledger.v1.json";
const statePath = ".orchestrator/state.json";
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as Ledger;
const state = JSON.parse(readFileSync(statePath, "utf8")) as OrchestratorState;
const errors: string[] = [];

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

if (ledger.schemaVersion !== "civica-program-cost-effort-ledger/v1") {
  errors.push(`unexpected schemaVersion ${ledger.schemaVersion}`);
}

if (ledger.budgetContract.source !== statePath) {
  errors.push(`budget source must be ${statePath}`);
}

const budgetPairs: Array<[string, unknown, unknown]> = [
  ["mode", ledger.budgetContract.mode, state.budget.mode],
  ["apiApproved", ledger.budgetContract.apiApproved, state.budget.api_approved],
  ["capUSD", ledger.budgetContract.capUSD, state.budget.cap_usd],
  ["provider", ledger.budgetContract.provider, state.budget.provider],
  ["model", ledger.budgetContract.model, state.budget.model],
];
for (const [field, actual, expected] of budgetPairs) {
  if (actual !== expected) {
    errors.push(`budget ${field} drift: ledger=${String(actual)} state=${String(expected)}`);
  }
}

const gates = new Set(ledger.gateRegister.map((entry) => entry.gate));
for (const gate of ["G0", "G1", "G2", "G3", "G4", "G5", "G6"]) {
  if (!gates.has(gate)) errors.push(`missing gate register entry ${gate}`);
}
if (gates.size !== 7) errors.push("gate register must contain exactly G0-G6");
for (const entry of ledger.gateRegister) {
  if (!existsSync(entry.evidence)) {
    errors.push(`${entry.gate} evidence does not exist: ${entry.evidence}`);
  }
}

if (ledger.weeklySnapshots.length < 2) {
  errors.push("weekly ledger must retain at least two snapshots");
}
for (let index = 0; index < ledger.weeklySnapshots.length; index += 1) {
  const snapshot = ledger.weeklySnapshots[index];
  const start = Date.parse(`${snapshot.periodStart}T00:00:00Z`);
  const end = Date.parse(`${snapshot.periodEnd}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    errors.push(`invalid weekly interval ${snapshot.periodStart}..${snapshot.periodEnd}`);
  }
  if ((end - start) / 86_400_000 > 7) {
    errors.push(`weekly interval exceeds seven days: ${snapshot.periodStart}..${snapshot.periodEnd}`);
  }
  if (index > 0) {
    const priorEnd = Date.parse(
      `${ledger.weeklySnapshots[index - 1].periodEnd}T00:00:00Z`,
    );
    if ((start - priorEnd) / 86_400_000 !== 1) {
      errors.push(`weekly snapshots are not contiguous at ${snapshot.periodStart}`);
    }
  }
  try {
    git("cat-file", "-e", `${snapshot.throughCommit}^{commit}`);
  } catch {
    errors.push(`snapshot commit does not exist: ${snapshot.throughCommit}`);
  }
  if (snapshot.apiAuthorization !== "not_approved" || snapshot.apiCapUSD !== 0) {
    errors.push(`snapshot ${snapshot.periodEnd} contradicts the zero-dollar API contract`);
  }
  if (snapshot.ownerConfirmation !== "missing") {
    errors.push(`snapshot ${snapshot.periodEnd} claims unrecorded owner confirmation`);
  }
}

const firstSnapshot = ledger.weeklySnapshots[0];
if (
  firstSnapshot.commitsSinceProgramStart !==
  Number(
    git(
      "rev-list",
      "--count",
      `cf908bfc^..${firstSnapshot.throughCommit}`,
    ),
  )
) {
  errors.push("first weekly activity proxy does not match Git");
}
const secondSnapshot = ledger.weeklySnapshots[1];
if (
  secondSnapshot.commitsInPeriod !==
  Number(
    git(
      "rev-list",
      "--count",
      `${firstSnapshot.throughCommit}..${secondSnapshot.throughCommit}`,
    ),
  )
) {
  errors.push("second weekly activity proxy does not match Git");
}

const costFiles = git(
  "grep",
  "-l",
  '"costUSD"',
  "--",
  ".orchestrator",
  "plan/evidence",
)
  .split("\n")
  .filter(Boolean);
let costCount = 0;
let costSum = 0;
const visitCosts = (value: unknown) => {
  if (Array.isArray(value)) {
    value.forEach(visitCosts);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "costUSD" && typeof child === "number") {
      costCount += 1;
      costSum += child;
    } else {
      visitCosts(child);
    }
  }
};
for (const path of costFiles) {
  visitCosts(JSON.parse(readFileSync(path, "utf8")));
}
const estimates = ledger.billingReconciliation.modelAccountingEstimates;
if (estimates.artifactCount !== costCount) {
  errors.push(`model accounting count drift: ledger=${estimates.artifactCount} repo=${costCount}`);
}
if (Math.abs(estimates.reportedUSD - costSum) > 0.000001) {
  errors.push(`model accounting sum drift: ledger=${estimates.reportedUSD} repo=${costSum}`);
}
if (estimates.classification !== "non_billing_telemetry") {
  errors.push("model accounting estimates must not be classified as billed spend");
}

const ownerFactsResolved =
  ledger.subscriptionAccess.every(
    (entry) => entry.planName && entry.confirmation === "owner_confirmed",
  ) &&
  ledger.billingReconciliation.ownerBillingEvidenceReviewed &&
  ledger.billingReconciliation.ownerHumanSpendConfirmed &&
  ledger.billingReconciliation.actualPaidApiSpendUSD !== null &&
  ledger.billingReconciliation.externalHumanSpendCommittedUSD !== null &&
  ledger.unresolvedOwnerFacts.length === 0;

if (ownerFactsResolved && ledger.status !== "complete") {
  errors.push("all owner facts are resolved but ledger status is not complete");
}
if (!ownerFactsResolved && ledger.status !== "blocked_owner_confirmation") {
  errors.push("unresolved owner facts require blocked_owner_confirmation status");
}
if (
  ledger.billingReconciliation.actualPaidApiSpendUSD !== null &&
  ledger.billingReconciliation.actualPaidApiSpendUSD > ledger.budgetContract.capUSD
) {
  errors.push("actual paid API spend exceeds the approved cap");
}

if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(
  `PASS — ${ledger.schemaVersion}: two contiguous weekly snapshots, G0-G6 register, zero-dollar API authorization, and ${costCount} non-billing accounting estimates are bound; owner facts remain explicitly unresolved.`,
);
