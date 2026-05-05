"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Country } from "./data";
import { type MapPath, MAP_W, MAP_H } from "./map-geom";

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
        labelsRef.current.style.fontSize = `${11 / t.k}px`;
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
            {/* Country paths */}
            {mapPaths.map((p, i) => (
              <path
                key={i}
                d={p.d}
                fill={p.country ? "var(--atlas-land)" : "var(--atlas-land-dim)"}
                stroke="var(--atlas-ink)"
                strokeWidth={p.country ? "0.8" : "0.5"}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                data-id={p.id || undefined}
                data-iso={p.neId}
                style={{
                  cursor: p.country ? "pointer" : "default",
                  opacity: p.country
                    ? filteredCountryIds.includes(p.id!)
                      ? 1
                      : 0.25
                    : 0.55,
                  transition: "fill 120ms, opacity 200ms",
                }}
                onMouseEnter={(e) => {
                  if (p.country) {
                    (e.target as SVGPathElement).setAttribute(
                      "fill",
                      "var(--atlas-land-hover)",
                    );
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
                    const sel = (e.target as SVGPathElement).getAttribute(
                      "data-selected",
                    );
                    if (sel !== "1")
                      (e.target as SVGPathElement).setAttribute(
                        "fill",
                        "var(--atlas-land)",
                      );
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
            ))}
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
                      letterSpacing="1.5"
                      fill="var(--atlas-ink)"
                      opacity={tier === 1 ? 0.8 : 0.6}
                      style={{ pointerEvents: "none" }}
                    >
                      {p.id!.toUpperCase()}
                    </text>
                  );
                })}
            </g>
          </g>
        </svg>

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
                  <span className="x" onClick={() => onUnpinAt(i)}>
                    &times;
                  </span>
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
              Open compare &nearr;
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
              <span style={{ fontSize: 11 }}>&lceil;</span>
            </button>
          </div>
        </div>

        {/* Hover card */}
        {hoverCard && (
          <div
            className="atlas-hover-card"
            style={{ left: hoverCard.x, top: hoverCard.y }}
          >
            <div className="hc-top">
              <h3>{hoverCard.country.name}</h3>
              <span className="hc-code">
                {hoverCard.country.id.toUpperCase()}
              </span>
            </div>
            <div className="hc-row hc-row--government">
              <b>Government</b>
              <span className="hc-row-value">{hoverCard.country.gov}</span>
              {hoverCard.country.govDetail && (
                <span className="hc-row-detail">
                  {hoverCard.country.govDetail}
                </span>
              )}
            </div>
            <div className="hc-row">
              <b>Capital</b>
              <span>{hoverCard.country.capital}</span>
            </div>
            <div className="hc-row">
              <b>Pop.</b>
              <span>{hoverCard.country.pop}</span>
            </div>
            <div className="hc-row">
              <b>GDP</b>
              <span>{hoverCard.country.gdp}</span>
            </div>
            <div className="hc-leader">
              <span className="r">Head of government</span>
              <br />
              {hoverCard.country.leader}
            </div>
            <div className="hc-cta">
              Click &rarr; walk into the chamber &nearr;
            </div>
          </div>
        )}
      </>
    );
  },
);
