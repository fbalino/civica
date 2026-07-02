"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { RotateCcw } from "lucide-react";
import type { Country } from "./data";
import { type MapPath, MAP_W, MAP_H } from "./map-geom";
import { CountryHoverCard } from "@/components/v2/CountryHoverCard";
import { SegmentedControl } from "@/components/editorial/SegmentedControl";
import type { AtlasLayerValues } from "@/lib/atlas/load-atlas-data";
import {
  type AtlasLayerKey,
  ATLAS_LAYER_OPTIONS,
  ATLAS_LAYER_TITLE,
  NO_DATA_FILL,
  NO_DATA_LABEL,
  fillForLayer,
  legendFor,
  tooltipValueForLayer,
} from "@/lib/atlas/map-layers";

/* ----------------------------------------------------------------
 * Choropleth layer switcher (Wave 6)
 *
 * The map colors every country by one of four CATEGORICAL data layers —
 * government type, Civica Index tier, V-Dem regime, or World Bank income
 * group. The active `layer` is controlled by the parent (URL `?layer=`);
 * all color-token + legend + tooltip logic lives in
 * `src/lib/atlas/map-layers.ts` so it stays in one documented place.
 * ---------------------------------------------------------------- */

export interface AtlasWorldMapHandle {
  flyTo: (id: string) => void;
  reset: () => void;
}

export interface AtlasWorldMapProps {
  countries: Country[];
  mapPaths: MapPath[];
  mapLoaded: boolean;
  /** IDs matching the current search/region/gov filter. Non-matching countries render at opacity 0.25. */
  filteredCountryIds: string[];
  /** Per-iso3 (lower-case) data-layer values fetched server-side — no client DB access. */
  layerData: Record<string, AtlasLayerValues>;
  /** The active choropleth layer (owned by the parent; synced to `?layer=`). */
  layer: AtlasLayerKey;
  /** Switch the active layer (parent updates state + URL). */
  onLayerChange: (layer: AtlasLayerKey) => void;
  /** Country IDs pinned for compare (up to 2). Shows the compare banner. */
  pinned: string[];
  /** Called when a country path is clicked; `shift` mirrors e.shiftKey so the caller can route to pin vs open. */
  onCountrySelect: (country: Country, modifiers: { shift: boolean }) => void;
  /** Remove the pinned country at index i. */
  onUnpinAt: (index: number) => void;
  /** Transition into the compare view with the two pinned countries. */
  onOpenCompare: () => void;
}

export const AtlasWorldMap = forwardRef<AtlasWorldMapHandle, AtlasWorldMapProps>(
  function AtlasWorldMap(
    {
      countries,
      mapPaths,
      mapLoaded,
      filteredCountryIds,
      layerData,
      layer,
      onLayerChange,
      pinned,
      onCountrySelect,
      onUnpinAt,
      onOpenCompare,
    },
    ref,
  ) {
    const svgRef = useRef<SVGSVGElement>(null);
    const contentRef = useRef<SVGGElement>(null);
    const labelsRef = useRef<SVGGElement>(null);
    const transformRef = useRef({ k: 1, x: 0, y: 0 });
    const dragRef = useRef({
      dragging: false,
      startX: 0,
      startY: 0,
      originX: 0,
      originY: 0,
    });
    const touchRef = useRef({ lastDist: 0, lastX: 0, lastY: 0, touches: 0 });

    const [hoverCard, setHoverCard] = useState<{
      country: Country;
      x: number;
      y: number;
    } | null>(null);

    // Legend rows for the active layer, plus a trailing "No data" row when
    // at least one mapped country falls back to the neutral no-data fill —
    // a country with a missing value must never inherit a real category.
    const legendEntries = useMemo(() => legendFor(layer), [layer]);
    const hasNoDataCountry = useMemo(
      () =>
        countries.some(
          (c) => fillForLayer(layer, c, layerData[c.id]) === NO_DATA_FILL,
        ),
      [layer, countries, layerData],
    );

    const applyTransform = useCallback(() => {
      const t = transformRef.current;
      if (contentRef.current) {
        contentRef.current.setAttribute(
          "transform",
          `translate(${t.x},${t.y}) scale(${t.k})`,
        );
      }
      if (labelsRef.current) {
        const tier = t.k >= 4.5 ? 3 : t.k >= 2.5 ? 2 : 1;
        labelsRef.current.setAttribute("data-zoom-tier", String(tier));
        labelsRef.current.style.fontSize = `${12.5 / t.k}px`;
        // The label halo (stroke, set in atlas.css) must counter-scale with
        // zoom like the font does — a fixed stroke-width grows k× when the
        // <g> scales and swallows the letterforms.
        labelsRef.current.style.strokeWidth = `${1.75 / t.k}px`;
      }
    }, []);

    const zoomAround = useCallback(
      (cx: number, cy: number, factor: number) => {
        const t = transformRef.current;
        const prevK = t.k;
        const nextK = Math.max(0.8, Math.min(12, prevK * factor));
        const scale = nextK / prevK;
        t.x = cx - (cx - t.x) * scale;
        t.y = cy - (cy - t.y) * scale;
        t.k = nextK;
        applyTransform();
      },
      [applyTransform],
    );

    const animateTo = useCallback(
      (tx: number, ty: number, tk: number) => {
        const start = { ...transformRef.current };
        const end = { x: tx, y: ty, k: tk };
        const t0 = performance.now();
        const DUR = 650;
        function frame(now: number) {
          const t = Math.min(1, (now - t0) / DUR);
          const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          transformRef.current.x = start.x + (end.x - start.x) * e;
          transformRef.current.y = start.y + (end.y - start.y) * e;
          transformRef.current.k = start.k + (end.k - start.k) * e;
          applyTransform();
          if (t < 1) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      },
      [applyTransform],
    );

    const flyTo = useCallback(
      (id: string) => {
        const path = contentRef.current?.querySelector(
          `path[data-id="${id}"]`,
        ) as SVGPathElement | null;
        if (!path) return;
        const bb = path.getBBox();
        const cx = bb.x + bb.width / 2;
        const cy = bb.y + bb.height / 2;
        const pad = 2.2;
        const k = Math.min(
          8,
          Math.min(MAP_W / (bb.width * pad), MAP_H / (bb.height * pad)),
        );
        animateTo(MAP_W / 2 - cx * k, MAP_H / 2 - cy * k, k);
      },
      [animateTo],
    );

    useImperativeHandle(
      ref,
      () => ({
        flyTo,
        reset: () => animateTo(0, 0, 1),
      }),
      [flyTo, animateTo],
    );

    useEffect(() => {
      const onMove = (e: MouseEvent) => {
        const d = dragRef.current;
        if (!d.dragging) return;
        transformRef.current.x = d.originX + (e.clientX - d.startX);
        transformRef.current.y = d.originY + (e.clientY - d.startY);
        applyTransform();
      };
      const onUp = () => {
        dragRef.current.dragging = false;
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      return () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
    }, [applyTransform]);

    // Wheel listener must be registered with {passive:false} so we can call
    // preventDefault — React's synthetic handler forces passive:true.
    useEffect(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const handler = (e: WheelEvent) => {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const svgX = ((e.clientX - rect.left) / rect.width) * MAP_W;
        const svgY = ((e.clientY - rect.top) / rect.height) * MAP_H;
        zoomAround(svgX, svgY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
      };
      svg.addEventListener("wheel", handler, { passive: false });
      return () => svg.removeEventListener("wheel", handler);
    }, [zoomAround, mapLoaded]);

    useEffect(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const onTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          touchRef.current = {
            lastDist: 0,
            lastX: e.touches[0].clientX,
            lastY: e.touches[0].clientY,
            touches: 1,
          };
        } else if (e.touches.length === 2) {
          e.preventDefault();
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          touchRef.current = {
            lastDist: Math.hypot(dx, dy),
            lastX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
            lastY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
            touches: 2,
          };
        }
      };
      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const t = touchRef.current;
        if (e.touches.length === 1 && t.touches === 1) {
          const dx = e.touches[0].clientX - t.lastX;
          const dy = e.touches[0].clientY - t.lastY;
          transformRef.current.x += dx;
          transformRef.current.y += dy;
          applyTransform();
          t.lastX = e.touches[0].clientX;
          t.lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          const dist = Math.hypot(dx, dy);
          const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
          const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
          if (t.lastDist > 0) {
            const rect = svg.getBoundingClientRect();
            const svgX = ((midX - rect.left) / rect.width) * MAP_W;
            const svgY = ((midY - rect.top) / rect.height) * MAP_H;
            zoomAround(svgX, svgY, dist / t.lastDist);
          }
          t.lastDist = dist;
          t.lastX = midX;
          t.lastY = midY;
          t.touches = 2;
        }
      };
      const onTouchEnd = (e: TouchEvent) => {
        if (e.touches.length < 2) touchRef.current.touches = e.touches.length;
      };
      svg.addEventListener("touchstart", onTouchStart, { passive: false });
      svg.addEventListener("touchmove", onTouchMove, { passive: false });
      svg.addEventListener("touchend", onTouchEnd);
      return () => {
        svg.removeEventListener("touchstart", onTouchStart);
        svg.removeEventListener("touchmove", onTouchMove);
        svg.removeEventListener("touchend", onTouchEnd);
      };
    }, [applyTransform, zoomAround, mapLoaded]);

    function handleSvgMouseDown(e: React.MouseEvent) {
      if (
        (e.target as Element).tagName === "path" &&
        (e.target as Element).getAttribute("data-id")
      )
        return;
      dragRef.current = {
        dragging: true,
        startX: e.clientX,
        startY: e.clientY,
        originX: transformRef.current.x,
        originY: transformRef.current.y,
      };
    }

    return (
      <>
        <svg
          ref={svgRef}
          className="world-map"
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label={`World map colored by ${ATLAS_LAYER_TITLE[layer]}`}
          onMouseDown={handleSvgMouseDown}
        >
          <defs>
            <pattern
              id="dots"
              x="0"
              y="0"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="1"
                cy="1"
                r="0.6"
                fill="var(--atlas-muted)"
                opacity="0.18"
              />
            </pattern>
          </defs>
          <g ref={contentRef} id="mapContent">
            <rect
              x="-1000"
              y="-500"
              width="4000"
              height="2000"
              fill="url(#dots)"
            />
            {/* Graticule */}
            <g stroke="var(--atlas-rule-2)" strokeWidth="1" fill="none">
              {Array.from({ length: 9 }, (_, i) => (
                <line
                  key={`h${i}`}
                  x1={0}
                  x2={MAP_W}
                  y1={(i + 1) * 100}
                  y2={(i + 1) * 100}
                  strokeDasharray="2 6"
                />
              ))}
              {Array.from({ length: 9 }, (_, i) => (
                <line
                  key={`v${i}`}
                  x1={(i + 1) * 200}
                  x2={(i + 1) * 200}
                  y1={0}
                  y2={MAP_H}
                  strokeDasharray="2 6"
                />
              ))}
            </g>
            {/* Country paths — categorical choropleth driven by the active
                data layer (government / CI tier / regime / income). Hover
                signals via stroke change instead of fill so the layer color
                stays visible while the cursor is over. */}
            {mapPaths.map((p, i) => {
              const baseFill = p.country
                ? fillForLayer(layer, p.country, layerData[p.country.id])
                : NO_DATA_FILL;
              return (
                <path
                  key={i}
                  d={p.d}
                  fill={baseFill}
                  stroke="var(--atlas-ink)"
                  strokeWidth={p.country ? "0.8" : "0.5"}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  data-id={p.id || undefined}
                  data-iso={p.neId}
                  data-base-fill={baseFill}
                  style={{
                    cursor: p.country ? "pointer" : "default",
                    opacity: p.country
                      ? filteredCountryIds.includes(p.id!)
                        ? 1
                        : 0.25
                      : 0.55,
                    transition: "stroke-width 120ms, filter 120ms, opacity 200ms",
                  }}
                  onMouseEnter={(e) => {
                    if (p.country) {
                      const el = e.target as SVGPathElement;
                      el.style.strokeWidth = "2";
                      el.style.filter = "brightness(0.92)";
                      setHoverCard({
                        country: p.country,
                        x: e.clientX + 14,
                        y: e.clientY + 14,
                      });
                    }
                  }}
                  onMouseMove={(e) => {
                    if (p.country)
                      setHoverCard((prev) =>
                        prev
                          ? { ...prev, x: e.clientX + 14, y: e.clientY + 14 }
                          : null,
                      );
                  }}
                  onMouseLeave={(e) => {
                    if (p.country) {
                      const el = e.target as SVGPathElement;
                      const sel = el.getAttribute("data-selected");
                      if (sel !== "1") {
                        el.style.strokeWidth = "";
                        el.style.filter = "";
                      }
                      setHoverCard(null);
                    }
                  }}
                  onClick={(e) => {
                    if (p.country) {
                      e.stopPropagation();
                      onCountrySelect(p.country, { shift: e.shiftKey });
                    }
                  }}
                />
              );
            })}
            {/* Country labels — visibility controlled by zoom tier via CSS */}
            <g ref={labelsRef} className="map-labels" data-zoom-tier="1">
              {mapPaths
                .filter((p) => p.country && p.id)
                .map((p) => {
                  const tier = p.area > 300 ? 1 : p.area > 30 ? 2 : 3;
                  return (
                    <text
                      key={`lbl-${p.id}`}
                      x={p.centroid[0]}
                      y={p.centroid[1]}
                      data-tier={tier}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontFamily="var(--font-mono)"
                      fontWeight={600}
                      letterSpacing="1"
                      // fill + halo come from .map-labels (theme-independent
                      // white-on-dark-halo tokens — readable over any data fill).
                      opacity={1}
                      style={{ pointerEvents: "none" }}
                    >
                      {p.id!.toUpperCase()}
                    </text>
                  );
                })}
            </g>
          </g>
        </svg>

        {/* Layer switcher — top-left of the map, where the indicator
            furniture sits. The SegmentedControl picks which categorical
            data layer colours the choropleth; the legend below switches
            with the active layer. */}
        <div className="atlas-indicator">
          <SegmentedControl<AtlasLayerKey>
            value={layer}
            options={ATLAS_LAYER_OPTIONS}
            onChange={onLayerChange}
            ariaLabel="Map data layer"
            className="atlas-layer-switcher"
          />

          <div className="atlas-indicator-legend">
            <span className="atlas-indicator-legend__title">
              {ATLAS_LAYER_TITLE[layer]}
            </span>
            <ul
              className="atlas-indicator-legend__list"
              aria-label={`${ATLAS_LAYER_TITLE[layer]} legend`}
            >
              {legendEntries.map((entry) => (
                <li key={entry.label} className="atlas-indicator-legend__bin">
                  <span
                    className="atlas-indicator-legend__chip"
                    style={{ backgroundColor: entry.fill }}
                    aria-hidden
                  />
                  <span className="atlas-indicator-legend__lbl">
                    {entry.label}
                  </span>
                </li>
              ))}
              {hasNoDataCountry && (
                <li className="atlas-indicator-legend__bin">
                  <span
                    className="atlas-indicator-legend__chip"
                    style={{ backgroundColor: NO_DATA_FILL }}
                    aria-hidden
                  />
                  <span className="atlas-indicator-legend__lbl">
                    {NO_DATA_LABEL}
                  </span>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Compare banner */}
        {pinned.length > 0 && (
          <div className="atlas-compare-banner">
            <span>Compare:</span>
            {[0, 1].map((i) => (
              <span key={i} className="pill">
                {pinned[i]
                  ? countries.find((c) => c.id === pinned[i])?.name || "—"
                  : "—"}
                {pinned[i] && (
                  <button
                    type="button"
                    className="x"
                    aria-label={`Remove ${
                      countries.find((c) => c.id === pinned[i])?.name ?? "country"
                    } from comparison`}
                    onClick={() => onUnpinAt(i)}
                  >
                    &times;
                  </button>
                )}
              </span>
            ))}
            <button
              className="go-btn"
              onClick={() => {
                if (pinned.length < 2) return;
                onOpenCompare();
              }}
            >
              Open compare ↗
            </button>
          </div>
        )}

        {/* HUD bottom */}
        <div className="atlas-hud-bottom">
          <div className="atlas-hints">
            <div className="cta cta--desktop">
              <span className="k">Drag</span> to pan &middot;{" "}
              <span className="k">Scroll</span> to zoom &middot;{" "}
              <span className="k">Click</span> a country &middot;{" "}
              <span className="k">Shift-click</span> to compare
            </div>
            <div className="cta cta--mobile">
              <span className="k">Pinch</span> to zoom &middot;{" "}
              <span className="k">Tap</span> a country &middot;{" "}
              <span className="k">Tap two</span> to compare
            </div>
          </div>
          <div className="atlas-zoombar">
            <button onClick={() => zoomAround(MAP_W / 2, MAP_H / 2, 1.3)}>
              +
            </button>
            <button onClick={() => zoomAround(MAP_W / 2, MAP_H / 2, 1 / 1.3)}>
              &minus;
            </button>
            <button title="Reset" onClick={() => animateTo(0, 0, 1)}>
              <RotateCcw size={15} aria-hidden />
            </button>
          </div>
        </div>

        {/* v2 hover card — pinned near the cursor.
            Maps Country fields onto the v2 stat trio. The country engraving
            (/engravings/countries/<iso3>.webp) is shown as a small banner at
            the top of the card; CountryHoverCard hides it on a 404. The card
            stays light enough to track the cursor (plain lazy <img>). */}
        {hoverCard && (
          <div
            style={{
              position: "fixed",
              left: hoverCard.x,
              top: hoverCard.y,
              zIndex: 60,
              pointerEvents: "none",
              width: 360,
            }}
          >
            <CountryHoverCard
              name={hoverCard.country.name}
              officialName={hoverCard.country.govDetail || hoverCard.country.gov}
              iso2={hoverCard.country.iso2 ?? hoverCard.country.id.slice(0, 2)}
              heroImageUrl={`/engravings/countries/${hoverCard.country.id.toLowerCase()}.webp`}
              heroImageDarkUrl={`/engravings/countries/${hoverCard.country.id.toLowerCase()}-dark.webp`}
              stats={[
                {
                  // First stat tracks the active layer so the hover always
                  // explains the color under the cursor. (The card's
                  // officialName line still carries the full government
                  // description.)
                  label: ATLAS_LAYER_TITLE[layer],
                  value: tooltipValueForLayer(
                    layer,
                    hoverCard.country,
                    layerData[hoverCard.country.id],
                  ),
                },
                { label: "Capital", value: hoverCard.country.capital },
                { label: "Population", value: hoverCard.country.pop },
              ]}
              ctaHref={`/country/${hoverCard.country.slug ?? hoverCard.country.id}`}
            />
          </div>
        )}
      </>
    );
  },
);
