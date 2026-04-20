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
}

// ─── Strip data response ──────────────────────────────────────────────────────

interface StripDataResponse {
  data: StripDot[];
  govTypeBands: Record<string, GovTypeBand>;
  metricDef: MetricDef;
  coverage: { total: number; withData: number };
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

// ─── Chip ─────────────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: "var(--radius-sm)",
        border: active
          ? "1px solid var(--color-accent)"
          : "1px solid var(--color-card-border)",
        background: active ? "var(--color-accent-soft, color-mix(in oklab, var(--color-accent) 18%, transparent))" : "transparent",
        color: active ? "var(--color-accent)" : "var(--color-text-50)",
        fontFamily: "var(--font-body-sans)",
        fontSize: "var(--text-12)",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "border-color 120ms, background 120ms, color 120ms",
      }}
    >
      {label}
    </button>
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
        boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
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
        boxShadow: "0 -4px 24px rgba(0,0,0,0.3)",
        animation: "slideInUp 200ms ease",
      };

  return (
    <>
      {/* Backdrop for mobile */}
      {!isDesktop && (
        <div
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 99,
          }}
        />
      )}
      <div style={panelStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 16,
          }}
        >
          <h2
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
            fontSize: "var(--text-11)",
            color: "var(--color-text-50)",
            marginBottom: 20,
          }}
        >
          {detail.govType}
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
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
                  fontSize: "var(--text-13)",
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
              fontSize: "var(--text-12)",
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
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
              fontSize: "var(--text-12)",
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
          href={`/countries/${detail.slug}?tab=outcomes`}
          style={{
            display: "block",
            padding: "10px 16px",
            background: "var(--color-accent)",
            color: "var(--color-bg)",
            borderRadius: "var(--radius-sm)",
            fontFamily: "var(--font-body-sans)",
            fontSize: "var(--text-13)",
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
}: OutcomesExplorerProps) {
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
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [smallMultiples, setSmallMultiples] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

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

  const visibleChips = availableGovTypes.slice(0, 8);
  const overflowChips = availableGovTypes.slice(8);

  // ── URL sync ──
  const syncUrl = useCallback(
    (
      newMetric: string,
      newYear: number,
      newGovTypes: string[]
    ) => {
      const params = new URLSearchParams();
      params.set("metric", newMetric);
      params.set("year", String(newYear));
      if (newGovTypes.length > 0) {
        params.set("govTypes", newGovTypes.join(","));
      }
      startTransition(() => {
        router.replace(`/outcomes?${params.toString()}`, { scroll: false });
      });
    },
    [router]
  );

  // ── Fetch single metric strip data ──
  const fetchStripData = useCallback(
    async (
      mId: string,
      yr: number,
      govTypes: string[]
    ) => {
      setLoading(true);
      try {
        const govTypesParam =
          govTypes.length > 0
            ? `&govTypes=${encodeURIComponent(govTypes.join(","))}`
            : "";
        const res = await fetch(
          `/api/metrics/${mId}/strip-data?year=${yr}${govTypesParam}`
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
    async (yr: number, govTypes: string[]) => {
      setLoadingAll(true);
      try {
        const govTypesParam =
          govTypes.length > 0
            ? `&govTypes=${encodeURIComponent(govTypes.join(","))}`
            : "";
        const results = await Promise.allSettled(
          metrics.map((m) =>
            fetch(
              `/api/metrics/${m.id}/strip-data?year=${yr}${govTypesParam}`
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
    fetchStripData(metricId, year, selectedGovTypes);
  }, [metricId, year, selectedGovTypes, fetchStripData]);

  // Fetch all when small multiples enabled
  useEffect(() => {
    if (smallMultiples) {
      fetchAllStripData(year, selectedGovTypes);
    }
  }, [smallMultiples, year, selectedGovTypes, fetchAllStripData]);

  // Close overflow dropdown on outside click
  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        overflowRef.current &&
        !overflowRef.current.contains(e.target as Node)
      ) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [overflowOpen]);

  // ── Handlers ──

  const handleMetricChange = (id: string) => {
    setMetricId(id);
    const newMetric = metrics.find((m) => m.id === id);
    const newYear = newMetric?.latestYear ?? year;
    setYear(newYear);
    setSelectedGovTypes([]);
    setSelectedCountry(null);
    syncUrl(id, newYear, []);
  };

  const handleYearChange = (yr: number) => {
    setYear(yr);
    setSelectedCountry(null);
    syncUrl(metricId, yr, selectedGovTypes);
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
    syncUrl(metricId, year, next);
  };

  const handleRegionToggle = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
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

      <section
        style={{
          maxWidth: "var(--max-w-content)",
          margin: "0 auto",
          padding: `var(--spacing-content-top) var(--spacing-page-x) 80px`,
        }}
      >
        {/* Breadcrumb */}
        <nav
          aria-label="breadcrumb"
          style={{
            fontFamily: "var(--font-mono)",
            fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
            fontSize: "var(--text-11)",
            color: "var(--color-text-30)",
            letterSpacing: "var(--tracking-caps)",
            textTransform: "uppercase",
            marginBottom: 20,
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          <Link
            href="/"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            Civica
          </Link>
          <span>›</span>
          <Link
            href="/compare"
            style={{ color: "inherit", textDecoration: "none" }}
          >
            Compare
          </Link>
          <span>›</span>
          <span style={{ color: "var(--color-text-50)" }}>Outcomes</span>
        </nav>

        {/* Page heading */}
        <h1
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-44)",
            fontWeight: 400,
            color: "var(--color-text-primary)",
            lineHeight: "var(--leading-tight)",
            letterSpacing: "var(--tracking-tight)",
            marginBottom: 16,
          }}
        >
          How government type relates to country outcomes
        </h1>

        {/* Dek */}
        <p
          className="dek"
          style={{
            fontFamily: "var(--font-body-sans)",
            fontSize: "var(--text-16)",
            color: "var(--color-text-50)",
            lineHeight: "var(--leading-relaxed)",
            maxWidth: 680,
            marginBottom: 36,
          }}
        >
          These charts show how country outcomes vary across government types.
          Differences here reflect history, geography, wealth, and dozens of
          other factors — not just institutional design. Read these as patterns
          to investigate, not conclusions.
        </p>

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
          {/* Metric selector */}
          <div>
            {useSegmented ? (
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
                      fontSize: "var(--text-13)",
                      fontWeight: metricId === m.id ? 600 : 400,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            ) : (
              <select
                aria-label="Select metric"
                value={metricId}
                onChange={(e) => handleMetricChange(e.target.value)}
                style={{
                  padding: "7px 12px",
                  background: "var(--color-select-bg, var(--color-surface-elevated))",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-card-border)",
                  borderRadius: "var(--radius-sm)",
                  fontFamily: "var(--font-body-sans)",
                  fontSize: "var(--text-13)",
                  cursor: "pointer",
                  minWidth: 180,
                }}
              >
                {Array.from(categoryGroups.entries()).map(([cat, catMetrics]) => (
                  <optgroup key={cat} label={cat}>
                    {catMetrics.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
          </div>

          {/* Year dropdown */}
          <div>
            <select
              aria-label="Select year"
              value={year}
              onChange={(e) => handleYearChange(parseInt(e.target.value, 10))}
              style={{
                padding: "7px 12px",
                background: "var(--color-select-bg, var(--color-surface-elevated))",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-card-border)",
                borderRadius: "var(--radius-sm)",
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
                fontSize: "var(--text-13)",
                cursor: "pointer",
              }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Gov type chips */}
          {availableGovTypes.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                alignItems: "center",
              }}
            >
              <Chip
                label="All"
                active={selectedGovTypes.length === 0}
                onClick={() => handleGovTypeToggle("__all__")}
              />
              {visibleChips.map((g) => (
                <Chip
                  key={g}
                  label={g}
                  active={selectedGovTypes.includes(g)}
                  onClick={() => handleGovTypeToggle(g)}
                />
              ))}
              {overflowChips.length > 0 && (
                <div ref={overflowRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setOverflowOpen((o) => !o)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "4px 10px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--color-card-border)",
                      background: overflowOpen
                        ? "var(--color-surface-elevated)"
                        : "transparent",
                      color: "var(--color-text-50)",
                      fontFamily: "var(--font-body-sans)",
                      fontSize: "var(--text-12)",
                      cursor: "pointer",
                    }}
                  >
                    More ({overflowChips.length}) ▾
                  </button>
                  {overflowOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        zIndex: 50,
                        background: "var(--color-card-bg)",
                        border: "1px solid var(--color-card-border)",
                        borderRadius: "var(--radius-sm)",
                        boxShadow: "var(--shadow-dropdown)",
                        padding: "8px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                        minWidth: 180,
                      }}
                    >
                      {overflowChips.map((g) => (
                        <Chip
                          key={g}
                          label={g}
                          active={selectedGovTypes.includes(g)}
                          onClick={() => {
                            handleGovTypeToggle(g);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Small multiples toggle */}
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-13)",
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

        {/* More filters (region) */}
        <div style={{ marginBottom: 24 }}>
          <button
            type="button"
            onClick={() => setMoreFiltersOpen((o) => !o)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-body-sans)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-40)",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 150ms",
                transform: moreFiltersOpen ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▸
            </span>
            {moreFiltersOpen ? "Fewer filters" : "More filters (region)"}
          </button>

          {moreFiltersOpen && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 10,
              }}
            >
              {CONTINENTS.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  active={selectedRegions.includes(c)}
                  onClick={() => handleRegionToggle(c)}
                />
              ))}
            </div>
          )}
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
                          fontSize: "var(--text-12)",
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
          ) : (
            <MetricStripPlot
              data={stripData.data}
              govTypeBands={stripData.govTypeBands}
              metricDef={stripData.metricDef}
              year={year}
              onCountryClick={handleCountryClick}
              coverage={stripData.coverage}
            />
          )}
        </div>

        {/* ── Caption + source ── */}
        {!smallMultiples && stripData && (
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
                fontSize: "var(--text-12)",
                color: "var(--color-text-40)",
                lineHeight: "var(--leading-relaxed)",
                maxWidth: 560,
                margin: 0,
              }}
            >
              {stripData.metricDef.description ??
                `${stripData.metricDef.name} scores by government type, ${year}.`}
            </p>
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontWeight: "var(--font-weight-mono)" as React.CSSProperties["fontWeight"],
                fontSize: "var(--text-10)",
                color: "var(--color-text-25)",
                letterSpacing: "var(--tracking-caps)",
                textTransform: "uppercase",
                margin: 0,
                alignSelf: "flex-end",
              }}
            >
              Source: {stripData.metricDef.sourceName ?? stripData.metricDef.name} · Civica
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
              fontSize: "var(--text-13)",
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
                fontSize: "var(--text-13)",
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
