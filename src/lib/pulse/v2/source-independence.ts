import { createHash } from "node:crypto";

import {
  compareEventIdentities,
  normalizeEventIdentity,
} from "./event-identity";
import type { SourceType } from "./types";

export const PULSE_SOURCE_INDEPENDENCE_VERSION =
  "pulse-source-independence/evidence-family-v1" as const;
export const SOURCE_INDEPENDENCE_MIN_PRECISION = 0.95;
export const SOURCE_INDEPENDENCE_MIN_RECALL = 0.9;

const HOST_FAMILIES: Readonly<Record<string, string>> = {
  "amnesty.org": "amnesty-international",
  "apnews.com": "associated-press",
  "bbc.co.uk": "bbc",
  "bbc.com": "bbc",
  "civicus.org": "civicus",
  "hrw.org": "human-rights-watch",
  "reuters.com": "reuters",
  "thomsonreuters.com": "reuters",
};

const DIRECT_SOURCE_FAMILIES: Readonly<Record<string, string>> = {
  acled: "acled",
  amnesty: "amnesty-international",
  ap_wire: "associated-press",
  civicus_monitor: "civicus",
  hrw: "human-rights-watch",
  ipu_parline: "ipu-parline",
  reuters_wire: "reuters",
  rsf_alerts: "reporters-without-borders",
};

const ORIGIN_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/\b(?:reuters|thomson reuters)\b/i, "reuters"],
  [/\b(?:associated press|the ap)\b/i, "associated-press"],
  [/\bamnesty international\b/i, "amnesty-international"],
  [/\bhuman rights watch\b/i, "human-rights-watch"],
  [/\bcivicus(?: monitor)?\b/i, "civicus"],
  [/\breporters without borders\b|\brsf\b/i, "reporters-without-borders"],
  [/\bacled\b|armed conflict location and event data/i, "acled"],
  [/\binter-parliamentary union\b|\bipu parline\b/i, "ipu-parline"],
];

export interface SourceEvidenceReport {
  rawEventId: string;
  sourceId: string;
  sourceType: SourceType;
  sourceUrl: string | null;
  sourceFamilyId: string;
  itemPublisherHost: string | null;
  title: string;
  body: string | null;
}

export type DependenceReason =
  | "same_snapshot"
  | "same_canonical_url"
  | "same_publisher_family"
  | "same_declared_origin"
  | "near_verbatim_republication";

export interface SourceDependenceRelation {
  leftRawEventId: string;
  rightRawEventId: string;
  dependent: boolean;
  reason: DependenceReason | "distinct_evidence";
}

export interface IndependentEvidenceGroup {
  id: string;
  rawEventIds: string[];
  sourceType: SourceType;
  publisherFamilies: string[];
  originFamilies: string[];
}

export interface SourceIndependenceResult {
  version: typeof PULSE_SOURCE_INDEPENDENCE_VERSION;
  groups: IndependentEvidenceGroup[];
  relations: SourceDependenceRelation[];
}

function normalizedHost(value: string | null): string | null {
  if (!value) return null;
  const host = value.toLowerCase().replace(/^(?:www\d*|m|amp)\./, "");
  return host || null;
}

function registeredFamily(host: string | null): string | null {
  const normalized = normalizedHost(host);
  if (!normalized) return null;
  for (const [suffix, family] of Object.entries(HOST_FAMILIES)) {
    if (normalized === suffix || normalized.endsWith(`.${suffix}`))
      return family;
  }
  return normalized;
}

export function publisherFamily(report: SourceEvidenceReport): string {
  if (report.sourceId === "gdelt") {
    return (
      registeredFamily(report.itemPublisherHost) ??
      "unresolved-publisher"
    );
  }
  return (
    DIRECT_SOURCE_FAMILIES[report.sourceId] ??
    registeredFamily(report.itemPublisherHost) ??
    report.sourceFamilyId
  );
}

export function canonicalEvidenceUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = new URLSearchParams(
      [...url.searchParams].filter(
        ([key]) => !/^(?:utm_|fbclid$|gclid$|mc_)/i.test(key),
      ),
    ).toString();
    url.hostname = normalizedHost(url.hostname) ?? url.hostname;
    url.pathname = url.pathname.replace(/\/$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}

export function declaredOriginFamily(
  report: SourceEvidenceReport,
): string | null {
  const text = `${report.title}\n${report.body ?? ""}`;
  for (const [pattern, family] of ORIGIN_PATTERNS) {
    if (pattern.test(text)) return family;
  }
  const direct = publisherFamily(report);
  return report.sourceId === "gdelt" ? null : direct;
}

export function compareSourceEvidence(
  left: SourceEvidenceReport,
  right: SourceEvidenceReport,
): SourceDependenceRelation {
  const base = {
    leftRawEventId: left.rawEventId,
    rightRawEventId: right.rawEventId,
  };
  if (left.rawEventId === right.rawEventId) {
    return { ...base, dependent: true, reason: "same_snapshot" };
  }
  const leftUrl = canonicalEvidenceUrl(left.sourceUrl);
  const rightUrl = canonicalEvidenceUrl(right.sourceUrl);
  if (leftUrl && leftUrl === rightUrl) {
    return { ...base, dependent: true, reason: "same_canonical_url" };
  }
  if (publisherFamily(left) === publisherFamily(right)) {
    return { ...base, dependent: true, reason: "same_publisher_family" };
  }
  const leftOrigin = declaredOriginFamily(left);
  const rightOrigin = declaredOriginFamily(right);
  if (leftOrigin && leftOrigin === rightOrigin) {
    return { ...base, dependent: true, reason: "same_declared_origin" };
  }
  const identity = compareEventIdentities(
    normalizeEventIdentity(left.title, left.body),
    normalizeEventIdentity(right.title, right.body),
  );
  if (identity.exactNormalizedMatch || identity.tokenSimilarity >= 0.82) {
    return { ...base, dependent: true, reason: "near_verbatim_republication" };
  }
  return { ...base, dependent: false, reason: "distinct_evidence" };
}

export function deriveSourceIndependence(
  reports: readonly SourceEvidenceReport[],
): SourceIndependenceResult {
  const ordered = [...reports].sort((a, b) =>
    a.rawEventId.localeCompare(b.rawEventId),
  );
  const parent = ordered.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parent[root] !== root) root = parent[root];
    while (parent[index] !== index) {
      const next = parent[index];
      parent[index] = root;
      index = next;
    }
    return root;
  };
  const relations: SourceDependenceRelation[] = [];
  for (let left = 0; left < ordered.length; left++) {
    for (let right = left + 1; right < ordered.length; right++) {
      const relation = compareSourceEvidence(ordered[left], ordered[right]);
      relations.push(relation);
      if (relation.dependent) {
        const leftRoot = find(left);
        const rightRoot = find(right);
        if (leftRoot !== rightRoot) parent[leftRoot] = rightRoot;
      }
    }
  }
  const members = new Map<number, SourceEvidenceReport[]>();
  for (let index = 0; index < ordered.length; index++) {
    const root = find(index);
    members.set(root, [...(members.get(root) ?? []), ordered[index]]);
  }
  const groups = [...members.values()].map((group) => {
    const rawEventIds = group.map(({ rawEventId }) => rawEventId).sort();
    const publisherFamilies = [...new Set(group.map(publisherFamily))].sort();
    const originFamilies = [
      ...new Set(group.map(declaredOriginFamily).filter(Boolean) as string[]),
    ].sort();
    const sourceType: SourceType = group.some(
      ({ sourceType }) => sourceType === "specialist",
    )
      ? "specialist"
      : "news";
    const id = createHash("sha256")
      .update(`${PULSE_SOURCE_INDEPENDENCE_VERSION}\n${rawEventIds.join("\n")}`)
      .digest("hex");
    return {
      id: `evidence-family/sha256:${id}`,
      rawEventIds,
      sourceType,
      publisherFamilies,
      originFamilies,
    };
  });
  return {
    version: PULSE_SOURCE_INDEPENDENCE_VERSION,
    groups: groups.sort((a, b) => a.id.localeCompare(b.id)),
    relations,
  };
}
