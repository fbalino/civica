import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import {
  selectValueFidelitySample,
  sha256,
  VALUE_FIDELITY_SEED,
  VALUE_FIDELITY_SOURCE_QUOTAS,
  wilson95,
  type FidelitySampleCandidate,
} from "../src/lib/data/value-fidelity";

const releasePath =
  "data/releases/atlas-2026-07-11/g2-rc1/atlas-export.v1.json.gz";
const protocolPath =
  "plan/research/dat-034-value-fidelity-protocol-v1.md";
const outputPath = "data/atlas-value-fidelity-audit.v1.json";
const capture = process.argv.includes("--capture");
const CIA_RETIREMENT_URL =
  "https://www.cia.gov/stories/story/spotlighting-the-world-factbook-as-we-bid-a-fond-farewell/";
const CIA_FIRECRAWL_CAPTURE_SHA256 =
  "b87df8d5a636170f18003c117fbc11ea0c6f7c5bbb439ad27c1e53bd009709ec";

type Jurisdiction = {
  id: string;
  slug: string;
  name: string;
  iso3: string | null;
  wikidata_qid: string | null;
};

type Fact = {
  id: string;
  canonical_fact_id: string;
  jurisdiction_id: string;
  fact_key: string;
  fact_group: string;
  category: string;
  source_id: string;
  source_url: string | null;
  fact_value: string | null;
  fact_value_numeric: number | null;
  fact_unit: string | null;
  value_status: string;
  as_of: string | null;
  observation_reference_year: number | null;
  upstream_dataset_release: string | null;
  content_hash: string;
};

type Release = {
  schemaVersion: string;
  releaseId: string;
  tables: {
    jurisdictions: Jurisdiction[];
    facts: Fact[];
  };
};

type Outcome =
  | "match"
  | "confirmed_defect"
  | "publisher_revision_unresolved"
  | "publisher_value_unavailable"
  | "publisher_surface_unavailable"
  | "verification_error";

type LedgerRow = {
  sampleIndex: number;
  canonicalFactId: string;
  factId: string;
  jurisdiction: {
    id: string;
    slug: string;
    name: string;
    iso3: string | null;
    wikidataQid: string | null;
  };
  factKey: string;
  category: string;
  factGroup: string;
  sourceId: keyof typeof VALUE_FIDELITY_SOURCE_QUOTAS;
  released: {
    value: string | null;
    numeric: number | null;
    unit: string | null;
    asOf: string | null;
    referenceYear: number | null;
    upstreamRelease: string | null;
    contentHash: string;
  };
  verification: {
    status: Outcome;
    officialUrl: string;
    checkedAt: string;
    responseSha256: string | null;
    observedValue: string | number | null;
    observedReferenceDate: string | null;
    comparisonNote: string;
    cause:
      | "none"
      | "publisher_surface_retired"
      | "publisher_value_absent"
      | "publisher_revision_or_release_drift"
      | "retrieval_failure"
      | "transcription"
      | "transformation"
      | "unit"
      | "vintage"
      | "entity"
      | "source_link"
      | "other";
    severity: "none" | "not_assessable" | "low" | "material" | "critical";
    repairTaskId: string | null;
  };
};

type AuditArtifact = {
  schemaVersion: "civica-atlas-value-fidelity-audit/v1";
  taskId: "DAT-034";
  releaseId: "atlas-2026-07-11";
  protocol: {
    path: string;
    sha256: string;
    seed: typeof VALUE_FIDELITY_SEED;
    preregisteredBeforePublisherRetrieval: true;
  };
  sample: {
    size: 300;
    sourceQuotas: typeof VALUE_FIDELITY_SOURCE_QUOTAS;
    sampleSha256: string;
    categories: string[];
    factGroups: string[];
  };
  checkedAt: string;
  sourceAvailability: {
    ciaFactbook: {
      status: "publisher_surface_retired";
      officialNoticeUrl: string;
      noticeDate: "2026-02-04";
      firecrawlCaptureSha256: string;
      retainedPublisherBytesAvailable: false;
      thirdPartyMirrorAcceptedAsIndependentEvidence: false;
    };
    worldBank: { status: "official_api_checked" };
    wikidata: { status: "official_api_checked" };
  };
  summary: {
    status: "blocked_source_evidence" | "complete";
    outcomeCounts: Record<Outcome, number>;
    officialSurfaceChecks: number;
    assessableForConfirmedDefectRate: number;
    verifiedConfirmedDefectRate95: ReturnType<typeof wilson95> | null;
    fullSampleConfirmedDefectBounds: {
      lower: number;
      upper: number;
      unresolvedRows: number;
    };
    confirmedDefectsWithoutRepairTask: number;
    completionReason: string;
  };
  ledger: LedgerRow[];
  semanticSha256: string;
};

function readRelease(): Release {
  return JSON.parse(
    gunzipSync(readFileSync(releasePath)).toString("utf8"),
  ) as Release;
}

function releasedCandidates(release: Release): Array<
  FidelitySampleCandidate & { fact: Fact; jurisdiction: Jurisdiction }
> {
  const jurisdictions = new Map(
    release.tables.jurisdictions.map((row) => [row.id, row]),
  );
  return release.tables.facts.flatMap((fact) => {
    if (
      !Object.hasOwn(VALUE_FIDELITY_SOURCE_QUOTAS, fact.source_id) ||
      fact.value_status !== "observed"
    ) {
      return [];
    }
    const jurisdiction = jurisdictions.get(fact.jurisdiction_id);
    if (!jurisdiction) throw new Error(`missing jurisdiction ${fact.jurisdiction_id}`);
    return [
      {
        canonicalFactId: fact.canonical_fact_id,
        sourceId:
          fact.source_id as keyof typeof VALUE_FIDELITY_SOURCE_QUOTAS,
        category: fact.category,
        factGroup: fact.fact_group,
        fact,
        jurisdiction,
      },
    ];
  });
}

function sampleRows(release: Release) {
  const candidates = releasedCandidates(release);
  const selected = selectValueFidelitySample(candidates);
  const byId = new Map(
    candidates.map((candidate) => [candidate.canonicalFactId, candidate]),
  );
  return selected.map((row) => {
    const selectedRow = byId.get(row.canonicalFactId);
    if (!selectedRow) throw new Error(`selected row ${row.canonicalFactId} vanished`);
    return selectedRow;
  });
}

async function fetchPublisherJson(
  url: string,
): Promise<{ body: Buffer; json: unknown }> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Civica-Atlas-DAT-034/1.0" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = Buffer.from(await response.arrayBuffer());
      return { body, json: JSON.parse(body.toString("utf8")) as unknown };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function comparison(
  released: string | number | null,
  observed: string | number,
): Pick<
  LedgerRow["verification"],
  "status" | "comparisonNote" | "cause" | "severity"
> {
  if (typeof released === "number" && typeof observed === "number") {
    const tolerance = Math.max(1e-9, Math.abs(released) * 1e-10);
    if (Math.abs(released - observed) <= tolerance) {
      return {
        status: "match",
        comparisonNote: `numeric values agree within tolerance ${tolerance}`,
        cause: "none",
        severity: "none",
      };
    }
  } else if (String(released ?? "").trim() === String(observed).trim()) {
    return {
      status: "match",
      comparisonNote: "text values agree exactly after trimming",
      cause: "none",
      severity: "none",
    };
  }
  return {
    status: "publisher_revision_unresolved",
    comparisonNote:
      "current official value differs; retained publisher bytes are required to distinguish upstream revision from release error",
    cause: "publisher_revision_or_release_drift",
    severity: "not_assessable",
  };
}

function baseRow(
  selected: ReturnType<typeof sampleRows>[number],
  sampleIndex: number,
): Omit<LedgerRow, "verification"> {
  const { fact, jurisdiction } = selected;
  return {
    sampleIndex,
    canonicalFactId: fact.canonical_fact_id,
    factId: fact.id,
    jurisdiction: {
      id: jurisdiction.id,
      slug: jurisdiction.slug,
      name: jurisdiction.name,
      iso3: jurisdiction.iso3,
      wikidataQid: jurisdiction.wikidata_qid,
    },
    factKey: fact.fact_key,
    category: fact.category,
    factGroup: fact.fact_group,
    sourceId: selected.sourceId,
    released: {
      value: fact.fact_value,
      numeric: fact.fact_value_numeric,
      unit: fact.fact_unit,
      asOf: fact.as_of,
      referenceYear: fact.observation_reference_year,
      upstreamRelease: fact.upstream_dataset_release,
      contentHash: fact.content_hash,
    },
  };
}

async function verifyWorldBank(
  selected: ReturnType<typeof sampleRows>[number],
  checkedAt: string,
): Promise<LedgerRow["verification"]> {
  const { fact, jurisdiction } = selected;
  if (!jurisdiction.iso3) {
    return {
      status: "verification_error",
      officialUrl: fact.source_url ?? "https://api.worldbank.org/v2/",
      checkedAt,
      responseSha256: null,
      observedValue: null,
      observedReferenceDate: null,
      comparisonNote: "sampled World Bank row has no ISO3 publisher key",
      cause: "entity",
      severity: "not_assessable",
      repairTaskId: null,
    };
  }
  const indicator = fact.source_url?.match(/\/indicator\/([^/?#]+)/)?.[1];
  const isClassification =
    fact.fact_key === "world_bank_region" ||
    fact.fact_key === "world_bank_income_group";
  const officialUrl = isClassification
    ? `https://api.worldbank.org/v2/country/${jurisdiction.iso3}?format=json`
    : `https://api.worldbank.org/v2/country/${jurisdiction.iso3}/indicator/${indicator}?date=${fact.observation_reference_year}&format=json&per_page=10`;
  try {
    if (!isClassification && (!indicator || !fact.observation_reference_year)) {
      throw new Error("indicator row lacks indicator or reference year");
    }
    const response = await fetchPublisherJson(officialUrl);
    const payload = response.json as [
      Record<string, unknown>,
      Array<Record<string, unknown>>,
    ];
    const publisherRow = Array.isArray(payload?.[1]) ? payload[1][0] : null;
    let observed: string | number | null = null;
    if (publisherRow) {
      if (fact.fact_key === "world_bank_region") {
        observed = (publisherRow.region as { value?: string })?.value ?? null;
      } else if (fact.fact_key === "world_bank_income_group") {
        observed =
          (publisherRow.incomeLevel as { value?: string })?.value ?? null;
      } else {
        observed =
          typeof publisherRow.value === "number" ? publisherRow.value : null;
        if (
          observed !== null &&
          fact.fact_key === "gdp_nominal_usd_billions"
        ) {
          observed /= 1_000_000_000;
        }
      }
    }
    if (observed === null) {
      return {
        status: "publisher_value_unavailable",
        officialUrl,
        checkedAt,
        responseSha256: sha256(response.body),
        observedValue: null,
        observedReferenceDate: null,
        comparisonNote:
          "official endpoint returned no comparable value for the cited entity/year",
        cause: "publisher_value_absent",
        severity: "not_assessable",
        repairTaskId: null,
      };
    }
    const released =
      typeof observed === "number"
        ? Number(fact.fact_value)
        : fact.fact_value;
    return {
      ...comparison(released, observed),
      officialUrl,
      checkedAt,
      responseSha256: sha256(response.body),
      observedValue: observed,
      observedReferenceDate: isClassification
        ? null
        : String(fact.observation_reference_year),
      repairTaskId: null,
    };
  } catch (error) {
    return {
      status: "verification_error",
      officialUrl,
      checkedAt,
      responseSha256: null,
      observedValue: null,
      observedReferenceDate: null,
      comparisonNote: `official endpoint retrieval failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      cause: "retrieval_failure",
      severity: "not_assessable",
      repairTaskId: null,
    };
  }
}

function wikidataTime(
  claim: Record<string, unknown>,
): { date: string; precision: number } | null {
  const qualifiers = claim.qualifiers as
    | Record<string, Array<Record<string, unknown>>>
    | undefined;
  const value = (
    qualifiers?.P585?.[0]?.datavalue as
      | { value?: { time?: string; precision?: number } }
      | undefined
  )?.value;
  const date = value?.time?.match(/^\+(\d{4}-\d{2}-\d{2})T/)?.[1];
  return date
    ? { date, precision: value?.precision ?? 11 }
    : null;
}

function wikidataAmount(claim: Record<string, unknown>): number | null {
  const mainsnak = claim.mainsnak as Record<string, unknown> | undefined;
  const value = (mainsnak?.datavalue as { value?: unknown } | undefined)?.value;
  const amount =
    typeof value === "object" && value !== null
      ? (value as { amount?: string }).amount
      : null;
  return amount && Number.isFinite(Number(amount)) ? Number(amount) : null;
}

async function verifyWikidata(
  selected: ReturnType<typeof sampleRows>[number],
  checkedAt: string,
): Promise<LedgerRow["verification"]> {
  const { fact, jurisdiction } = selected;
  const qid = jurisdiction.wikidata_qid;
  const officialUrl = qid
    ? `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=claims&format=json&origin=*`
    : "https://www.wikidata.org/w/api.php";
  try {
    if (!qid || !fact.as_of) throw new Error("row lacks QID or cited date");
    const response = await fetchPublisherJson(officialUrl);
    const entity = (
      response.json as {
        entities?: Record<
          string,
          { claims?: Record<string, Array<Record<string, unknown>>> }
        >;
      }
    ).entities?.[qid];
    const property = {
      population_total: "P1082",
      life_expectancy_years: "P2250",
    }[fact.fact_key];
    if (!property) throw new Error(`unsupported Wikidata fact ${fact.fact_key}`);
    const [releasedYear, releasedMonth, releasedDay] = fact.as_of.split("-");
    const compatible = (entity?.claims?.[property] ?? [])
      .map((claim) => ({
        amount: wikidataAmount(claim),
        time: wikidataTime(claim),
      }))
      .filter(({ time }) => {
        if (!time) return false;
        const [year, month, day] = time.date.split("-");
        if (time.precision <= 9) return year === releasedYear;
        if (time.precision === 10)
          return year === releasedYear && month === releasedMonth;
        return (
          year === releasedYear &&
          month === releasedMonth &&
          day === releasedDay
        );
      });
    const released = Number(fact.fact_value);
    const exact = compatible.find(({ amount }) => amount === released);
    if (exact?.time && exact.time.precision < 11) {
      return {
        status: "confirmed_defect",
        officialUrl,
        checkedAt,
        responseSha256: sha256(response.body),
        observedValue: exact.amount,
        observedReferenceDate: exact.time.date,
        comparisonNote:
          `value agrees, but the publisher qualifier has ${
            exact.time.precision <= 9 ? "year" : "month"
          } precision and the release manufactures an exact ${fact.as_of} date`,
        cause: "transformation",
        severity: "material",
        repairTaskId: "DAT-036",
      };
    }
    if (exact?.amount !== undefined && exact.amount !== null) {
      return {
        ...comparison(released, exact.amount),
        officialUrl,
        checkedAt,
        responseSha256: sha256(response.body),
        observedValue: exact.amount,
        observedReferenceDate: exact.time?.date ?? fact.as_of,
        repairTaskId: null,
      };
    }
    const observed = compatible
      .map(({ amount }) => amount)
      .find((value) => value !== null);
    if (observed === undefined || observed === null) {
      return {
        status: "publisher_value_unavailable",
        officialUrl,
        checkedAt,
        responseSha256: sha256(response.body),
        observedValue: null,
        observedReferenceDate: fact.as_of,
        comparisonNote:
          `official entity JSON has no ${property} statement compatible with the cited P585 date`,
        cause: "publisher_value_absent",
        severity: "not_assessable",
        repairTaskId: null,
      };
    }
    return {
      ...comparison(released, observed),
      officialUrl,
      checkedAt,
      responseSha256: sha256(response.body),
      observedValue: observed,
      observedReferenceDate: fact.as_of,
      repairTaskId: null,
    };
  } catch (error) {
    return {
      status: "verification_error",
      officialUrl,
      checkedAt,
      responseSha256: null,
      observedValue: null,
      observedReferenceDate: fact.as_of,
      comparisonNote: `official endpoint retrieval failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      cause: "retrieval_failure",
      severity: "not_assessable",
      repairTaskId: null,
    };
  }
}

async function mapWithConcurrency<T, U>(
  values: readonly T[],
  limit: number,
  fn: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  const output = new Array<U>(values.length);
  let next = 0;
  async function worker() {
    while (next < values.length) {
      const index = next;
      next += 1;
      output[index] = await fn(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: limit }, () => worker()));
  return output;
}

function outcomeCounts(rows: readonly LedgerRow[]): Record<Outcome, number> {
  const counts: Record<Outcome, number> = {
    match: 0,
    confirmed_defect: 0,
    publisher_revision_unresolved: 0,
    publisher_value_unavailable: 0,
    publisher_surface_unavailable: 0,
    verification_error: 0,
  };
  for (const row of rows) counts[row.verification.status] += 1;
  return counts;
}

function semanticHash(artifact: Omit<AuditArtifact, "semanticSha256">): string {
  return sha256(JSON.stringify(artifact));
}

async function buildArtifact(release: Release): Promise<AuditArtifact> {
  const checkedAt = new Date().toISOString();
  const selected = sampleRows(release);
  const ledger = await mapWithConcurrency(selected, 8, async (row, index) => {
    const base = baseRow(row, index + 1);
    if (row.sourceId === "cia_factbook") {
      return {
        ...base,
        verification: {
          status: "publisher_surface_unavailable",
          officialUrl: CIA_RETIREMENT_URL,
          checkedAt,
          responseSha256: CIA_FIRECRAWL_CAPTURE_SHA256,
          observedValue: null,
          observedReferenceDate: null,
          comparisonNote:
            "CIA states that The World Factbook has sunset; the country surface is unavailable and no retained CIA publisher bytes exist for this release",
          cause: "publisher_surface_retired",
          severity: "not_assessable",
          repairTaskId: null,
        },
      } satisfies LedgerRow;
    }
    return {
      ...base,
      verification:
        row.sourceId === "world_bank"
          ? await verifyWorldBank(row, checkedAt)
          : await verifyWikidata(row, checkedAt),
    } satisfies LedgerRow;
  });
  const counts = outcomeCounts(ledger);
  const assessable = counts.match + counts.confirmed_defect;
  const unresolved = ledger.length - assessable;
  const complete =
    unresolved === 0 &&
    ledger.every(
      (row) =>
        row.verification.status !== "confirmed_defect" ||
        Boolean(row.verification.repairTaskId),
    );
  const artifactWithoutHash = {
    schemaVersion: "civica-atlas-value-fidelity-audit/v1",
    taskId: "DAT-034",
    releaseId: "atlas-2026-07-11",
    protocol: {
      path: protocolPath,
      sha256: sha256(readFileSync(protocolPath)),
      seed: VALUE_FIDELITY_SEED,
      preregisteredBeforePublisherRetrieval: true,
    },
    sample: {
      size: 300,
      sourceQuotas: VALUE_FIDELITY_SOURCE_QUOTAS,
      sampleSha256: sha256(
        JSON.stringify(selected.map((row) => row.canonicalFactId)),
      ),
      categories: [...new Set(selected.map((row) => row.category))].sort(),
      factGroups: [...new Set(selected.map((row) => row.factGroup))].sort(),
    },
    checkedAt,
    sourceAvailability: {
      ciaFactbook: {
        status: "publisher_surface_retired",
        officialNoticeUrl: CIA_RETIREMENT_URL,
        noticeDate: "2026-02-04",
        firecrawlCaptureSha256: CIA_FIRECRAWL_CAPTURE_SHA256,
        retainedPublisherBytesAvailable: false,
        thirdPartyMirrorAcceptedAsIndependentEvidence: false,
      },
      worldBank: { status: "official_api_checked" },
      wikidata: { status: "official_api_checked" },
    },
    summary: {
      status: complete ? "complete" : "blocked_source_evidence",
      outcomeCounts: counts,
      officialSurfaceChecks:
        ledger.length - counts.publisher_surface_unavailable,
      assessableForConfirmedDefectRate: assessable,
      verifiedConfirmedDefectRate95:
        assessable > 0 ? wilson95(counts.confirmed_defect, assessable) : null,
      fullSampleConfirmedDefectBounds: {
        lower: counts.confirmed_defect / ledger.length,
        upper: (counts.confirmed_defect + unresolved) / ledger.length,
        unresolvedRows: unresolved,
      },
      confirmedDefectsWithoutRepairTask: ledger.filter(
        (row) =>
          row.verification.status === "confirmed_defect" &&
          !row.verification.repairTaskId,
      ).length,
      completionReason: complete
        ? "all 300 rows are independently assessable and every defect has a repair task"
        : "CIA publisher evidence is unavailable after the official Factbook sunset; unresolved current-surface differences also require retained publisher evidence",
    },
    ledger,
  } satisfies Omit<AuditArtifact, "semanticSha256">;
  return {
    ...artifactWithoutHash,
    semanticSha256: semanticHash(artifactWithoutHash),
  };
}

function validateArtifact(release: Release, artifact: AuditArtifact): string[] {
  const errors: string[] = [];
  const selected = sampleRows(release);
  if (artifact.schemaVersion !== "civica-atlas-value-fidelity-audit/v1")
    errors.push("schema version drifted");
  if (artifact.protocol.sha256 !== sha256(readFileSync(protocolPath)))
    errors.push("protocol hash drifted");
  if (artifact.protocol.seed !== VALUE_FIDELITY_SEED)
    errors.push("sample seed drifted");
  if (artifact.ledger.length !== 300) errors.push("sample does not contain 300 rows");
  if (
    artifact.sample.sampleSha256 !==
    sha256(JSON.stringify(selected.map((row) => row.canonicalFactId)))
  )
    errors.push("sample identity drifted");
  if (
    artifact.ledger
      .map((row) => row.canonicalFactId)
      .join("\n") !== selected.map((row) => row.canonicalFactId).join("\n")
  )
    errors.push("ledger order or membership drifted");
  for (const [sourceId, quota] of Object.entries(
    VALUE_FIDELITY_SOURCE_QUOTAS,
  )) {
    if (artifact.ledger.filter((row) => row.sourceId === sourceId).length !== quota)
      errors.push(`${sourceId} quota drifted`);
  }
  if (new Set(artifact.ledger.map((row) => row.canonicalFactId)).size !== 300)
    errors.push("sample contains duplicate canonical facts");
  const counts = outcomeCounts(artifact.ledger);
  if (JSON.stringify(counts) !== JSON.stringify(artifact.summary.outcomeCounts))
    errors.push("outcome summary drifted");
  if (
    artifact.ledger.some(
      (row) =>
        row.verification.status === "confirmed_defect" &&
        !row.verification.repairTaskId,
    ) !==
    (artifact.summary.confirmedDefectsWithoutRepairTask > 0)
  )
    errors.push("repair-task summary drifted");
  if (
    artifact.sourceAvailability.ciaFactbook
      .thirdPartyMirrorAcceptedAsIndependentEvidence
  )
    errors.push("third-party mirror was accepted as publisher evidence");
  const { semanticSha256, ...withoutHash } = artifact;
  if (semanticSha256 !== semanticHash(withoutHash))
    errors.push("artifact semantic hash drifted");
  if (
    artifact.summary.status === "complete" &&
    (artifact.summary.fullSampleConfirmedDefectBounds.unresolvedRows > 0 ||
      artifact.summary.confirmedDefectsWithoutRepairTask > 0)
  )
    errors.push("audit claims completion with unresolved evidence or repairs");
  return errors;
}

async function main() {
  const release = readRelease();
  if (release.releaseId !== "atlas-2026-07-11")
    throw new Error(`unexpected release ${release.releaseId}`);
  if (capture) {
    const artifact = await buildArtifact(release);
    writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`);
  }
  const artifact = JSON.parse(readFileSync(outputPath, "utf8")) as AuditArtifact;
  const errors = validateArtifact(release, artifact);
  if (errors.length > 0) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exit(1);
  }
  const summary = artifact.summary;
  console.log(
    `PASS — DAT-034 ${summary.status}; ${artifact.ledger.length} frozen rows, ${summary.officialSurfaceChecks} official checks, ${summary.fullSampleConfirmedDefectBounds.unresolvedRows} unresolved.`,
  );
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
