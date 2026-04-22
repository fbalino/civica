import type { Metadata } from "next";
import {
  GovernmentTypesAccordionExplorer,
  type GovernmentTypeFamily,
  type GovernmentTypeLeaf,
} from "@/components/ci/GovernmentTypesAccordionExplorer";
import {
  REGIME_TYPE_META,
  STRUCTURAL_FAMILY_META,
  type GovernmentClassification,
  type RegimeTypeKey,
  type StructuralFamilyKey,
} from "@/lib/government-taxonomy";
import {
  getCIByGovernmentTypeDots,
  getGovTypeTrajectory,
} from "@/lib/db/queries";

export const metadata: Metadata = {
  title: "Governance Outcomes by Government Type — Civica Index",
  description:
    "Compare governance outcomes by structural form or BR/CGV regime type. Civica shows both the constitutional form and the executive-accountability lens without changing CI scores.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/government-types" },
  openGraph: {
    title: "Governance Outcomes by Government Type | Civica Index",
    description:
      "Structural families by default, BR/CGV regime types on demand. Distribution, spread, and trajectory for every visible system.",
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

type Lens = "structural" | "regime";

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

function structuralFamilyMeta(
  classification: GovernmentClassification | null | undefined,
): GroupMeta {
  const family = (classification?.structuralFamily ??
    "other") as StructuralFamilyKey;
  const meta = STRUCTURAL_FAMILY_META[family] ?? STRUCTURAL_FAMILY_META.other;
  return {
    key: family,
    label: classification?.structuralFamilyLabel ?? meta.label,
    familyId: family,
    colorVar: meta.colorVar,
    fallback: meta.fallback,
    order: meta.order,
  };
}

function structuralSubtypeMeta(
  classification: GovernmentClassification | null | undefined,
): GroupMeta {
  const familyMeta = structuralFamilyMeta(classification);
  const subtypeKey = classification?.structuralSubtype ?? familyMeta.key;
  const subtypeLabel = classification?.structuralSubtypeLabel ?? familyMeta.label;
  return {
    key: subtypeKey,
    label: subtypeLabel,
    familyId: familyMeta.familyId,
    colorVar: familyMeta.colorVar,
    fallback: familyMeta.fallback,
    order: familyMeta.order + (subtypeKey === familyMeta.key ? 0 : 10),
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
  classifier: (classification: GovernmentClassification | null | undefined) => GroupMeta,
): GroupBucket[] {
  const grouped = new Map<
    string,
    GroupBucket & {
      scoreTotal: number;
    }
  >();

  for (const dot of dots) {
    const meta = classifier(dot.governmentClassification ?? null);
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
  classifier: (classification: GovernmentClassification | null | undefined) => GroupMeta,
): Map<string, { quarter: string; avgScore: number }[]> {
  const grouped = new Map<
    string,
    Map<string, { scoreTotal: number; countryCount: number }>
  >();

  for (const row of rows) {
    const meta = classifier(row.governmentClassification ?? null);
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

function buildStructuralFamilies(
  familyGroups: GroupBucket[],
  subtypeGroups: GroupBucket[],
  familyTrajectories: Map<string, { quarter: string; avgScore: number }[]>,
  subtypeTrajectories: Map<string, { quarter: string; avgScore: number }[]>,
): GovernmentTypeFamily[] {
  const subtypesByFamily = new Map<string, GroupBucket[]>();

  for (const subtype of subtypeGroups) {
    const list = subtypesByFamily.get(subtype.meta.familyId) ?? [];
    list.push(subtype);
    subtypesByFamily.set(subtype.meta.familyId, list);
  }

  return familyGroups
    .map((family) => {
      const siblingSubtypes = (subtypesByFamily.get(family.meta.familyId) ?? [])
        .filter((subtype) => subtype.meta.key !== family.meta.key)
        .sort(
          (a, b) =>
            a.meta.order - b.meta.order || a.meta.label.localeCompare(b.meta.label),
        );

      return {
        ...toLeaf(family, familyTrajectories),
        subtypes: siblingSubtypes
          .map((subtype) => toLeaf(subtype, subtypeTrajectories))
          .sort(sortLeaves),
      };
    })
    .sort(sortLeaves);
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
  if (lens === "regime") params.set("lens", lens);
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
  const lens: Lens = sp?.lens === "regime" ? "regime" : "structural";

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

  const structuralFamilyGroups = buildGroups(dots, structuralFamilyMeta);
  const structuralSubtypeGroups = buildGroups(dots, structuralSubtypeMeta);
  const structuralFamilyTrajectories = buildTrajectoryMap(
    trajectoryRows,
    structuralFamilyMeta,
  );
  const structuralSubtypeTrajectories = buildTrajectoryMap(
    trajectoryRows,
    structuralSubtypeMeta,
  );
  const structuralFamilies = buildStructuralFamilies(
    structuralFamilyGroups,
    structuralSubtypeGroups,
    structuralFamilyTrajectories,
    structuralSubtypeTrajectories,
  );

  const regimeGroups = buildGroups(dots, regimeTypeMeta);
  const regimeTrajectories = buildTrajectoryMap(trajectoryRows, regimeTypeMeta);
  const regimeFamilies = buildFlatFamilies(regimeGroups, regimeTrajectories);

  const families = lens === "regime" ? regimeFamilies : structuralFamilies;
  const totalCountries = dots.length;

  return (
    <GovernmentTypesAccordionExplorer
      families={families}
      totalCountries={totalCountries}
      lensTitle={
        lens === "regime"
          ? "Regime type (Bjornskov-Rode / CGV)"
          : "Structural form"
      }
      lensSummary={
        lens === "regime"
          ? "This lens uses published accountability categories. Because the regime classes are already the normalized endpoints, rows stay flat rather than expanding into subtypes."
          : "Broad structural families stay visible by default. Expand a family to reveal its subtypes in both the chart and the table below."
      }
      axisLabel={
        lens === "regime"
          ? "Y-AXIS: BR / CGV REGIME TYPE · X-AXIS: CIVICA INDEX 0–100 · WHITE BAR: AVG"
          : "Y-AXIS: STRUCTURAL FAMILY & SUBTYPE · X-AXIS: CIVICA INDEX 0–100 · WHITE BAR: AVG"
      }
      plotHelper={
        lens === "regime"
          ? "These are the published accountability categories. Use the structural lens when you want constitutional form instead."
          : "Click any family name or chevron to reveal subtype rows without changing the axis scale."
      }
      footerLabel={lens === "regime" ? "regime types" : "families"}
      lensTabs={[
        {
          id: "structural",
          label: "Structural form",
          href: buildLensHref("structural", quarter),
          active: lens === "structural",
        },
        {
          id: "regime",
          label: "Regime type",
          href: buildLensHref("regime", quarter),
          active: lens === "regime",
        },
      ]}
    />
  );
}
