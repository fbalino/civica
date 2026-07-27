import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import { stableStringify } from "../src/lib/data/frozen-vintage";
import { assessWikidataJurisdictionIdentity } from "../src/lib/elections/jurisdiction-scope";

config({ path: ".env.local", quiet: true });

const OUTPUT = resolve(
  process.cwd(),
  "src/lib/elections/jurisdiction-identity.generated.json",
);
const CHECK = process.argv.includes("--check");
const EXPECTED_ROWS = 915;
const WIKIDATA_BATCH_SIZE = 50;
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

type DbRow = {
  row_id: string;
  jurisdiction_id: string;
  jurisdiction_slug: string;
  jurisdiction_iso2: string | null;
  jurisdiction_qid: string | null;
  election_qid: string | null;
  date_confidence: string | null;
  event_source_id: string | null;
  event_source_url: string | null;
  ipu_parline_id: string | null;
};

type WikidataEntity = {
  claims?: {
    P17?: Array<{
      mainsnak?: { datavalue?: { value?: { id?: string } } };
    }>;
    P1001?: Array<{
      mainsnak?: { datavalue?: { value?: { id?: string } } };
    }>;
  };
};

function sha256(value: unknown) {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function countryCodeFromIpuElectionUrl(value: string | null) {
  return (
    value?.match(/\/elections\/([A-Za-z]{2})-/)?.[1]?.toUpperCase() ?? null
  );
}

function countryCodeFromIpuChamber(value: string | null) {
  return (
    value?.match(/^([A-Za-z]{2})-(?:LC|UC)\d+$/)?.[1]?.toUpperCase() ?? null
  );
}

async function wikidataJurisdictionClaims(eventQids: string[]) {
  const result = new Map<
    string,
    { countryJurisdictionIds: string[]; scopeJurisdictionIds: string[] }
  >();
  for (let index = 0; index < eventQids.length; index += WIKIDATA_BATCH_SIZE) {
    const batch = eventQids.slice(index, index + WIKIDATA_BATCH_SIZE);
    const url = new URL(WIKIDATA_API);
    url.searchParams.set("action", "wbgetentities");
    url.searchParams.set("ids", batch.join("|"));
    url.searchParams.set("props", "claims");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const response = await fetch(url, {
      headers: {
        "user-agent":
          "CivicaAtlas/1.0 (academic election jurisdiction audit; civicaatlas.org)",
      },
    });
    if (!response.ok) {
      throw new Error(`Wikidata identity request failed (${response.status})`);
    }
    const payload = (await response.json()) as {
      entities?: Record<string, WikidataEntity>;
    };
    for (const qid of batch) {
      const claims = payload.entities?.[qid]?.claims;
      const claimIds = (propertyClaims: NonNullable<typeof claims>["P17"]) =>
        [
          ...new Set(
            (propertyClaims ?? [])
              .map((claim) => claim.mainsnak?.datavalue?.value?.id)
              .filter((value): value is string => Boolean(value)),
          ),
        ].sort();
      result.set(qid, {
        countryJurisdictionIds: claimIds(claims?.P17),
        scopeJurisdictionIds: claimIds(claims?.P1001),
      });
    }
  }
  return result;
}

async function collect(generatedAt: string) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const sql = neon(process.env.DATABASE_URL);
  const rows = (await sql`
    SELECT e.id AS row_id,
           e.jurisdiction_id,
           j.slug AS jurisdiction_slug,
           j.iso2 AS jurisdiction_iso2,
           j.wikidata_qid AS jurisdiction_qid,
           e.wikidata_qid AS election_qid,
           e.date_confidence,
           event.source_id AS event_source_id,
           event.source_url AS event_source_url,
           b.ipu_parline_id
      FROM elections e
      JOIN jurisdictions j ON j.id = e.jurisdiction_id
      LEFT JOIN government_bodies b ON b.id = e.body_id
      LEFT JOIN LATERAL (
        SELECT s.source_id, s.source_url
          FROM statements s
         WHERE s.subject_table = 'elections'
           AND s.subject_id = e.id
           AND s.predicate IN (
             'ipu_last_election',
             'wikidata_election_date',
             'civica_estimated_next_election'
           )
         ORDER BY CASE s.predicate
           WHEN 'ipu_last_election' THEN 0
           WHEN 'wikidata_election_date' THEN 1
           ELSE 2
         END, s.id
         LIMIT 1
      ) event ON TRUE
     ORDER BY e.id
  `) as DbRow[];
  if (rows.length !== EXPECTED_ROWS) {
    throw new Error(
      `Expected ${EXPECTED_ROWS} election rows; observed ${rows.length}`,
    );
  }

  const eventQids = [
    ...new Set(
      rows
        .map((row) => row.election_qid)
        .filter((qid): qid is string => Boolean(qid)),
    ),
  ].sort();
  const jurisdictionClaims = await wikidataJurisdictionClaims(eventQids);

  const auditedRows = rows.map((row) => {
    if (row.election_qid) {
      const observed = jurisdictionClaims.get(row.election_qid) ?? {
        countryJurisdictionIds: [],
        scopeJurisdictionIds: [],
      };
      const assessment = assessWikidataJurisdictionIdentity({
        expectedJurisdictionId: row.jurisdiction_qid,
        countryJurisdictionIds: observed.countryJurisdictionIds,
        scopeJurisdictionIds: observed.scopeJurisdictionIds,
      });
      return {
        rowId: row.row_id,
        jurisdictionId: row.jurisdiction_id,
        jurisdictionSlug: row.jurisdiction_slug,
        basis: "wikidata_p17_p1001" as const,
        sourceId: "wikidata",
        sourceRecordId: row.election_qid,
        expectedJurisdictionId: row.jurisdiction_qid,
        observedJurisdictionIds: observed.countryJurisdictionIds,
        observedScopeJurisdictionIds: observed.scopeJurisdictionIds,
        statusReason: assessment.reason,
        status: assessment.status,
      };
    }

    const expectedIso2 = row.jurisdiction_iso2?.toUpperCase() ?? null;
    const electionCode = countryCodeFromIpuElectionUrl(row.event_source_url);
    const chamberCode = countryCodeFromIpuChamber(row.ipu_parline_id);
    const observedCode = electionCode ?? chamberCode;
    const basis = electionCode
      ? ("ipu_election_code" as const)
      : chamberCode
        ? ("ipu_chamber_code" as const)
        : ("unavailable" as const);
    return {
      rowId: row.row_id,
      jurisdictionId: row.jurisdiction_id,
      jurisdictionSlug: row.jurisdiction_slug,
      basis,
      sourceId: row.event_source_id,
      sourceRecordId: row.event_source_url ?? row.ipu_parline_id,
      expectedJurisdictionId: expectedIso2,
      observedJurisdictionIds: observedCode ? [observedCode] : [],
      observedScopeJurisdictionIds: [],
      statusReason:
        expectedIso2 && observedCode === expectedIso2
          ? "country_code_match"
          : observedCode
            ? "country_code_mismatch"
            : "country_code_missing",
      status:
        expectedIso2 && observedCode === expectedIso2
          ? ("matched" as const)
          : observedCode
            ? ("mismatch" as const)
            : ("missing" as const),
    };
  });

  const counts = {
    matched: auditedRows.filter((row) => row.status === "matched").length,
    missing: auditedRows.filter((row) => row.status === "missing").length,
    mismatch: auditedRows.filter((row) => row.status === "mismatch").length,
    wikidataP17P1001: auditedRows.filter(
      (row) => row.basis === "wikidata_p17_p1001",
    ).length,
    ipuElectionCode: auditedRows.filter(
      (row) => row.basis === "ipu_election_code",
    ).length,
    ipuChamberCode: auditedRows.filter(
      (row) => row.basis === "ipu_chamber_code",
    ).length,
  };
  return {
    schemaVersion: "election-jurisdiction-identity/v2" as const,
    generatedAt,
    upstream: {
      wikidataApi: WIKIDATA_API,
      wikidataProperties: ["P17", "P1001"],
      ipuElectionCodePattern: "/elections/{ISO2}-*",
      ipuChamberCodePattern: "{ISO2}-{LC|UC}*",
    },
    rowCount: auditedRows.length,
    counts,
    rowsSha256: sha256(auditedRows),
    rows: auditedRows,
  };
}

async function main() {
  const previous = CHECK
    ? (JSON.parse(readFileSync(OUTPUT, "utf8")) as { generatedAt: string })
    : null;
  const artifact = await collect(
    previous?.generatedAt ?? new Date().toISOString(),
  );
  const serialized = `${JSON.stringify(artifact, null, 2)}\n`;
  if (CHECK) {
    if (serialized !== readFileSync(OUTPUT, "utf8")) {
      throw new Error(
        "Checked election jurisdiction identity differs from live source mappings",
      );
    }
    console.log(
      `PASS — ${artifact.counts.matched}/${artifact.rowCount} election rows retain matching publisher jurisdiction identity; ${artifact.counts.missing} remain missing and ${artifact.counts.mismatch} remain conflicting.`,
    );
    return;
  }
  writeFileSync(OUTPUT, serialized);
  console.log(
    `Wrote ${artifact.schemaVersion}: ${artifact.counts.matched} matched; ${artifact.counts.missing} missing; ${artifact.counts.mismatch} mismatched.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
