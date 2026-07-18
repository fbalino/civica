import { mkdirSync, writeFileSync } from "node:fs";
import {
  CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
  researchPanelHash,
} from "../src/lib/ci/research-panel";
import {
  runK1TournamentCandidate,
  type K1PanelInput,
} from "../src/lib/ci/tournament-candidate-k1";
import {
  K2_RATERS,
  runK2Concordance,
  type K2PanelInput,
} from "../src/lib/ci/tournament-candidate-k2";
import {
  clusterBootstrap,
  median,
  spearman,
  type ValidityPair,
} from "../src/lib/ci/validity-analysis";
import {
  INDEX_VALIDITY_PREREGISTRATION,
  INDEX_VALIDITY_PROTOCOL_VERSION,
} from "../src/lib/ci/validity-preregistration";
import { readIndexAnalysisReplayInputs } from "../src/lib/ci/index-analysis-inputs";
type Panel = K2PanelInput & { dimension: string };
const byKey = <T extends { iso3: string; periodYear: number }>(
  rows: readonly T[],
) => new Map(rows.map((r) => [`${r.iso3}:${r.periodYear}`, r]));
const means = (rows: readonly ValidityPair[]) =>
  [...new Set(rows.map((r) => r.iso3))].sort().map((iso3) => {
    const g = rows.filter((r) => r.iso3 === iso3);
    return {
      iso3,
      year: 0,
      x: g.reduce((s, r) => s + r.x, 0) / g.length,
      y: g.reduce((s, r) => s + r.y, 0) / g.length,
    };
  });
const changes = (pairs: readonly ValidityPair[]) =>
  [...new Set(pairs.map((r) => r.iso3))].flatMap((iso3) => {
    const g = pairs
      .filter((r) => r.iso3 === iso3)
      .sort((a, b) => a.year - b.year);
    return g
      .slice(1)
      .flatMap((r, i) =>
        r.year === g[i].year + 1
          ? [{ iso3, year: r.year, x: r.x - g[i].x, y: r.y - g[i].y }]
          : [],
      );
  });
const annualMedian = (rows: readonly ValidityPair[]) =>
  median(
    [...new Set(rows.map((r) => r.year))]
      .sort()
      .map((year) => spearman(rows.filter((r) => r.year === year))),
  );
export async function buildIndexValidityAnalysis() {
  const rows = readIndexAnalysisReplayInputs().panel as Panel[];
  const normalized = rows.map((r) => ({
    ...r,
    value: r.value === null ? null : Number(r.value),
    nativeMin: Number(r.nativeMin),
    nativeMax: Number(r.nativeMax),
  }));
  const k1 = runK1TournamentCandidate(normalized);
  const k2 = runK2Concordance(
    normalized.filter((r) =>
      K2_RATERS.includes(`${r.sourceId}:${r.indicatorId}` as any),
    ),
  );
  const hdi = byKey(
    normalized.filter(
      (r) => r.sourceId === "undp_hdi" && r.indicatorId === "hdi",
    ),
  );
  const k1hdi: k1Pair[] = k1.flatMap((row) => {
    const h = hdi.get(`${row.iso3}:${row.periodYear}`);
    return row.periodYear >= 2012 &&
      row.periodYear <= 2023 &&
      h?.value !== null &&
      h?.value !== undefined
      ? [
          {
            iso3: row.iso3,
            year: row.periodYear,
            x: row.scoreInteger,
            y: h.value,
          },
        ]
      : [];
  });
  type k1Pair = ValidityPair;
  const h1rows = means(k1hdi);
  const h1rho = spearman(h1rows);
  const annual = [...new Set(k1hdi.map((r) => r.year))].sort().map((year) => {
    const sample = k1hdi.filter((r) => r.year === year);
    return { year, n: sample.length, rho: spearman(sample) };
  });
  const h2rho = median(annual.map((r) => r.rho));
  const changeRows = changes(k1hdi);
  const h3rho = spearman(changeRows);
  const k2hdi: ValidityPair[] = k2.flatMap((row) => {
    const h = hdi.get(`${row.iso3}:${row.periodYear}`);
    return row.periodYear >= 2012 &&
      row.periodYear <= 2023 &&
      h?.value !== null &&
      h?.value !== undefined
      ? [
          {
            iso3: row.iso3,
            year: row.periodYear,
            x: row.spreadRange,
            y: h.value,
          },
        ]
      : [];
  });
  const h4rho = spearman(k2hdi);
  const k1ByKey = byKey(k1);
  const groups = new Map<string, Panel[]>();
  for (const row of normalized)
    groups.set(`${row.iso3}:${row.periodYear}`, [
      ...(groups.get(`${row.iso3}:${row.periodYear}`) ?? []),
      row,
    ]);
  const mechanical = [
    "democratic_quality",
    "rule_of_law",
    "freedom_rights",
    "corruption_control",
  ].map((dimension) => {
    const pairs: ValidityPair[] = [];
    for (const [key, g] of groups) {
      const out = k1ByKey.get(key);
      if (!out || out.periodYear < 2012 || out.periodYear > 2023) continue;
      let row: Panel | undefined;
      if (dimension === "democratic_quality")
        row =
          g.find(
            (r) =>
              r.sourceId === "vdem" &&
              r.indicatorId === "v2x_libdem" &&
              r.value !== null,
          ) ??
          g.find(
            (r) =>
              r.sourceId === "worldbank_wgi" &&
              r.indicatorId === "va.est" &&
              r.value !== null,
          );
      else row = g.find((r) => r.dimension === dimension && r.value !== null);
      if (row?.value !== null && row?.value !== undefined) {
        const bounded =
          (row.value - row.nativeMin) / (row.nativeMax - row.nativeMin);
        pairs.push({
          iso3: out.iso3,
          year: out.periodYear,
          x: out.scoreInteger,
          y: row.isInverted ? 1 - bounded : bounded,
        });
      }
    }
    return {
      dimension,
      n: pairs.length,
      rho: spearman(pairs),
      interpretation: "mechanical_input_association_not_validity",
    };
  });
  const hypotheses = [
    {
      id: "H1",
      n: h1rows.length,
      estimate: h1rho,
      interval: clusterBootstrap(h1rows, spearman, "H1"),
      pass: h1rho >= 0.3 && h1rho < 0.8,
    },
    {
      id: "H2",
      n: k1hdi.length,
      estimate: h2rho,
      interval: clusterBootstrap(k1hdi, annualMedian, "H2"),
      annual,
      pass: h2rho >= 0.3,
    },
    {
      id: "H3",
      n: changeRows.length,
      estimate: h3rho,
      interval: clusterBootstrap(changeRows, spearman, "H3"),
      pass: Math.abs(h3rho) <= 0.3,
    },
    {
      id: "H4",
      n: k2hdi.length,
      estimate: h4rho,
      interval: clusterBootstrap(k2hdi, spearman, "H4"),
      pass: Math.abs(h4rho) <= 0.3,
    },
  ];
  const result = {
    schemaVersion: "civica-index-validity-result/v1",
    releaseId: "index-validity-analysis-v1",
    protocolVersion: INDEX_VALIDITY_PROTOCOL_VERSION,
    protocol: INDEX_VALIDITY_PREREGISTRATION.inputs,
    panelReleaseId: CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
    hypotheses,
    mechanicalAssociations: mechanical,
    candidateValidity: {
      K0: "not_applicable_reference_fidelity",
      K1: hypotheses.slice(0, 3).every((h) => h.pass)
        ? "limited_external_checks_pass"
        : "one_or_more_external_checks_fail",
      K2: hypotheses[3].pass
        ? "undesired_association_check_passes_but_expert_validity_pending"
        : "undesired_association_check_fails",
      K3: "insufficient_external_labels",
      K4: "insufficient_blinded_scholar_labels",
      K5: "insufficient_double_coded_expert_labels",
    },
    noCandidatePassesFromInputSimilarity: true,
    confirmatoryExternalLabelsInspected: false,
  };
  return { ...result, resultSha256: researchPanelHash(result) };
}
async function main() {
  const result = await buildIndexValidityAnalysis();
  const dir = "data/releases/index-validity-analysis-v1";
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/result.v1.json`,
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        resultSha256: result.resultSha256,
        hypotheses: result.hypotheses.map((h) => ({
          id: h.id,
          n: h.n,
          estimate: h.estimate,
          lower: h.interval.lower95,
          upper: h.interval.upper95,
          pass: h.pass,
        })),
        candidateValidity: result.candidateValidity,
      },
      null,
      2,
    ),
  );
}
if (process.argv[1]?.endsWith("generate-index-validity-analysis.ts"))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
