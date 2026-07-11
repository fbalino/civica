import { config } from "dotenv";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import {
  fetchBuffer,
  forEachCsvRow,
  zipEntryText,
} from "../src/lib/ci/source-utils";
import { LONGITUDINAL_VALIDATION_INPUTS } from "../src/lib/ci/longitudinal-validation-inputs";
import {
  LONGITUDINAL_VALIDATION_RELEASE_ID,
  CI_TOURNAMENT_PANEL_V3_RELEASE_ID,
  researchPanelHash,
} from "../src/lib/ci/research-panel";
import {
  runK1TournamentCandidate,
  type K1PanelInput,
} from "../src/lib/ci/tournament-candidate-k1";
import {
  LONGITUDINAL_PREREGISTRATION,
  LONGITUDINAL_PROTOCOL_VERSION,
} from "../src/lib/ci/longitudinal-preregistration";
import {
  clusterInterval,
  directionAccuracy,
  median,
  quantile,
  type LongitudinalDatum,
} from "../src/lib/ci/longitudinal-analysis";
config({ path: ".env.local" });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required");
const sql = neon(process.env.DATABASE_URL);
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
function selectiveCsv(text: string, columns: string[]) {
  let idx: number[] | null = null;
  const out: Record<string, string>[] = [];
  forEachCsvRow(text, (row) => {
    if (!idx) {
      if (columns.every((c) => row.includes(c)))
        idx = columns.map((c) => row.indexOf(c));
      return;
    }
    const o: Record<string, string> = {};
    columns.forEach((c, i) => (o[c] = row[idx![i]] ?? ""));
    out.push(o);
  });
  if (!idx) throw new Error("CSV columns missing");
  return out;
}
async function exact(url: string, hash: string) {
  const b = await fetchBuffer(url);
  const actual = sha(b);
  if (actual !== hash) throw new Error(`hash drift ${url} ${actual}`);
  return b;
}
const eventSet = (rows: Record<string, string>[]) => {
  const by = new Map<string, { year: number; value: number }[]>();
  for (const r of rows) {
    const value = Number(r.br_dem),
      year = Number(r.year),
      iso3 = r.ccodealp?.toUpperCase();
    if (!iso3 || !(value === 0 || value === 1) || !Number.isInteger(year))
      continue;
    by.set(iso3, [...(by.get(iso3) ?? []), { year, value }]);
  }
  const events = new Set<string>();
  for (const [iso3, g] of by)
    g.sort((a, b) => a.year - b.year)
      .slice(1)
      .forEach((r, i) => {
        if (r.year === g[i].year + 1 && r.value !== g[i].value)
          events.add(`${iso3}:${r.year}:${r.value - g[i].value}`);
      });
  const years = rows.map((r) => Number(r.year)).filter(Number.isInteger);
  return { events, minYear: Math.min(...years), maxYear: Math.max(...years) };
};
export async function buildIndexLongitudinalAnalysis() {
  const panel =
    (await sql`SELECT p.jurisdiction_id::text AS "jurisdictionId",j.iso3,p.period_year AS "periodYear",p.dimension,p.source_id AS "sourceId",p.indicator_id AS "indicatorId",p.value FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${CI_TOURNAMENT_PANEL_V3_RELEASE_ID} AND (p.source_id||':'||p.indicator_id)=ANY(${["vdem:v2x_libdem", "worldbank_wgi:va.est", "worldbank_wgi:rl.est", "freedom_house:pr_cl_total", "transparency_intl:score"]}) ORDER BY j.iso3,p.period_year,p.source_id,p.indicator_id`) as unknown as K1PanelInput[];
  const normalized = panel.map((r) => ({
    ...r,
    value: r.value === null ? null : Number(r.value),
  }));
  const current = runK1TournamentCandidate(normalized);
  const scores = new Map(
    current.map((r) => [`${r.iso3}:${r.periodYear}`, r.scoreInteger]),
  );
  const scoreGroups = new Map<string, { year: number; score: number }[]>();
  for (const row of current)
    scoreGroups.set(row.iso3, [
      ...(scoreGroups.get(row.iso3) ?? []),
      { year: row.periodYear, score: row.scoreInteger },
    ]);
  const levelPairs: { x: number; y: number }[] = [];
  const changePairs: { x: number; y: number }[] = [];
  for (const group of scoreGroups.values()) {
    const ordered = group.sort((a, b) => a.year - b.year);
    const changes: { year: number; value: number }[] = [];
    for (let i = 1; i < ordered.length; i++)
      if (ordered[i].year === ordered[i - 1].year + 1) {
        levelPairs.push({ x: ordered[i - 1].score, y: ordered[i].score });
        changes.push({
          year: ordered[i].year,
          value: ordered[i].score - ordered[i - 1].score,
        });
      }
    for (let i = 1; i < changes.length; i++)
      if (changes[i].year === changes[i - 1].year + 1)
        changePairs.push({ x: changes[i - 1].value, y: changes[i].value });
  }
  const pearson = (pairs: { x: number; y: number }[]) => {
    const mx = pairs.reduce((s, r) => s + r.x, 0) / pairs.length;
    const my = pairs.reduce((s, r) => s + r.y, 0) / pairs.length;
    return (
      pairs.reduce((s, r) => s + (r.x - mx) * (r.y - my), 0) /
      Math.sqrt(
        pairs.reduce((s, r) => s + (r.x - mx) ** 2, 0) *
          pairs.reduce((s, r) => s + (r.y - my) ** 2, 0),
      )
    );
  };
  const autocorrelation = {
    levelLag1: pearson(levelPairs),
    levelPairs: levelPairs.length,
    changeLag1: pearson(changePairs),
    changePairs: changePairs.length,
  };
  const labels =
    (await sql`SELECT j.iso3,p.period_year AS year,p.value FROM ci_research_panel_rows p JOIN jurisdictions j ON j.id=p.jurisdiction_id WHERE p.release_id=${LONGITUDINAL_VALIDATION_RELEASE_ID} AND p.value_status='observed' ORDER BY j.iso3,p.period_year`) as unknown as {
      iso3: string;
      year: number;
      value: number;
    }[];
  const labelBy = new Map<string, { year: number; value: number }[]>();
  for (const r of labels)
    labelBy.set(r.iso3, [
      ...(labelBy.get(r.iso3) ?? []),
      { year: Number(r.year), value: Number(r.value) },
    ]);
  const events: {
    iso3: string;
    year: number;
    direction: number;
    signedMovement: number;
  }[] = [];
  const quiet: { iso3: string; year: number; value: number }[] = [];
  const lagRows = new Map<number, LongitudinalDatum[]>(
    LONGITUDINAL_PREREGISTRATION.leadLag.lags.map((l) => [l, []]),
  );
  for (const [iso3, g0] of labelBy) {
    const g = g0.sort((a, b) => a.year - b.year);
    const transitions = new Set<number>();
    for (let i = 1; i < g.length; i++)
      if (g[i].year === g[i - 1].year + 1 && g[i].value !== g[i - 1].value)
        transitions.add(g[i].year);
    for (const year of transitions) {
      const prior = g.find((r) => r.year === year - 1)!,
        now = g.find((r) => r.year === year)!;
      const before = scores.get(`${iso3}:${year - 1}`),
        after = scores.get(`${iso3}:${year + 1}`);
      if (before !== undefined && after !== undefined)
        events.push({
          iso3,
          year,
          direction: now.value - prior.value,
          signedMovement: (after - before) * (now.value - prior.value),
        });
      for (const lag of LONGITUDINAL_PREREGISTRATION.leadLag.lags) {
        const a = scores.get(`${iso3}:${year + lag - 1}`),
          b = scores.get(`${iso3}:${year + lag}`);
        if (a !== undefined && b !== undefined)
          lagRows
            .get(lag)!
            .push({ iso3, value: (b - a) * (now.value - prior.value) });
      }
    }
    for (let i = 1; i < g.length; i++) {
      const y = g[i].year;
      if (
        g[i].value !== g[i - 1].value ||
        transitions.has(y - 1) ||
        transitions.has(y) ||
        transitions.has(y + 1)
      )
        continue;
      const a = scores.get(`${iso3}:${y - 1}`),
        b = scores.get(`${iso3}:${y}`);
      if (a !== undefined && b !== undefined)
        quiet.push({ iso3, year: y, value: Math.abs(b - a) });
    }
  }
  const signed = events.map((e) => ({ iso3: e.iso3, value: e.signedMovement }));
  const responsiveness = {
    events: events.length,
    directionAccuracy: directionAccuracy(signed),
    directionInterval: clusterInterval(signed, directionAccuracy, "direction"),
    medianSignedMovement: median(signed.map((r) => r.value)),
    movementInterval: clusterInterval(
      signed,
      (r) => median(r.map((x) => x.value)),
      "movement",
    ),
    passesDirection:
      directionAccuracy(signed) >=
      LONGITUDINAL_PREREGISTRATION.responsiveness.signedDirectionAccuracy,
    passesMagnitude:
      median(signed.map((r) => r.value)) >=
      LONGITUDINAL_PREREGISTRATION.responsiveness.medianSignedMovementPoints,
  };
  const leadLag = [...lagRows].map(([lag, r]) => ({
    lag,
    n: r.length,
    meanSignedMovement: r.reduce((s, x) => s + x.value, 0) / r.length,
    medianSignedMovement: median(r.map((x) => x.value)),
  }));
  const peak = [...leadLag].sort(
    (a, b) => Math.abs(b.meanSignedMovement) - Math.abs(a.meanSignedMovement),
  )[0].lag;
  const quietRows = quiet.map((r) => ({ iso3: r.iso3, value: r.value }));
  const quietResult = {
    n: quiet.length,
    medianAbsoluteChange: median(quiet.map((r) => r.value)),
    p95AbsoluteChange: quantile(
      quiet.map((r) => r.value),
      0.95,
    ),
    medianInterval: clusterInterval(
      quietRows,
      (r) => median(r.map((x) => x.value)),
      "quiet",
    ),
    eventToQuietMedianRatio:
      median(signed.map((r) => r.value)) / median(quiet.map((r) => r.value)),
  };
  const qogRows: Record<string, string>[][] = [];
  for (const c of [
    LONGITUDINAL_VALIDATION_INPUTS.captures.qogJan24,
    LONGITUDINAL_VALIDATION_INPUTS.captures.qogJan25,
    LONGITUDINAL_VALIDATION_INPUTS.captures.qogJan26,
  ]) {
    const b = await exact(c.url, c.sha256);
    qogRows.push(
      selectiveCsv(b.toString("utf8"), ["ccodealp", "year", "br_dem"]),
    );
  }
  const eventSets = qogRows.map(eventSet);
  const agreement = (
    a: ReturnType<typeof eventSet>,
    b: ReturnType<typeof eventSet>,
  ) => {
    const commonStart = Math.max(a.minYear, b.minYear);
    const commonEnd = Math.min(a.maxYear, b.maxYear);
    const inWindow = (event: string) => {
      const year = Number(event.split(":")[1]);
      return year >= commonStart && year <= commonEnd;
    };
    const aCommon = new Set([...a.events].filter(inWindow));
    const bCommon = new Set([...b.events].filter(inWindow));
    const intersection = [...aCommon].filter((x) => bCommon.has(x)).length;
    const union = new Set([...aCommon, ...bCommon]).size;
    return {
      commonStart,
      commonEnd,
      a: aCommon.size,
      b: bCommon.size,
      intersection,
      union,
      jaccard: intersection / union,
      bEventsAfterCommonEnd: [...b.events].filter(
        (event) => Number(event.split(":")[1]) > commonEnd,
      ).length,
    };
  };
  const qogRevision = {
    jan24VsJan26: agreement(eventSets[0], eventSets[2]),
    jan25VsJan26: agreement(eventSets[1], eventSets[2]),
  };
  const v14capture = LONGITUDINAL_VALIDATION_INPUTS.captures.vdemV14;
  const v14buf = await exact(v14capture.url, v14capture.sha256);
  const v14rows = selectiveCsv(
    zipEntryText(v14buf, (n) => n === "V-Dem-CY-Core-v14.csv"),
    ["country_text_id", "year", "v2x_libdem"],
  );
  const v14 = new Map(
    v14rows.map((r) => [`${r.country_text_id}:${r.year}`, r.v2x_libdem]),
  );
  const aliases: Record<string, string> = { PSE: "PSX" };
  const v14Key = (iso3: string, year: number) =>
    `${aliases[iso3] ?? iso3}:${year}`;
  const revisedInputs = normalized.map((r) =>
    r.sourceId === "vdem" && r.indicatorId === "v2x_libdem"
      ? {
          ...r,
          value: (() => {
            const x = Number(v14.get(v14Key(r.iso3, r.periodYear)));
            return Number.isFinite(x) ? x : r.value;
          })(),
        }
      : r,
  );
  const revised = runK1TournamentCandidate(revisedInputs);
  const currentMap = new Map(current.map((r) => [r.unitId, r]));
  const shiftRows = revised.flatMap((r) => {
    const old = currentMap.get(r.unitId);
    return old && v14.has(v14Key(r.iso3, r.periodYear))
      ? [
          {
            iso3: r.iso3,
            year: r.periodYear,
            oldScore: old.scoreInteger,
            revisedScore: r.scoreInteger,
            absoluteShift: Math.abs(r.scoreInteger - old.scoreInteger),
          },
        ]
      : [];
  });
  const shifts = shiftRows.map((row) => row.absoluteShift);
  const revision = {
    comparableScores: shifts.length,
    medianAbsoluteK1Shift: median(shifts),
    p95AbsoluteK1Shift: quantile(shifts, 0.95),
    maxAbsoluteK1Shift: Math.max(...shifts),
    nonzeroShifts: shifts.filter((value) => value > 0).length,
    shiftsAboveThreePoints: shifts.filter((value) => value > 3).length,
    largestShifts: [...shiftRows]
      .sort(
        (a, b) =>
          b.absoluteShift - a.absoluteShift ||
          a.iso3.localeCompare(b.iso3) ||
          a.year - b.year,
      )
      .slice(0, 10),
    shiftSha256: researchPanelHash(shifts),
  };
  const result = {
    schemaVersion: "civica-index-longitudinal-result/v1",
    releaseId: "index-longitudinal-analysis-v1",
    protocolVersion: LONGITUDINAL_PROTOCOL_VERSION,
    inputReleaseId: LONGITUDINAL_VALIDATION_RELEASE_ID,
    responsiveness,
    leadLag: {
      rows: leadLag,
      peakAbsoluteMeanLag: peak,
      passes: [0, 1].includes(peak),
    },
    quiet: {
      ...quietResult,
      passesMedian: quietResult.medianAbsoluteChange <= 2,
      passesP95: quietResult.p95AbsoluteChange <= 10,
      passesEventRatio: quietResult.eventToQuietMedianRatio >= 2,
    },
    autocorrelation,
    revision: {
      qog: qogRevision,
      qogPasses:
        qogRevision.jan24VsJan26.jaccard >= 0.9 &&
        qogRevision.jan25VsJan26.jaccard >= 0.9,
      vdem: revision,
      vdemPasses:
        revision.medianAbsoluteK1Shift <= 1 && revision.p95AbsoluteK1Shift <= 3,
    },
    exclusions: {
      labelsMissing: 194 * 23 - labels.length,
      eventEndpointsMissing: eventSets[2].events.size - events.length,
    },
    noCausalClaim: true,
  };
  return { ...result, resultSha256: researchPanelHash(result) };
}
async function main() {
  const r = await buildIndexLongitudinalAnalysis();
  const dir = "data/releases/index-longitudinal-analysis-v1";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/result.v1.json`, `${JSON.stringify(r, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        resultSha256: r.resultSha256,
        responsiveness: r.responsiveness,
        leadLag: r.leadLag,
        quiet: r.quiet,
        revision: r.revision,
        exclusions: r.exclusions,
      },
      null,
      2,
    ),
  );
}
if (process.argv[1]?.endsWith("generate-index-longitudinal-analysis.ts"))
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
