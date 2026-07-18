"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MetricStripPlot } from "@/components/outcomes/MetricStripPlot";
import { Tooltip } from "@/components/editorial/Tooltip";
import {
  SingleSelectMenu,
  type SingleSelectItem,
} from "@/components/editorial/SingleSelectMenu";
import type { GovernmentTaxonomyLens } from "@/lib/government-taxonomy";
import type {
  StripDot,
  GovTypeBand,
  MetricDef,
} from "@/components/outcomes/MetricStripPlot";

// ─── Prop types ───────────────────────────────────────────────────────────────

export interface MetricOption {
  id: string;
  name: string;
  description: string | null;
  category: string;
  unit: string | null;
  higherIsBetter: boolean;
  coverageCount?: number;
  latestYear?: number;
}

interface OutcomesExplorerProps {
  metrics: MetricOption[];
  initialMetricId: string;
  initialYear: number;
  /** "civica-conditions" = new Conditions framing; default = legacy Outcomes framing */
  pageVariant?: "civica-conditions" | "outcomes";
}

// ─── Strip data response ──────────────────────────────────────────────────────

interface StripDataResponse {
  data: StripDot[];
  govTypeBands: Record<string, GovTypeBand>;
  metricDef: MetricDef;
  coverage: { total: number; withData: number };
  taxonomy?: GovernmentTaxonomyLens;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CONTINENTS = ["Africa", "Americas", "Asia", "Europe", "Oceania"] as const;
const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2000;

function buildYearOptions(latestYear?: number) {
  const top = Math.max(latestYear ?? CURRENT_YEAR, CURRENT_YEAR);
  const years: number[] = [];
  for (let y = top; y >= MIN_YEAR; y--) years.push(y);
  return years;
}

// Group metrics by category
function groupByCategory(metrics: MetricOption[]) {
  const map = new Map<string, MetricOption[]>();
  for (const m of metrics) {
    if (!map.has(m.category)) map.set(m.category, []);
    map.get(m.category)!.push(m);
  }
  return map;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StripSkeleton() {
  return (
    <div style={{ width: "100%" }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{
            width: "100%",
            height: 60,
            marginBottom: 2,
            borderRadius: "var(--radius-sm)",
          }}
        />
      ))}
    </div>
  );
}

// ─── Filter menu ──────────────────────────────────────────────────────────────

interface FilterMenuProps {
  label: string;
  summary: string;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  items: Array<{
    id: string;
    label: string;
    checked: boolean;
    onToggle: () => void;
  }>;
}

function FilterMenu({
  label,
  summary,
  open,
  onToggle,
  onClear,
  items,
}: FilterMenuProps) {
  return (
    <div style={{ position: "relative", minWidth: 210 }}>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"],
          fontSize: "var(--text-12)",
          letterSpacing: "var(--tracking-caps)",
          textTransform: "uppercase",
          color: "var(--color-text-30)",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "10px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-card-border)",
          background: "var(--color-select-bg, var(--color-surface-elevated))",
          color: "var(--color-text-primary)",
          fontFamily: "var(--font-body-sans)",
          fontSize: "var(--text-14)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {summary}
        </span>
        <span
          style={{
            fontFamily: "var(--font-body)",
            color: "var(--color-text-40)",
            transition: "transform 140ms ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▾
        </span>
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            minWidth: "100%",
            maxWidth: 320,
            background: "var(--color-card-bg)",
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-dark)",
            padding: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
              gap: 12,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"],
                fontSize: "var(--text-12)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                color: "var(--color-text-30)",
              }}
            >
              {label}
            </div>
            <button
              type="button"
              onClick={onClear}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"],
                fontSize: "var(--text-12)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                color: "var(--color-accent)",
              }}
            >
              Show all
            </button>
          </div>
          <div style={{ display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {items.map((item) => (
              <label
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                  padding: "4px 0",
                  fontFamily: "var(--font-body-sans)",
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-60)",
                }}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={item.onToggle}
                  style={{ accentColor: "var(--color-accent)" }}
                />
                <span>{item.label}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TaxonomyGlossaryCard({
  label,
  title,
  description,
}: {
  label: string;
  title: string;
  description: string;
}) {
  return (
    <Tooltip content={title} triggerStyle={{ display: "block" }}>
      <div
        style={{
          borderLeft: "1px solid var(--color-card-border)",
          paddingLeft: 14,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"],
            fontSize: "var(--text-12)",
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
            color: "var(--color-accent)",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-body-sans)",
            fontSize: "var(--text-14)",
            color: "var(--color-text-50)",
            lineHeight: 1.55,
          }}
        >
          {description}
        </p>
      </div>
    </Tooltip>
  );
}

// ─── Country detail panel ─────────────────────────────────────────────────────

interface CountryDetail {
  countryName: string;
  govType: string;
  value: number;
  rank: number | null;
  totalRanked: number | null;
  slug: string;
  unit?: string | null;
  metricName: string;
}

interface DetailPanelProps {
  detail: CountryDetail;
  onClose: () => void;
  isDesktop: boolean;
}

function DetailPanel({ detail, onClose, isDesktop }: DetailPanelProps) {
  const formattedValue =
    Math.abs(detail.value) >= 1000
      ? detail.value.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : detail.value.toLocaleString(undefined, { maximumFractionDigits: 2 });

  // Dialog a11y — mirrors MapExplorerModal / FactbookLightbox: Escape to close,
  // move focus into the panel on open, restore focus to the previously-focused
  // element (the dot/row the user activated) on close. No body-scroll lock: the
  // desktop variant is a side rail that coexists with the scrollable map.
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const previouslyFocused =
      typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore focus only if it's still inside the (now-closing) panel, so we
      // don't yank focus away from wherever the user has since moved.
      const active = document.activeElement;
      if (
        previouslyFocused &&
        (!active || panelRef.current?.contains(active as Node)) &&
        typeof previouslyFocused.focus === "function"
      ) {
        previouslyFocused.focus();
      }
    };
  }, [onClose]);

  const panelStyle: React.CSSProperties = isDesktop
    ? {
        position: "fixed",
        top: 80,
        right: 0,
        width: 320,
        maxHeight: "calc(100vh - 100px)",
        overflowY: "auto",
        background: "var(--color-card-bg)",
        borderLeft: "1px solid var(--color-card-border)",
        borderTop: "1px solid var(--color-card-border)",
        borderBottom: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-md) 0 0 var(--radius-md)",
        padding: "24px 20px",
        zIndex: 100,
        boxShadow: "var(--shadow-hard-lg)",
        animation: "slideInRight 200ms ease",
      }
    : {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: "60vh",
        overflowY: "auto",
        background: "var(--color-card-bg)",
        borderTop: "1px solid var(--color-card-border)",
        borderRadius: "var(--radius-md) var(--radius-md) 0 0",
        padding: "20px 20px 32px",
        zIndex: 100,
        boxShadow: "var(--shadow-hard-lg)",
        animation: "slideInUp 200ms ease",
      };

  return (
    <>
      {/* Backdrop for mobile */}
      {!isDesktop && (
        <div
          onClick={onClose}
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            background: "color-mix(in oklab, var(--color-text-primary) 40%, transparent)",
            zIndex: 99,
          }}
        />
      )}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="outcomes-detail-title"
        style={panelStyle}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <h2
            id="outcomes-detail-title"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "var(--text-24)",
              fontWeight: 400,
              color: "var(--color-text-primary)",
              lineHeight: "var(--leading-tight)",
              margin: 0,
            }}
          >
            {detail.countryName}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--color-text-40)",
              fontSize: "var(--text-18)",
              padding: "0 0 0 8px",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "inline-block",
            padding: "3px 8px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-stat-border)",
            background: "var(--color-surface-elevated)",
            fontFamily: "var(--font-body-sans)",
            fontSize: "var(--text-12)",
            color: "var(--color-text-50)",
            marginBottom: 20,
          }}
        >
          {detail.govType}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--text-28)",
              color: "var(--color-accent)",
              lineHeight: 1,
              marginBottom: 4,
            }}
          >
            {formattedValue}
            {detail.unit && (
              <span
                style={{
                  fontSize: "var(--text-14)",
                  color: "var(--color-text-40)",
                  marginLeft: 6,
                }}
              >
                {detail.unit}
              </span>
            )}
          </div>
          <div
            style={{
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-13)",
              color: "var(--color-text-40)",
            }}
          >
            {detail.metricName}
          </div>
        </div>

        {detail.rank != null && detail.totalRanked != null && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-surface-elevated)",
              border: "1px solid var(--color-stat-border)",
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--text-13)",
              color: "var(--color-text-60)",
              marginBottom: 20,
            }}
          >
            Rank{" "}
            <strong style={{ color: "var(--color-text-primary)" }}>
              {detail.rank}
            </strong>{" "}
            of {detail.totalRanked}
          </div>
        )}

        <Link
          href={`/country/${detail.slug}`}
          style={{
            display: "block",
            padding: "10px 16px",
            background: "var(--color-accent)",
            color: "var(--color-bg)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-body-sans)",
            fontSize: "var(--text-14)",
            fontWeight: 600,
            textDecoration: "none",
            textAlign: "center",
          }}
        >
          Open country page →
        </Link>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OutcomesExplorer({
  metrics,
  initialMetricId,
  initialYear,
  pageVariant = "outcomes",
}: OutcomesExplorerProps) {
  const isConditionsPage = pageVariant === "civica-conditions";
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  // ── State ──
  const [metricId, setMetricId] = useState<string>(() => {
    return searchParams.get("metric") ?? initialMetricId;
  });
  const [year, setYear] = useState<number>(() => {
    const y = searchParams.get("year");
    return y ? parseInt(y, 10) : initialYear;
  });
  const [selectedGovTypes, setSelectedGovTypes] = useState<string[]>(() => {
    const raw = searchParams.get("govTypes");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [taxonomy, setTaxonomy] = useState<GovernmentTaxonomyLens>(() => {
    const raw = searchParams.get("taxonomy");
    return raw === "raw" || raw === "regime" ? raw : "structural";
  });
  const [selectedRegions, setSelectedRegions] = useState<string[]>(() => {
    const raw = searchParams.get("regions");
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [smallMultiples, setSmallMultiples] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<
    null | "metric" | "year" | "lens" | "government" | "region"
  >(null);
  const metricMenuRef = useRef<HTMLDivElement>(null);
  const yearMenuRef = useRef<HTMLDivElement>(null);
  const lensMenuRef = useRef<HTMLDivElement>(null);
  const govMenuRef = useRef<HTMLDivElement>(null);
  const regionMenuRef = useRef<HTMLDivElement>(null);

  // ── Fetched data ──
  const [stripData, setStripData] = useState<StripDataResponse | null>(null);
  const [allStripData, setAllStripData] = useState<
    Record<string, StripDataResponse>
  >({});
  const [loading, setLoading] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  // ── Selected country detail ──
  const [selectedCountry, setSelectedCountry] = useState<CountryDetail | null>(
    null
  );

  // ── Responsive ──
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // ── Current metric object ──
  const currentMetric = useMemo(
    () => metrics.find((m) => m.id === metricId) ?? metrics[0],
    [metrics, metricId]
  );

  const resolvedMetricDef = useMemo<MetricDef | null>(() => {
    if (stripData?.metricDef) return stripData.metricDef;
    if (!currentMetric) return null;
    return {
      id: currentMetric.id,
      name: currentMetric.name,
      description: currentMetric.description,
      category: currentMetric.category,
      unit: currentMetric.unit,
      higherIsBetter: currentMetric.higherIsBetter,
      sourceName: currentMetric.name,
    };
  }, [currentMetric, stripData]);

  // ── Year options for selected metric ──
  const yearOptions = useMemo(
    () => buildYearOptions(currentMetric?.latestYear),
    [currentMetric]
  );

  // ── Unique gov types from current strip data ──
  const availableGovTypes = useMemo(() => {
    if (!stripData) return [];
    const seen = new Set<string>();
    for (const d of stripData.data) {
      if (d.govType) seen.add(d.govType);
    }
    return Array.from(seen).sort();
  }, [stripData]);

  const selectedGovTypeSummary = useMemo(() => {
    if (selectedGovTypes.length === 0) {
      return taxonomy === "raw" ? "All source labels" : "All categories";
    }
    if (selectedGovTypes.length === 1) {
      return selectedGovTypes[0];
    }
    return `${selectedGovTypes.length} selected`;
  }, [selectedGovTypes, taxonomy]);

  const selectedRegionSummary = useMemo(() => {
    if (selectedRegions.length === 0) return "All regions";
    if (selectedRegions.length === 1) return selectedRegions[0];
    return `${selectedRegions.length} selected`;
  }, [selectedRegions]);

  // ── URL sync ──
  const syncUrl = useCallback(
    (
      newMetric: string,
      newYear: number,
      newGovTypes: string[],
      newTaxonomy: GovernmentTaxonomyLens,
      newRegions: string[],
    ) => {
      const params = new URLSearchParams();
      params.set("metric", newMetric);
      params.set("year", String(newYear));
      if (newTaxonomy !== "structural") {
        params.set("taxonomy", newTaxonomy);
      }
      if (newGovTypes.length > 0) {
        params.set("govTypes", newGovTypes.join(","));
      }
      if (newRegions.length > 0) {
        params.set("regions", newRegions.join(","));
      }
      // `/outcomes` was removed (it now 308-redirects to /civica-conditions),
      // so this page always lives at /civica-conditions.
      const basePath = "/civica-conditions";
      startTransition(() => {
        router.replace(`${basePath}?${params.toString()}`, { scroll: false });
      });
    },
    [router]
  );

  // ── Fetch single metric strip data ──
  const fetchStripData = useCallback(
    async (
      mId: string,
      yr: number,
      govTypes: string[],
      nextTaxonomy: GovernmentTaxonomyLens,
      regions: string[],
    ) => {
      setLoading(true);
      try {
        const govTypesParam =
          govTypes.length > 0
            ? `&govTypes=${encodeURIComponent(govTypes.join(","))}`
            : "";
        const taxonomyParam =
          nextTaxonomy !== "raw" ? `&taxonomy=${encodeURIComponent(nextTaxonomy)}` : "";
        const regionsParam =
          regions.length > 0
            ? `&regions=${encodeURIComponent(regions.join(","))}`
            : "";
        const res = await fetch(
          `/api/metrics/${mId}/strip-data?year=${yr}${govTypesParam}${taxonomyParam}${regionsParam}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: StripDataResponse = await res.json();
        setStripData(json);
      } catch (err) {
        console.error("Failed to fetch strip data:", err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ── Fetch all metrics strip data (small multiples) ──
  const fetchAllStripData = useCallback(
    async (
      yr: number,
      govTypes: string[],
      nextTaxonomy: GovernmentTaxonomyLens,
      regions: string[],
    ) => {
      setLoadingAll(true);
      try {
        const govTypesParam =
          govTypes.length > 0
            ? `&govTypes=${encodeURIComponent(govTypes.join(","))}`
            : "";
        const taxonomyParam =
          nextTaxonomy !== "raw" ? `&taxonomy=${encodeURIComponent(nextTaxonomy)}` : "";
        const regionsParam =
          regions.length > 0
            ? `&regions=${encodeURIComponent(regions.join(","))}`
            : "";
        const results = await Promise.allSettled(
          metrics.map((m) =>
            fetch(
              `/api/metrics/${m.id}/strip-data?year=${yr}${govTypesParam}${taxonomyParam}${regionsParam}`
            ).then((r) => r.json() as Promise<StripDataResponse>)
          )
        );
        const map: Record<string, StripDataResponse> = {};
        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            map[metrics[i].id] = r.value;
          }
        });
        setAllStripData(map);
      } catch (err) {
        console.error("Failed to fetch all strip data:", err);
      } finally {
        setLoadingAll(false);
      }
    },
    [metrics]
  );

  // ── Effects ──

  // Fetch on metric/year/govTypes change
  useEffect(() => {
    fetchStripData(metricId, year, selectedGovTypes, taxonomy, selectedRegions);
  }, [metricId, year, selectedGovTypes, taxonomy, selectedRegions, fetchStripData]);

  // Fetch all when small multiples enabled
  useEffect(() => {
    if (smallMultiples) {
      fetchAllStripData(year, selectedGovTypes, taxonomy, selectedRegions);
    }
  }, [
    smallMultiples,
    year,
    selectedGovTypes,
    taxonomy,
    selectedRegions,
    fetchAllStripData,
  ]);

  // Close filter menus on outside click
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        metricMenuRef.current?.contains(target) ||
        yearMenuRef.current?.contains(target) ||
        lensMenuRef.current?.contains(target) ||
        govMenuRef.current?.contains(target) ||
        regionMenuRef.current?.contains(target)
      ) {
        return;
      }
      setOpenMenu(null);
    };
    document.addEventListener("mousedown", handler);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenu]);

  // ── Handlers ──

  const handleMetricChange = (id: string) => {
    setMetricId(id);
    const newMetric = metrics.find((m) => m.id === id);
    const newYear = newMetric?.latestYear ?? year;
    setYear(newYear);
    setSelectedGovTypes([]);
    setSelectedCountry(null);
    syncUrl(id, newYear, [], taxonomy, selectedRegions);
  };

  const handleYearChange = (yr: number) => {
    setYear(yr);
    setSelectedCountry(null);
    syncUrl(metricId, yr, selectedGovTypes, taxonomy, selectedRegions);
  };

  const handleGovTypeToggle = (govType: string) => {
    let next: string[];
    if (govType === "__all__") {
      next = [];
    } else {
      const already = selectedGovTypes.includes(govType);
      if (already) {
        next = selectedGovTypes.filter((g) => g !== govType);
      } else {
        next = [...selectedGovTypes, govType];
      }
    }
    setSelectedGovTypes(next);
    syncUrl(metricId, year, next, taxonomy, selectedRegions);
  };

  const handleTaxonomyChange = (nextTaxonomy: GovernmentTaxonomyLens) => {
    setTaxonomy(nextTaxonomy);
    setSelectedGovTypes([]);
    setSelectedCountry(null);
    syncUrl(metricId, year, [], nextTaxonomy, selectedRegions);
  };

  const handleRegionToggle = (region: string) => {
    setSelectedRegions((prev) => {
      const next = prev.includes(region)
        ? prev.filter((r) => r !== region)
        : [...prev, region];
      syncUrl(metricId, year, selectedGovTypes, taxonomy, next);
      return next;
    });
  };

  const clearGovTypes = () => {
    setSelectedGovTypes([]);
    syncUrl(metricId, year, [], taxonomy, selectedRegions);
  };

  const clearRegions = () => {
    setSelectedRegions([]);
    syncUrl(metricId, year, selectedGovTypes, taxonomy, []);
  };

  const handleCountryClick = (slug: string) => {
    if (!stripData) return;
    const dot = stripData.data.find((d) => d.slug === slug);
    if (!dot) return;
    setSelectedCountry({
      countryName: dot.countryName,
      govType: dot.govType,
      value: dot.value,
      rank: dot.rank,
      totalRanked: dot.totalRanked,
      slug,
      unit: stripData.metricDef.unit,
      metricName: stripData.metricDef.name,
    });
  };

  const handleCountryClickInMultiple = (
    mId: string,
    slug: string
  ) => {
    const data = allStripData[mId];
    if (!data) return;
    const dot = data.data.find((d) => d.slug === slug);
    if (!dot) return;
    setSelectedCountry({
      countryName: dot.countryName,
      govType: dot.govType,
      value: dot.value,
      rank: dot.rank,
      totalRanked: dot.totalRanked,
      slug,
      unit: data.metricDef.unit,
      metricName: data.metricDef.name,
    });
  };

  // ── Category groups ──
  const categoryGroups = useMemo(() => groupByCategory(metrics), [metrics]);

  // Flattened, category-ordered metric options for the custom single-select
  // menu (the native <select> used <optgroup>; the popover keeps the same
  // category order and prefixes each label with its category for context).
  const metricMenuItems = useMemo(
    () =>
      Array.from(categoryGroups.entries()).flatMap(([cat, catMetrics]) =>
        catMetrics.map((m) => ({
          value: m.id,
          label: `${cat} · ${m.name}`,
        })),
      ),
    [categoryGroups],
  );

  const yearMenuItems = useMemo(
    () => yearOptions.map((y) => ({ value: String(y), label: String(y) })),
    [yearOptions],
  );

  const lensMenuItems = useMemo(
    () => [
      { value: "structural", label: "Structural form" },
      { value: "regime", label: "Regime type" },
      { value: "raw", label: "Raw source" },
    ],
    [],
  );

  // ── Metric selector ──
  const isMobile = !isDesktop;
  const useSegmented = !isMobile && metrics.length <= 6;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideInUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <section className="editorial-tool-page">
        {/* Breadcrumb — canonical .editorial-breadcrumbs */}
        <nav className="editorial-breadcrumbs" aria-label="breadcrumb">
          <ol className="editorial-breadcrumbs-list">
            <li className="editorial-breadcrumbs-item">
              <Link href="/">Civica</Link>
            </li>
            <li className="editorial-breadcrumbs-item">
              <Link href="/compare">Compare</Link>
            </li>
            <li className="editorial-breadcrumbs-item">
              <span aria-current="page">
                {isConditionsPage ? "Civica Conditions" : "Outcomes"}
              </span>
            </li>
          </ol>
        </nav>

        {/* Page heading — compact tool header (not the tall hero) */}
        <h1 className="editorial-tool-title">
          {isConditionsPage
            ? "Civica Conditions: how do material conditions vary across countries?"
            : "How government type relates to country outcomes"}
        </h1>

        {/* Dek */}
        <p className="editorial-tool-dek">
          {isConditionsPage
            ? "Material conditions — human development, peace & security, and economic stability — are separate from governance. These charts show how conditions vary across countries and government types. Government type is one filter among many: history, geography, and external factors all matter."
            : "These charts show how country outcomes vary across government types. Differences here reflect history, geography, wealth, and dozens of other factors — not just institutional design. Read these as patterns to investigate, not conclusions."}
        </p>

        <div
          style={{
            maxWidth: 760,
            border: "1px solid var(--color-card-border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-surface-elevated)",
            padding: "14px 16px",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--text-12)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--color-text-30)",
              marginBottom: 10,
            }}
          >
            Two taxonomy lenses
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
              gap: 14,
            }}
          >
            <TaxonomyGlossaryCard
              label="Structural form"
              title="Structural form: constitutional design, such as parliamentary republic, constitutional monarchy, or directorial republic."
              description="What the system is in constitutional terms."
            />
            <TaxonomyGlossaryCard
              label="Regime type"
              title="Regime type: executive-legislative accountability in the Bjornskov-Rode / CGV tradition."
              description="How executive accountability works."
            />
            <TaxonomyGlossaryCard
              label="Raw source"
              title="Raw source: the original CIA Factbook government-type wording kept for provenance."
              description="The original source label, preserved verbatim."
            />
          </div>
          <p
            style={{
              margin: "12px 0 0",
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-14)",
              color: "var(--color-text-50)",
              lineHeight: 1.55,
            }}
          >
            These labels are metadata only. They do not change CI weights or
            outcome values.
          </p>
        </div>

        {/* ── Controls ── */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "flex-start",
            marginBottom: 28,
          }}
        >
          {useSegmented ? (
            <div>
              <div
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"],
                  fontSize: "var(--text-12)",
                  letterSpacing: "var(--tracking-caps)",
                  textTransform: "uppercase",
                  color: "var(--color-text-30)",
                  marginBottom: 6,
                }}
              >
                Metric
              </div>
              <div
                role="group"
                aria-label="Select metric"
                style={{
                  display: "flex",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-card-border)",
                  overflow: "hidden",
                }}
              >
                {metrics.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleMetricChange(m.id)}
                    style={{
                      padding: "7px 14px",
                      background:
                        metricId === m.id
                          ? "var(--color-surface-elevated)"
                          : "transparent",
                      color:
                        metricId === m.id
                          ? "var(--color-text-primary)"
                          : "var(--color-text-50)",
                      border: "none",
                      borderRight: "1px solid var(--color-card-border)",
                      fontFamily: "var(--font-body-sans)",
                      fontSize: "var(--text-14)",
                      fontWeight: metricId === m.id ? 600 : 400,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div ref={metricMenuRef}>
              <SingleSelectMenu
                label="Metric"
                ariaLabel="Select metric"
                value={metricId}
                items={metricMenuItems}
                open={openMenu === "metric"}
                onOpenChange={(next) =>
                  setOpenMenu(next ? "metric" : null)
                }
                onSelect={handleMetricChange}
                minWidth={200}
              />
            </div>
          )}

          <div ref={yearMenuRef}>
            <SingleSelectMenu
              label="Year"
              ariaLabel="Select year"
              value={String(year)}
              items={yearMenuItems}
              open={openMenu === "year"}
              onOpenChange={(next) => setOpenMenu(next ? "year" : null)}
              onSelect={(value) => handleYearChange(parseInt(value, 10))}
              minWidth={130}
              tabularNums
            />
          </div>

          <div ref={lensMenuRef}>
            <SingleSelectMenu
              label="Lens"
              ariaLabel="Select taxonomy lens"
              value={taxonomy}
              items={lensMenuItems}
              open={openMenu === "lens"}
              onOpenChange={(next) => setOpenMenu(next ? "lens" : null)}
              onSelect={(value) =>
                handleTaxonomyChange(value as GovernmentTaxonomyLens)
              }
              minWidth={200}
            />
          </div>

          {availableGovTypes.length > 0 && (
            <div ref={govMenuRef}>
              <FilterMenu
                label="Government type"
                summary={selectedGovTypeSummary}
                open={openMenu === "government"}
                onToggle={() =>
                  setOpenMenu((current) =>
                    current === "government" ? null : "government",
                  )
                }
                onClear={clearGovTypes}
                items={availableGovTypes.map((govType) => ({
                  id: govType,
                  label: govType,
                  checked: selectedGovTypes.includes(govType),
                  onToggle: () => handleGovTypeToggle(govType),
                }))}
              />
            </div>
          )}

          <div ref={regionMenuRef}>
            <FilterMenu
              label="Region"
              summary={selectedRegionSummary}
              open={openMenu === "region"}
              onToggle={() =>
                setOpenMenu((current) =>
                  current === "region" ? null : "region",
                )
              }
              onClear={clearRegions}
              items={CONTINENTS.map((region) => ({
                id: region,
                label: region,
                checked: selectedRegions.includes(region),
                onToggle: () => handleRegionToggle(region),
              }))}
            />
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-14)",
              color: "var(--color-text-50)",
              padding: "7px 0",
            }}
          >
            <input
              type="checkbox"
              checked={smallMultiples}
              onChange={(e) => setSmallMultiples(e.target.checked)}
              style={{ accentColor: "var(--color-accent)", cursor: "pointer" }}
            />
            All metrics
          </label>
        </div>

        {/* ── Chart area ── */}
        <div
          style={{
            position: "relative",
            marginRight: selectedCountry && isDesktop ? 340 : 0,
            transition: "margin-right 200ms ease",
          }}
        >
          {smallMultiples ? (
            loadingAll ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isDesktop
                    ? "repeat(2, 1fr)"
                    : "1fr",
                  gap: 32,
                }}
              >
                {metrics.map((m) => (
                  <StripSkeleton key={m.id} />
                ))}
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isDesktop
                    ? "repeat(2, 1fr)"
                    : "1fr",
                  gap: 32,
                }}
              >
                {metrics.map((m) => {
                  const sd = allStripData[m.id];
                  if (!sd) return null;
                  return (
                    <div key={m.id}>
                      <div
                        style={{
                          fontFamily: "var(--font-body-sans)",
                          fontSize: "var(--text-13)",
                          fontWeight: 600,
                          color: "var(--color-text-50)",
                          letterSpacing: "var(--tracking-caps)",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        {m.name}
                      </div>
                      <div
                        style={{
                          transformOrigin: "top left",
                          transform: "scale(0.6)",
                          width: "calc(100% / 0.6)",
                          height: 0,
                          paddingBottom: "calc(100% / 0.6 * 0.5)",
                          position: "relative",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                          }}
                        >
                          <MetricStripPlot
                            data={sd.data}
                            govTypeBands={sd.govTypeBands}
                            metricDef={sd.metricDef}
                            year={year}
                            onCountryClick={(slug) =>
                              handleCountryClickInMultiple(m.id, slug)
                            }
                            coverage={sd.coverage}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : loading || !stripData ? (
            <StripSkeleton />
          ) : stripData && resolvedMetricDef ? (
            <MetricStripPlot
              data={stripData.data}
              govTypeBands={stripData.govTypeBands}
              metricDef={resolvedMetricDef}
              year={year}
              onCountryClick={handleCountryClick}
              coverage={stripData.coverage}
            />
          ) : (
            <StripSkeleton />
          )}
        </div>

        {/* ── Caption + source ── */}
        {!smallMultiples && stripData && resolvedMetricDef && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: "1px solid var(--color-divider)",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body-sans)",
                fontSize: "var(--text-13)",
                color: "var(--color-text-40)",
                lineHeight: "var(--leading-relaxed)",
                maxWidth: 560,
                margin: 0,
              }}
            >
              {resolvedMetricDef.description ??
                `${resolvedMetricDef.name} scores by government type, ${year}.`}
            </p>
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontWeight: "var(--font-weight-medium)" as React.CSSProperties["fontWeight"],
                fontSize: "var(--text-12)",
                color: "var(--color-text-25)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                margin: 0,
                alignSelf: "flex-end",
              }}
            >
              Source: {resolvedMetricDef.sourceName ?? resolvedMetricDef.name} · Civica
            </p>
          </div>
        )}

        {/* ── Methodology accordion ── */}
        <div
          style={{
            marginTop: 40,
            borderTop: "1px solid var(--color-divider)",
            paddingTop: 20,
          }}
        >
          <button
            type="button"
            onClick={() => setMethodologyOpen((o) => !o)}
            aria-expanded={methodologyOpen}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-14)",
              color: "var(--color-text-40)",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              textAlign: "left",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 150ms",
                transform: methodologyOpen ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▸
            </span>
            Methodology &amp; data notes
          </button>

          {methodologyOpen && (
            <div
              style={{
                marginTop: 16,
                paddingLeft: 20,
                fontFamily: "var(--font-body-sans)",
                fontSize: "var(--text-14)",
                color: "var(--color-text-50)",
                lineHeight: "var(--leading-relaxed)",
                maxWidth: 680,
              }}
            >
              <p style={{ marginBottom: 12 }}>
                Each dot represents one country. Dots are randomly jittered
                vertically within each row to reduce overplotting. The shaded
                band shows the interquartile range (Q1–Q3) for each government
                type group; the vertical tick marks the median.
              </p>
              <p style={{ marginBottom: 12 }}>
                Government type classifications follow the Civica taxonomy,
                derived from constitutional documents, IPU Parline, and
                Wikidata. Countries with fewer than 3 data points in a category
                are excluded from band calculations.
              </p>
              <p style={{ marginBottom: 12 }}>
                Data shown for the selected year uses the most recent available
                observation at or before that year. Observations more than 5
                years old are shown at reduced opacity and marked as stale.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Correlation ≠ causation.</strong> Outcome differences
                across government types may reflect confounding factors
                including GDP, geography, colonial history, and regional
                norms — not institutional design alone.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── Country detail panel ── */}
      {selectedCountry && (
        <DetailPanel
          detail={selectedCountry}
          onClose={() => setSelectedCountry(null)}
          isDesktop={isDesktop}
        />
      )}
    </>
  );
}

export default OutcomesExplorer;
