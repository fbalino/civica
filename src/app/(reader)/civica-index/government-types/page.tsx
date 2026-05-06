import type { Metadata } from "next";
import {
  GovernmentTypesAccordionExplorer,
  type GovernmentTypeFamily,
  type GovernmentTypeLeaf,
} from "@/components/ci/GovernmentTypesAccordionExplorer";
import {
  REGIME_TYPE_META,
  type GovernmentClassification,
  type RegimeTypeKey,
} from "@/lib/government-taxonomy";
import {
  VDEM_ROW_META,
  type VDemRowKey,
} from "@/lib/peer-grouping/lens-metadata";
import {
  getCIByGovernmentTypeDots,
  getGovTypeTrajectory,
} from "@/lib/db/queries";
import {
  getCanonicalFactsForJurisdictions,
  FACTBOOK_RECONCILIATION_META,
} from "@/lib/factbook/reconcile/api";
import { CiteAccordion } from "@/components/cite/CiteAccordion";

export const metadata: Metadata = {
  title: "Civica Index by Peer Lens — Bi-Lens Explorer",
  description:
    "Compare Civica Index scores grouped by V-Dem Regimes of the World (default) or Bjørnskov-Rode / CGV regime type (alternate). Replaces the retired structural_family lens per the 2026-05-02 peer-grouping resolution.",
  alternates: {
    canonical: "https://civicaatlas.org/civica-index/government-types",
  },
  openGraph: {
    title: "Civica Index by peer lens | Civica Index",
    description:
      "V-Dem Regimes of the World by default; BR/CGV regime type on demand. Distribution, spread, and trajectory for every lens cohort.",
    url: "https://civicaatlas.org/civica-index/government-types",
  },
};

type DotRow = {
  jurisdictionId: string;
  governmentType: string;
  governmentTypeDetail?: string | null;
  slug: string;
  name: string;
  iso2?: string | null;
  iso3?: string | null;
  score: number;
  governmentClassification?: GovernmentClassification | null;
};

type TrajectoryRow = {
  quarter: string;
  jurisdictionId: string;
  governmentType: string;
  governmentTypeDetail?: string | null;
  slug: string;
  iso3?: string | null;
  score: number;
  governmentClassification?: GovernmentClassification | null;
};

type GroupMeta = {
  key: string;
  label: string;
  familyId: string;
  colorVar: string;
  fallback: string;
  order: number;
};

type GroupBucket = {
  meta: GroupMeta;
  dots: DotRow[];
  countryCount: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
};

type Lens = "vdem_row" | "regime";

type RegimeMetaWithUnknown = {
  label: string;
  colorVar: string;
  fallback: string;
  order: number;
};

const UNKNOWN_REGIME_META: RegimeMetaWithUnknown = {
  label: "Not yet coded",
  colorVar: "var(--gov-other, #8899AA)",
  fallback: "#8899AA",
  order: 999,
};

const UNKNOWN_VDEM_META = {
  label: "No V-Dem coverage",
  colorVar: "var(--gov-other, #8899AA)",
  fallback: "#8899AA",
  order: 999,
};

function normalizeDots(raw: unknown): DotRow[] {
  const rows = Array.isArray(raw)
    ? (raw as DotRow[])
    : (((raw as { rows?: unknown[] })?.rows as DotRow[]) ?? []);
  return rows.filter(
    (row) => !!row && typeof row.slug === "string" && Number.isFinite(Number(row.score)),
  );
}

function normalizeTrajectory(raw: unknown): TrajectoryRow[] {
  const rows = Array.isArray(raw)
    ? (raw as TrajectoryRow[])
    : (((raw as { rows?: unknown[] })?.rows as TrajectoryRow[]) ?? []);
  return rows.filter(
    (row) =>
      !!row &&
      typeof row.quarter === "string" &&
      typeof row.jurisdictionId === "string" &&
      Number.isFinite(Number(row.score)),
  );
}

/**
 * V-Dem RoW classifier. Reads the canonical V-Dem RoW value from a
 * pre-fetched map (Phase F's resolver, batched up-front). When a
 * country lacks V-Dem coverage (Taiwan, Vatican, etc.) it falls into
 * the "No V-Dem coverage" bucket — explicit unavailability rather
 * than silent miscoding, per the resolution's coverage commitment.
 */
function vdemRowMetaFor(
  jurisdictionId: string,
  vdemByJurisdiction: Map<string, string | null>,
): GroupMeta {
  const value = vdemByJurisdiction.get(jurisdictionId) ?? null;
  if (!value) {
    return {
      key: "no_vdem_coverage",
      label: UNKNOWN_VDEM_META.label,
      familyId: "no_vdem_coverage",
      colorVar: UNKNOWN_VDEM_META.colorVar,
      fallback: UNKNOWN_VDEM_META.fallback,
      order: UNKNOWN_VDEM_META.order,
    };
  }
  const meta = VDEM_ROW_META[value as VDemRowKey];
  if (!meta) {
    return {
      key: value,
      label: value,
      familyId: value,
      colorVar: UNKNOWN_VDEM_META.colorVar,
      fallback: UNKNOWN_VDEM_META.fallback,
      order: UNKNOWN_VDEM_META.order,
    };
  }
  return {
    key: value,
    label: meta.label,
    familyId: value,
    colorVar: meta.colorVar,
    fallback: meta.fallback,
    order: meta.order,
  };
}

function regimeTypeMeta(
  classification: GovernmentClassification | null | undefined,
): GroupMeta {
  const regimeType = classification?.regimeType as RegimeTypeKey | null;
  const meta = regimeType ? REGIME_TYPE_META[regimeType] : UNKNOWN_REGIME_META;
  return {
    key: regimeType ?? "uncoded_regime",
    label: classification?.regimeTypeLabel ?? meta.label,
    familyId: regimeType ?? "uncoded_regime",
    colorVar: meta.colorVar,
    fallback: meta.fallback,
    order: meta.order,
  };
}

function buildGroups(
  dots: DotRow[],
  classifier: (dot: DotRow) => GroupMeta,
): GroupBucket[] {
  const grouped = new Map<
    string,
    GroupBucket & {
      scoreTotal: number;
    }
  >();

  for (const dot of dots) {
    const meta = classifier(dot);
    const bucket = grouped.get(meta.key) ?? {
      meta,
      dots: [],
      countryCount: 0,
      avgScore: 0,
      minScore: Number.POSITIVE_INFINITY,
      maxScore: Number.NEGATIVE_INFINITY,
      scoreTotal: 0,
    };
    bucket.dots.push(dot);
    bucket.countryCount += 1;
    bucket.scoreTotal += Number(dot.score);
    bucket.minScore = Math.min(bucket.minScore, Number(dot.score));
    bucket.maxScore = Math.max(bucket.maxScore, Number(dot.score));
    grouped.set(meta.key, bucket);
  }

  return [...grouped.values()]
    .map((bucket) => ({
      meta: bucket.meta,
      dots: [...bucket.dots].sort((a, b) => Number(b.score) - Number(a.score)),
      countryCount: bucket.countryCount,
      avgScore: bucket.scoreTotal / Math.max(1, bucket.countryCount),
      minScore: Number.isFinite(bucket.minScore) ? bucket.minScore : 0,
      maxScore: Number.isFinite(bucket.maxScore) ? bucket.maxScore : 0,
    }))
    .sort(
      (a, b) =>
        a.meta.order - b.meta.order ||
        Number(b.avgScore) - Number(a.avgScore) ||
        a.meta.label.localeCompare(b.meta.label),
    );
}

function buildTrajectoryMap(
  rows: TrajectoryRow[],
  classifier: (row: TrajectoryRow) => GroupMeta,
): Map<string, { quarter: string; avgScore: number }[]> {
  const grouped = new Map<
    string,
    Map<string, { scoreTotal: number; countryCount: number }>
  >();

  for (const row of rows) {
    const meta = classifier(row);
    const byQuarter =
      grouped.get(meta.key) ??
      new Map<string, { scoreTotal: number; countryCount: number }>();
    const current = byQuarter.get(row.quarter) ?? {
      scoreTotal: 0,
      countryCount: 0,
    };
    current.scoreTotal += Number(row.score);
    current.countryCount += 1;
    byQuarter.set(row.quarter, current);
    grouped.set(meta.key, byQuarter);
  }

  return new Map(
    [...grouped.entries()].map(([key, byQuarter]) => [
      key,
      [...byQuarter.entries()]
        .map(([quarter, value]) => ({
          quarter,
          avgScore: value.scoreTotal / Math.max(1, value.countryCount),
        }))
        .sort((a, b) => a.quarter.localeCompare(b.quarter)),
    ]),
  );
}

function toLeaf(
  bucket: GroupBucket,
  trajectoryMap: Map<string, { quarter: string; avgScore: number }[]>,
): GovernmentTypeLeaf {
  return {
    id: bucket.meta.key,
    label: bucket.meta.label,
    colorVar: bucket.meta.colorVar,
    fallback: bucket.meta.fallback,
    dots: bucket.dots.map((dot) => ({
      slug: dot.slug,
      name: dot.name,
      score: Number(dot.score),
    })),
    countryCount: bucket.countryCount,
    avgScore: bucket.avgScore,
    minScore: bucket.minScore,
    maxScore: bucket.maxScore,
    trajectory: trajectoryMap.get(bucket.meta.key) ?? [],
  };
}

function sortLeaves(a: GovernmentTypeLeaf, b: GovernmentTypeLeaf): number {
  return (
    Number(b.avgScore) - Number(a.avgScore) ||
    Number(b.countryCount) - Number(a.countryCount) ||
    a.label.localeCompare(b.label)
  );
}

function buildFlatFamilies(
  groups: GroupBucket[],
  trajectoryMap: Map<string, { quarter: string; avgScore: number }[]>,
): GovernmentTypeFamily[] {
  return groups
    .map((group) => ({
      ...toLeaf(group, trajectoryMap),
      subtypes: [],
    }))
    .sort(sortLeaves);
}

function buildLensHref(lens: Lens, quarter?: string) {
  const params = new URLSearchParams();
  if (lens === "regime") params.set("lens", "regime");
  if (quarter) params.set("quarter", quarter);
  const query = params.toString();
  return query
    ? `/civica-index/government-types?${query}`
    : "/civica-index/government-types";
}

export default async function GovernmentTypesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const quarter = typeof sp?.quarter === "string" ? sp.quarter : undefined;
  // Phase 3c — `?lens=structural` was the legacy default. Treat any
  // unknown lens (including `structural`) as the new default
  // (`vdem_row`) per the 2026-05-02 peer-grouping resolution.
  const lens: Lens = sp?.lens === "regime" ? "regime" : "vdem_row";

  let dots: DotRow[] = [];
  let trajectoryRows: TrajectoryRow[] = [];

  try {
    const [dotsRaw, trajectoryRaw] = await Promise.all([
      getCIByGovernmentTypeDots(quarter),
      getGovTypeTrajectory(),
    ]);
    dots = normalizeDots(dotsRaw);
    trajectoryRows = normalizeTrajectory(trajectoryRaw);
  } catch {
    // DB not seeded
  }

  // Batch-fetch V-Dem RoW for every jurisdiction in scope. One
  // resolver round-trip; same data feeds both dot-grouping and
  // trajectory-grouping classifiers.
  const allJurisdictionIds = Array.from(
    new Set([
      ...dots.map((d) => d.jurisdictionId),
      ...trajectoryRows.map((t) => t.jurisdictionId),
    ]),
  ).filter(Boolean);

  const vdemByJurisdiction = new Map<string, string | null>();
  if (allJurisdictionIds.length > 0) {
    try {
      const resolved = await getCanonicalFactsForJurisdictions(
        allJurisdictionIds,
        ["vdem_row"],
      );
      for (const jurId of allJurisdictionIds) {
        const value = resolved[jurId]?.["vdem_row"]?.canonical?.factValue ?? null;
        vdemByJurisdiction.set(jurId, value);
      }
    } catch {
      // Phase F not yet synced — every country falls into "no coverage"
    }
  }

  const vdemDotClassifier = (dot: DotRow) =>
    vdemRowMetaFor(dot.jurisdictionId, vdemByJurisdiction);
  const vdemTrajectoryClassifier = (row: TrajectoryRow) =>
    vdemRowMetaFor(row.jurisdictionId, vdemByJurisdiction);
  const regimeDotClassifier = (dot: DotRow) =>
    regimeTypeMeta(dot.governmentClassification ?? null);
  const regimeTrajectoryClassifier = (row: TrajectoryRow) =>
    regimeTypeMeta(row.governmentClassification ?? null);

  const vdemGroups = buildGroups(dots, vdemDotClassifier);
  const vdemTrajectories = buildTrajectoryMap(
    trajectoryRows,
    vdemTrajectoryClassifier,
  );
  const vdemFamilies = buildFlatFamilies(vdemGroups, vdemTrajectories);

  const regimeGroups = buildGroups(dots, regimeDotClassifier);
  const regimeTrajectories = buildTrajectoryMap(
    trajectoryRows,
    regimeTrajectoryClassifier,
  );
  const regimeFamilies = buildFlatFamilies(regimeGroups, regimeTrajectories);

  const families = lens === "regime" ? regimeFamilies : vdemFamilies;
  const totalCountries = dots.length;

  return (
    <>
      <GovernmentTypesAccordionExplorer
        families={families}
        totalCountries={totalCountries}
        lensTitle={
          lens === "regime"
            ? "Regime type (Bjørnskov-Rode / CGV)"
            : "V-Dem Regimes of the World"
        }
        lensSummary={
          lens === "regime"
            ? "Bjørnskov-Rode / CGV is the alternate accountability lens. Six published categories distinguishing democratic systems by executive form (parliamentary / presidential / semi-presidential) and authoritarian systems by ruling-elite structure (civilian / military / royal)."
            : "V-Dem Regimes of the World is the default governance lens (Lührmann et al. 2018). Four tiers spanning closed autocracy through liberal democracy. See methodology for why this replaced the retired structural_family heuristic."
        }
        axisLabel={
          lens === "regime"
            ? "Y-AXIS: BR / CGV REGIME TYPE · X-AXIS: CIVICA INDEX 0–100 · WHITE BAR: AVG"
            : "Y-AXIS: V-DEM ROW TIER · X-AXIS: CIVICA INDEX 0–100 · WHITE BAR: AVG"
        }
        plotHelper={
          lens === "regime"
            ? "These are the published BR/CGV accountability categories. Use V-Dem RoW for the default governance lens."
            : "Default lens. Switch to BR/CGV for the alternate executive-form classification."
        }
        footerLabel={lens === "regime" ? "regime types" : "RoW tiers"}
        lensTabs={[
          {
            id: "vdem_row",
            label: "V-Dem RoW",
            href: buildLensHref("vdem_row", quarter),
            active: lens === "vdem_row",
          },
          {
            id: "regime",
            label: "BR / CGV regime",
            href: buildLensHref("regime", quarter),
            active: lens === "regime",
          },
        ]}
      />

      <section
        id="cite"
        className="editorial-section"
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "var(--space-8) var(--space-5)",
        }}
      >
        <h2>Cite this page</h2>
        <CiteAccordion
          subject={`Civica Atlas — Government Types Explorer — ${FACTBOOK_RECONCILIATION_META.vintage}`}
          pageTitle="Government Types Explorer"
          url="https://civicaatlas.org/civica-index/government-types"
        />
      </section>
    </>
  );
}
