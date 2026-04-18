"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { type Country, type ChamberData, type Bill, COUNTRIES as FALLBACK_COUNTRIES, CHAMBERS as FALLBACK_CHAMBERS, WORLD_PATHS, NE_ID_TO_OURS as FALLBACK_NE_MAP, PARTY_COLORS, getDefaultChamberData as getFallbackChamberData, govDescription, getMember } from "./data";
import { Hemicycle, PartyLegend } from "./Hemicycle";
import type { AtlasCountry, AtlasChamberData } from "@/lib/atlas/load-atlas-data";

type Mode = "atlas" | "chamber" | "compare";
type Tab = "chamber" | "bills" | "structure";
type House = "lower" | "upper";

interface ChatMessage {
  role: "ai" | "user";
  text: string;
  lead?: string;
  cite?: string;
}

// ISO 3166-1 numeric to alpha-3 mapping for linking TopoJSON to DB data
const ISO_NUMERIC_TO_ALPHA3: Record<string, string> = {
  "004":"afg","008":"alb","012":"dza","020":"and","024":"ago","028":"atg","032":"arg",
  "036":"aus","040":"aut","044":"bhs","048":"bhr","050":"bgd","051":"arm","052":"brb",
  "056":"bel","064":"btn","068":"bol","070":"bih","072":"bwa","076":"bra","084":"blz",
  "090":"slb","096":"brn","100":"bgr","104":"mmr","108":"bdi","116":"khm","120":"cmr",
  "124":"can","140":"caf","144":"lka","148":"tcd","152":"chl","156":"chn","170":"col",
  "174":"com","178":"cog","180":"cod","188":"cri","191":"hrv","192":"cub","196":"cyp",
  "203":"cze","204":"ben","208":"dnk","214":"dom","218":"ecu","222":"slv","226":"gnq",
  "231":"eth","232":"eri","233":"est","242":"fji","246":"fin","250":"fra","258":"pfu",
  "262":"dji","266":"gab","268":"geo","270":"gmb","275":"pse","276":"deu","288":"gha",
  "296":"kir","300":"grc","308":"grd","320":"gtm","324":"gin","328":"guy","332":"hti",
  "340":"hnd","348":"hun","352":"isl","356":"ind","360":"idn","364":"irn","368":"irq",
  "372":"irl","376":"isr","380":"ita","384":"civ","388":"jam","392":"jpn","398":"kaz",
  "400":"jor","404":"ken","408":"prk","410":"kor","414":"kwt","417":"kgz","418":"lao",
  "422":"lbn","426":"lso","428":"lva","430":"lbr","434":"lby","440":"ltu","442":"lux",
  "450":"mdg","454":"mwi","458":"mys","462":"mdv","466":"mli","470":"mlt","478":"mrt",
  "480":"mus","484":"mex","496":"mng","498":"mda","499":"mne","504":"mar","508":"moz",
  "512":"omn","516":"nam","520":"nru","524":"npl","528":"nld","540":"ncl","554":"nzl",
  "558":"nic","562":"ner","566":"nga","578":"nor","586":"pak","591":"pan","598":"png",
  "600":"pry","604":"per","608":"phl","616":"pol","620":"prt","626":"tls","634":"qat",
  "642":"rou","643":"rus","646":"rwa","682":"sau","686":"sen","688":"srb","694":"sle",
  "702":"sgp","703":"svk","704":"vnm","705":"svn","706":"som","710":"zaf","716":"zwe",
  "724":"esp","728":"ssd","729":"sdn","740":"sur","748":"swz","752":"swe","756":"che",
  "760":"syr","762":"tjk","764":"tha","768":"tgo","776":"ton","780":"tto","784":"are",
  "788":"tun","792":"tur","795":"tkm","800":"uga","804":"ukr","807":"mkd","818":"egy",
  "826":"gbr","834":"tza","840":"usa","854":"bfa","858":"ury","860":"uzb","862":"ven",
  "887":"yem","894":"zmb",
};

interface AtlasAppProps {
  dbCountries?: AtlasCountry[];
  dbChambers?: Record<string, AtlasChamberData>;
}

export default function AtlasApp({ dbCountries, dbChambers }: AtlasAppProps) {
  const COUNTRIES: Country[] = useMemo(() => {
    if (!dbCountries || dbCountries.length === 0) return FALLBACK_COUNTRIES;
    return dbCountries.map((c) => ({
      id: c.id,
      name: c.name,
      leader: c.leader,
      gov: c.gov,
      region: c.region,
      pop: c.pop,
      gdp: c.gdp,
      capital: c.capital,
      featured: c.featured,
    }));
  }, [dbCountries]);

  const NE_ID_TO_OURS: Record<string, string> = useMemo(() => {
    if (!dbCountries || dbCountries.length === 0) return FALLBACK_NE_MAP;
    const countryIds = new Set(COUNTRIES.map((c) => c.id));
    const map: Record<string, string> = {};
    for (const [numericId, alpha3] of Object.entries(ISO_NUMERIC_TO_ALPHA3)) {
      if (countryIds.has(alpha3)) {
        map[numericId] = alpha3;
      }
    }
    return map;
  }, [dbCountries, COUNTRIES]);

  function getDefaultChamberData(id: string): ChamberData {
    if (dbChambers && dbChambers[id]) {
      const dc = dbChambers[id];
      return {
        lower: { ...dc.lower, parties: dc.lower.parties.length > 0 ? dc.lower.parties : [{ id: "unk", name: "Unknown", seats: dc.lower.total || 1, color: "gray" }] },
        upper: dc.upper ? { ...dc.upper, parties: dc.upper.parties.length > 0 ? dc.upper.parties : [{ id: "unk", name: "Unknown", seats: dc.upper.total || 1, color: "gray" }] } : null,
        branches: dc.branches,
        coalition: undefined,
        next: undefined,
        bills: [],
      };
    }
    return getFallbackChamberData(id);
  }
  const [mode, setMode] = useState<Mode>("atlas");
  const [country, setCountry] = useState<Country | null>(null);
  const [house, setHouse] = useState<House>("lower");
  const [tab, setTab] = useState<Tab>("chamber");
  const [dimmed, setDimmed] = useState<Set<string>>(new Set());
  const [pinned, setPinned] = useState<string[]>([]);
  const [compareA, setCompareA] = useState<string>("fra");
  const [compareB, setCompareB] = useState<string>("usa");
  const [compareHouseA, setCompareHouseA] = useState<House>("lower");
  const [compareHouseB, setCompareHouseB] = useState<House>("lower");
  const [pinMode, setPinMode] = useState(false);
  const [hoverCard, setHoverCard] = useState<{ country: Country; x: number; y: number } | null>(null);
  const [seatTip, setSeatTip] = useState<{ member: { name: string; district: string }; party: { name: string }; index: number; x: number; y: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [govFilter, setGovFilter] = useState("all");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: "ai", text: "I'm **Civica**. I can explain bills in plain language, compare countries, or walk you through any chamber. What do you want to know?" },
  ]);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);
  const transformRef = useRef({ k: 1, x: 0, y: 0 });
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number; originX: number; originY: number }>({ dragging: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapPaths, setMapPaths] = useState<Array<{ d: string; id: string | null; country: Country | null; neId: string }>>([]);
  const [leftW, setLeftW] = useState(300);
  const [rightW, setRightW] = useState(380);
  const resizerRef = useRef<{ side: "left" | "right"; startX: number; startW: number } | null>(null);
  const atlasRootRef = useRef<HTMLDivElement>(null);

  const W = 2000, H = 1000;
  const LAT_MIN = -58, LAT_MAX = 85;

  function proj(lon: number, lat: number): [number, number] {
    const x = ((lon + 180) / 360) * W;
    const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
    return [x, y];
  }

  function geomToPath(geom: { type: string; coordinates: number[][][][] | number[][][] }): string {
    const rings = geom.type === "Polygon" ? [geom.coordinates as number[][][]] : (geom.coordinates as number[][][][]);
    let d = "";
    for (const poly of rings) {
      for (const ring of poly) {
        const pts = ring as number[][];
        let prevLon: number | null = null;
        pts.forEach((pt, i) => {
          const lon = pt[0], lat = pt[1];
          const [x, y] = proj(lon, lat);
          const crossesAntimeridian = prevLon !== null && Math.abs(lon - prevLon) > 180;
          if (i === 0 || crossesAntimeridian) {
            d += "M" + x.toFixed(1) + "," + y.toFixed(1);
          } else {
            d += "L" + x.toFixed(1) + "," + y.toFixed(1);
          }
          prevLon = lon;
        });
      }
    }
    return d;
  }

  function geomCentroid(geom: { type: string; coordinates: number[][][][] | number[][][] }): [number, number] {
    const rings = geom.type === "Polygon" ? [geom.coordinates as number[][][]] : (geom.coordinates as number[][][][]);
    let best: number[][] | null = null, bestArea = 0;
    for (const poly of rings) {
      const ring = poly[0] as number[][];
      const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
      const w = Math.max(...xs) - Math.min(...xs);
      const h = Math.max(...ys) - Math.min(...ys);
      if (w * h > bestArea) { bestArea = w * h; best = ring; }
    }
    if (!best) return [0, 0];
    let sx = 0, sy = 0;
    best.forEach((p) => { sx += p[0]; sy += p[1]; });
    return proj(sx / best.length, sy / best.length);
  }

  // Load TopoJSON world data
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/topojson-client@3.1.0/dist/topojson-client.min.js";
        await new Promise<void>((resolve, reject) => {
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
        const resp = await fetch("https://unpkg.com/world-atlas@2.0.2/countries-110m.json");
        const topo = await resp.json();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const geo = (window as any).topojson.feature(topo, topo.objects.countries);
        if (cancelled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const paths = geo.features.map((f: any) => {
          const neId = String(f.id).padStart(3, "0");
          const ourId = NE_ID_TO_OURS[neId] || null;
          const c = ourId ? COUNTRIES.find((c) => c.id === ourId) || null : null;
          return { d: geomToPath(f.geometry), id: ourId, country: c, neId };
        });
        setMapPaths(paths);
        setMapLoaded(true);
      } catch {
        // Fallback to stylized paths
        const paths = Object.entries(WORLD_PATHS).map(([id, data]) => {
          const c = COUNTRIES.find((c) => c.id === id) || null;
          return { d: data.d, id, country: c, neId: "" };
        });
        if (!cancelled) { setMapPaths(paths); setMapLoaded(true); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Pan & zoom
  const applyTransform = useCallback(() => {
    if (contentRef.current) {
      const t = transformRef.current;
      contentRef.current.setAttribute("transform", `translate(${t.x},${t.y}) scale(${t.k})`);
    }
  }, []);

  const zoomAround = useCallback((cx: number, cy: number, factor: number) => {
    const t = transformRef.current;
    const prevK = t.k;
    const nextK = Math.max(0.8, Math.min(12, prevK * factor));
    const scale = nextK / prevK;
    t.x = cx - (cx - t.x) * scale;
    t.y = cy - (cy - t.y) * scale;
    t.k = nextK;
    applyTransform();
  }, [applyTransform]);

  const animateTo = useCallback((tx: number, ty: number, tk: number) => {
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
  }, [applyTransform]);

  const flyTo = useCallback((id: string) => {
    const path = contentRef.current?.querySelector(`path[data-id="${id}"]`) as SVGPathElement | null;
    if (!path) return;
    const bb = path.getBBox();
    const cx = bb.x + bb.width / 2;
    const cy = bb.y + bb.height / 2;
    const pad = 2.2;
    const k = Math.min(8, Math.min(W / (bb.width * pad), H / (bb.height * pad)));
    animateTo(W / 2 - cx * k, H / 2 - cy * k, k);
  }, [animateTo]);

  // Shift key for compare pin mode
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.shiftKey) setPinMode(true); };
    const up = (e: KeyboardEvent) => { if (!e.shiftKey) setPinMode(false); };
    document.addEventListener("keydown", down);
    document.addEventListener("keyup", up);
    return () => { document.removeEventListener("keydown", down); document.removeEventListener("keyup", up); };
  }, []);

  // Pan handlers
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d.dragging) return;
      transformRef.current.x = d.originX + (e.clientX - d.startX);
      transformRef.current.y = d.originY + (e.clientY - d.startY);
      applyTransform();
    };
    const onUp = () => { dragRef.current.dragging = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [applyTransform]);

  // Wheel event must be added via addEventListener with {passive:false} for preventDefault
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const svgY = ((e.clientY - rect.top) / rect.height) * H;
      zoomAround(svgX, svgY, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    };
    svg.addEventListener("wheel", handler, { passive: false });
    return () => svg.removeEventListener("wheel", handler);
  }, [zoomAround, mapLoaded]);

  // Resizable panes
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("atlas_panels") || "{}");
      if (saved.leftW) setLeftW(saved.leftW);
      if (saved.rightW) setRightW(saved.rightW);
    } catch {}
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizerRef.current;
      if (!r) return;
      if (r.side === "left") {
        setLeftW(Math.max(220, Math.min(500, r.startW + (e.clientX - r.startX))));
      } else {
        setRightW(Math.max(280, Math.min(560, r.startW - (e.clientX - r.startX))));
      }
    };
    const onUp = () => {
      if (resizerRef.current) {
        resizerRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        localStorage.setItem("atlas_panels", JSON.stringify({ leftW, rightW }));
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [leftW, rightW]);

  function startResize(side: "left" | "right", e: React.MouseEvent) {
    e.preventDefault();
    resizerRef.current = { side, startX: e.clientX, startW: side === "left" ? leftW : rightW };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  function handleSvgMouseDown(e: React.MouseEvent) {
    if ((e.target as Element).tagName === "path" && (e.target as Element).getAttribute("data-id")) return;
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, originX: transformRef.current.x, originY: transformRef.current.y };
  }

  function enterChamber(id: string) {
    const c = COUNTRIES.find((c) => c.id === id);
    if (!c) return;
    setCountry(c);
    setHouse("lower");
    setTab("chamber");
    setDimmed(new Set());
    flyTo(id);
    setTimeout(() => setMode("chamber"), 500);
  }

  function handleCountryClick(c: Country) {
    if (pinMode && pinned.length < 2 && !pinned.includes(c.id)) {
      const newPinned = [...pinned, c.id];
      setPinned(newPinned);
      return;
    }
    enterChamber(c.id);
  }

  function enterCompare() {
    setMode("compare");
  }

  // Filter logic
  const filteredCountryIds = COUNTRIES.filter((c) => {
    if (regionFilter !== "all" && c.region !== regionFilter) return false;
    if (govFilter !== "all" && !c.gov.includes(govFilter)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!c.name.toLowerCase().includes(q) && !c.leader.toLowerCase().includes(q) && !c.capital.toLowerCase().includes(q)) return false;
    }
    return true;
  }).map((c) => c.id);

  // Chat
  function sendChat(prefill?: string) {
    const text = prefill || chatInputRef.current?.value?.trim() || "";
    if (!text) return;
    if (chatInputRef.current) chatInputRef.current.value = "";
    const c = country;
    const cd = c ? getDefaultChamberData(c.id) : null;
    const maj = cd?.lower?.parties?.[0];
    setChatHistory((prev) => [
      ...prev,
      { role: "user", text },
      {
        role: "ai",
        lead: c ? `About ${c.name} \u00b7 ${house === "upper" ? "upper" : "lower"} house` : undefined,
        text: `${maj ? `The largest party is **${maj.name}** with ${maj.seats} seats.` : "Here's what I found."} ${cd?.coalition ? `The governing coalition is **${cd.coalition}**, with next elections in ${cd.next}.` : ""}\n\nThis is a stub response \u2014 wire me to a language model and I'll answer for real, grounded in the data on this page.`,
        cite: c ? `Sources \u00b7 ${c.name} chamber record \u00b7 coalition brief` : undefined,
      },
    ]);
  }

  // Toggle party dimming
  function toggleDim(partyId: string) {
    setDimmed((prev) => {
      const next = new Set(prev);
      if (next.has(partyId)) next.delete(partyId);
      else next.add(partyId);
      return next;
    });
  }

  // Current chamber data
  const cd = country ? getDefaultChamberData(country.id) : null;
  const currentHouse = house === "upper" && cd?.upper ? cd.upper : cd?.lower;

  return (
    <div className="atlas-root" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, display: "flex", flexDirection: "column" }}>
      {/* ===== UNIFIED TOP BAR ===== */}
      <div style={{
        position: "relative", display: "flex", alignItems: "center", gap: 10,
        padding: "8px 18px", background: "color-mix(in oklab, var(--atlas-paper) 92%, transparent)",
        backdropFilter: "blur(10px)", borderBottom: "1px solid var(--atlas-rule)", zIndex: 40,
        flexWrap: "wrap",
      }}>
        <div className="atlas-serif" style={{ fontSize: 22, letterSpacing: "-0.02em", whiteSpace: "nowrap" }}>
          Civica<span style={{ color: "var(--atlas-accent)" }}>.</span>
        </div>
        <span className="atlas-mono" style={{ fontSize: 9, color: "var(--atlas-muted)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
          Atlas of governance
        </span>

        {mode === "atlas" && (
          <>
            <div style={{ width: 1, height: 20, background: "var(--atlas-rule)", margin: "0 4px" }} />
            <div className="atlas-filter-bar" style={{ border: "none", padding: 0, margin: 0, background: "none", height: "auto", backdropFilter: "none" }}>
              <div className="group">
                <span className="lbl">Region</span>
                {["all", "Americas", "Europe", "Africa", "Asia", "Oceania"].map((r) => (
                  <button key={r} className={`chip${regionFilter === r ? " on" : ""}`} onClick={() => setRegionFilter(r)}>
                    {r === "all" ? "All" : r}
                  </button>
                ))}
              </div>
              <div className="sep" />
              <div className="group">
                <span className="lbl">System</span>
                {["all", "Federal", "Parliamentary", "Presidential", "Monarchy"].map((g) => (
                  <button key={g} className={`chip${govFilter === g ? " on" : ""}`} onClick={() => setGovFilter(g)}>
                    {g === "all" ? "All" : g}
                  </button>
                ))}
              </div>
              <button className="clear-btn" onClick={() => { setRegionFilter("all"); setGovFilter("all"); }}>
                Reset &times;
              </button>
            </div>
          </>
        )}

        <div style={{ flex: 1 }} />

        <div style={{
          display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--atlas-rule)",
          background: "var(--atlas-paper)", padding: "5px 10px", minWidth: 220, maxWidth: 320, borderRadius: 2,
        }}>
          <input
            placeholder="Search country, leader\u2026"
            autoComplete="off"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const q = searchQuery.toLowerCase();
                const hit = COUNTRIES.find((c) => c.name.toLowerCase().includes(q));
                if (hit) enterChamber(hit.id);
              }
            }}
            className="atlas-sans"
            style={{
              border: 0, background: "transparent", outline: "none", fontSize: 12,
              color: "var(--atlas-ink)", width: "100%",
            }}
          />
          <span className="atlas-mono" style={{
            border: "1px solid var(--atlas-rule)", padding: "1px 5px",
            borderRadius: 2, color: "var(--atlas-muted)", fontSize: 10,
          }}>\u2318K</span>
        </div>
        <div className="atlas-mode-bar">
          {(["atlas", "chamber", "compare"] as Mode[]).map((m) => (
            <button
              key={m}
              className={mode === m ? "on" : ""}
              onClick={() => {
                if (m === "atlas") setMode("atlas");
                else if (m === "chamber") { if (!country) enterChamber("fra"); else setMode("chamber"); }
                else { if (pinned.length >= 2) { setCompareA(pinned[0]); setCompareB(pinned[1]); } enterCompare(); }
              }}
            >
              {m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
        <a href="/countries" className="atlas-mono" style={{ fontSize: 11, color: "var(--atlas-ink-2)", textDecoration: "none", letterSpacing: "0.06em" }}>
          Index
        </a>
        <a href="/rankings" className="atlas-mono" style={{ fontSize: 11, color: "var(--atlas-ink-2)", textDecoration: "none", letterSpacing: "0.06em" }}>
          Rankings
        </a>
        <a href="/blog" className="atlas-mono" style={{ fontSize: 11, color: "var(--atlas-ink-2)", textDecoration: "none", letterSpacing: "0.06em" }}>
          Blog
        </a>
      </div>

      {/* ===== STAGE ===== */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
        {/* ===== ATLAS VIEW ===== */}
        <div className="atlas-view" style={{ display: mode === "atlas" ? "block" : "none", position: "absolute", inset: 0 }}>
          <svg
            ref={svgRef}
            className="world-map"
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={handleSvgMouseDown}
          >
            <defs>
              <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.6" fill="var(--atlas-muted)" opacity="0.18" />
              </pattern>
            </defs>
            <g ref={contentRef} id="mapContent">
              <rect x="-1000" y="-500" width="4000" height="2000" fill="url(#dots)" />
              {/* Graticule */}
              <g stroke="var(--atlas-rule-2)" strokeWidth="1" fill="none">
                {Array.from({ length: 9 }, (_, i) => (
                  <line key={`h${i}`} x1={0} x2={W} y1={(i + 1) * 100} y2={(i + 1) * 100} strokeDasharray="2 6" />
                ))}
                {Array.from({ length: 9 }, (_, i) => (
                  <line key={`v${i}`} x1={(i + 1) * 200} x2={(i + 1) * 200} y1={0} y2={H} strokeDasharray="2 6" />
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
                    opacity: p.country ? (filteredCountryIds.includes(p.id!) ? 1 : 0.25) : 0.55,
                    transition: "fill 120ms, opacity 200ms",
                  }}
                  onMouseEnter={(e) => {
                    if (p.country) {
                      (e.target as SVGPathElement).setAttribute("fill", "var(--atlas-land-hover)");
                      setHoverCard({ country: p.country, x: e.clientX + 14, y: e.clientY + 14 });
                    }
                  }}
                  onMouseMove={(e) => {
                    if (p.country) setHoverCard((prev) => prev ? { ...prev, x: e.clientX + 14, y: e.clientY + 14 } : null);
                  }}
                  onMouseLeave={(e) => {
                    if (p.country) {
                      const sel = (e.target as SVGPathElement).getAttribute("data-selected");
                      if (sel !== "1") (e.target as SVGPathElement).setAttribute("fill", "var(--atlas-land)");
                      setHoverCard(null);
                    }
                  }}
                  onClick={(e) => {
                    if (p.country) { e.stopPropagation(); handleCountryClick(p.country); }
                  }}
                />
              ))}
              {/* Labels for featured countries */}
              {mapPaths.filter((p) => p.country?.featured).map((p) => {
                const wp = WORLD_PATHS[p.id!];
                if (!wp) return null;
                return (
                  <g key={`lbl-${p.id}`} style={{ pointerEvents: "none" }}>
                    <circle cx={wp.label[0]} cy={wp.label[1]} r={2.5} fill="var(--atlas-accent)" />
                    <text x={wp.label[0]} y={wp.label[1] - 6} textAnchor="middle" fontFamily="ui-monospace,monospace" fontSize="13" letterSpacing="2" fill="var(--atlas-ink)" opacity="0.7">
                      {p.id!.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Compare banner */}
          {pinned.length > 0 && (
            <div className="atlas-compare-banner">
              <span>Compare:</span>
              {[0, 1].map((i) => (
                <span key={i} className="pill">
                  {pinned[i] ? COUNTRIES.find((c) => c.id === pinned[i])?.name || "\u2014" : "\u2014"}
                  {pinned[i] && <span className="x" onClick={() => setPinned((prev) => prev.filter((_, j) => j !== i))}>&times;</span>}
                </span>
              ))}
              <button className="go-btn" onClick={() => {
                if (pinned.length < 2) return;
                setCompareA(pinned[0]); setCompareB(pinned[1]); enterCompare();
              }}>
                Open compare &nearr;
              </button>
            </div>
          )}

          {/* HUD bottom */}
          <div className="atlas-hud-bottom">
            <div className="atlas-intro">
              <div className="ey">Welcome &middot; Atlas</div>
              <h2>Every chamber, every bill, one map.</h2>
              <p>
                Pan and zoom the world. Hover a country to preview its government; click to walk into the chamber.
                Hold <b>&uArr; Shift</b> and click two countries to compare them side-by-side.
              </p>
              <div className="cta">
                <span className="k">Drag</span> to pan &middot; <span className="k">Scroll</span> to zoom &middot; <span className="k">Click</span> a country
              </div>
            </div>
            <div className="atlas-zoombar">
              <button onClick={() => zoomAround(W / 2, H / 2, 1.3)}>+</button>
              <button onClick={() => zoomAround(W / 2, H / 2, 1 / 1.3)}>&minus;</button>
              <button title="Reset" onClick={() => animateTo(0, 0, 1)}><span style={{ fontSize: 11 }}>&lceil;</span></button>
            </div>
          </div>
        </div>

        {/* ===== CHAMBER VIEW ===== */}
        {mode === "chamber" && country && cd && currentHouse && (
          <div className="chamber-grid" style={{ position: "absolute", inset: 0, gridTemplateColumns: `${leftW}px 6px 1fr 6px ${rightW}px` }}>
            {/* Left rail */}
            <div className="chamber-left">
              <div className="left-side-head">
                <button className="back-btn" onClick={() => setMode("atlas")}>&larr; Back to full atlas</button>
                <div className="kicker">Atlas</div>
                <div className="title">Pick a country</div>
              </div>
              <div className="left-mini-map">
                <svg viewBox="0 100 2000 800" preserveAspectRatio="xMidYMid meet">
                  {Object.entries(WORLD_PATHS).map(([id, data]) => (
                    <path
                      key={id}
                      d={data.d}
                      data-id={id}
                      className={id === country.id ? "sel" : ""}
                      onClick={() => {
                        const c = COUNTRIES.find((c) => c.id === id);
                        if (c) { setCountry(c); setDimmed(new Set()); setHouse("lower"); setTab("chamber"); }
                      }}
                    />
                  ))}
                </svg>
              </div>
              <div className="left-country-list">
                {["Americas", "Europe", "Africa", "Asia", "Oceania"].map((region) => {
                  const items = COUNTRIES.filter((c) => c.region === region);
                  if (!items.length) return null;
                  return (
                    <div key={region} className="region-group">
                      <div className="region-label">{region}</div>
                      {items.map((c) => (
                        <div
                          key={c.id}
                          className={`country-row${c.id === country.id ? " on" : ""}`}
                          onClick={() => { setCountry(c); setDimmed(new Set()); setHouse("lower"); setTab("chamber"); }}
                        >
                          <span>{c.name}{c.featured ? " \u2605" : ""}</span>
                          <span className="code">{c.id.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left resizer */}
            <div className="atlas-resizer" onMouseDown={(e) => startResize("left", e)} />

            {/* Center pane */}
            <div className="chamber-center">
              <div className="atlas-masthead">
                <div>
                  <div className="eyebrow">{country.region.toUpperCase()} &middot; {country.id.toUpperCase()}</div>
                  <h1>{country.name}</h1>
                  <div className="dek">
                    {govDescription(country)} of {country.pop} people, led from {country.capital}.
                    Below: the living composition of its chambers and the laws it&apos;s working on right now.
                  </div>
                </div>
                <div className="quick-facts">
                  <div className="r"><b>Leader</b><span>{country.leader}</span></div>
                  <div className="r"><b>Gov</b><span>{country.gov}</span></div>
                  <div className="r"><b>Capital</b><span>{country.capital}</span></div>
                  <div className="r"><b>Population</b><span>{country.pop}</span></div>
                  <div className="r"><b>GDP</b><span>{country.gdp}</span></div>
                </div>
              </div>

              <div className="atlas-tabs">
                {([["chamber", "I \u00b7 The Chamber"], ["bills", "II \u00b7 Laws in Motion"], ["structure", "III \u00b7 Full Structure"]] as [Tab, string][]).map(([t, label]) => (
                  <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>{label}</button>
                ))}
              </div>

              {/* Tab I: Chamber */}
              <div className={`atlas-pane${tab === "chamber" ? " on" : ""}`}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 14 }}>
                  <div>
                    <div className="atlas-mono" style={{ fontSize: 10, color: "var(--atlas-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                      {country.name.toUpperCase()} &middot; {house === "upper" ? "UPPER" : "LOWER"} HOUSE
                    </div>
                    <div className="atlas-serif" style={{ fontSize: 40, letterSpacing: "-0.02em", lineHeight: 1, marginTop: 4 }}>
                      {currentHouse.name}
                    </div>
                    <div className="atlas-sans" style={{ fontSize: 13, color: "var(--atlas-ink-2)", marginTop: 6 }}>
                      {currentHouse.sub}
                    </div>
                  </div>
                  <div className="atlas-house-toggle">
                    <button className={house === "lower" ? "on" : ""} onClick={() => { setHouse("lower"); setDimmed(new Set()); }}>
                      Lower house
                    </button>
                    <button className={house === "upper" ? "on" : ""} disabled={!cd.upper} onClick={() => { setHouse("upper"); setDimmed(new Set()); }}>
                      Upper house
                    </button>
                  </div>
                </div>

                <div className="atlas-chamber-stage">
                  <div className="atlas-chamber-title">
                    <span className="nm">{currentHouse.name}</span>
                    <span className="sub">{currentHouse.total} seats &middot; hover a seat for the member&apos;s name</span>
                  </div>
                  <Hemicycle
                    chamber={currentHouse}
                    dimmed={dimmed}
                    onSeatHover={(info, e) => setSeatTip({ ...info, x: e.clientX + 14, y: e.clientY + 14 })}
                    onSeatLeave={() => setSeatTip(null)}
                  />
                </div>

                <PartyLegend chamber={currentHouse} dimmed={dimmed} onToggle={toggleDim} />

                <div className="atlas-chamber-meta" style={{ marginTop: 18, borderTop: "1px solid var(--atlas-rule)" }}>
                  <div className="cell"><div className="k">Total seats</div><div className="v">{currentHouse.total}</div></div>
                  <div className="cell"><div className="k">Majority line</div><div className="v">{Math.ceil(currentHouse.total / 2) + 1}</div></div>
                  <div className="cell"><div className="k">Ruling coalition</div><div className="v" style={{ fontSize: 14 }}>{cd.coalition || "\u2014"}</div></div>
                  <div className="cell"><div className="k">Next election</div><div className="v">{cd.next || "\u2014"}</div></div>
                </div>
              </div>

              {/* Tab II: Bills */}
              <div className={`atlas-pane${tab === "bills" ? " on" : ""}`}>
                {(!cd.bills || cd.bills.length === 0) ? (
                  <div className="atlas-mono" style={{ color: "var(--atlas-muted)", fontSize: 12, padding: "40px 0", textAlign: "center", letterSpacing: ".08em", textTransform: "uppercase" }}>
                    No bill data loaded for {country.name}
                  </div>
                ) : (
                  cd.bills.map((b, i) => <BillCard key={i} bill={b} index={i} onAsk={(text) => {
                    if (chatInputRef.current) chatInputRef.current.value = text;
                    sendChat(text);
                  }} />)
                )}
              </div>

              {/* Tab III: Structure */}
              <div className={`atlas-pane${tab === "structure" ? " on" : ""}`}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, border: "1px dashed var(--atlas-rule)", padding: 24, minHeight: 320, background: "var(--atlas-paper-2)" }}>
                  {(["exec", "legis", "jud"] as const).map((branch) => (
                    <div key={branch}>
                      <div className="atlas-mono" style={{ fontSize: 10, color: "var(--atlas-muted)", letterSpacing: ".14em", textTransform: "uppercase" }}>
                        {branch === "exec" ? "Executive" : branch === "legis" ? "Legislative" : "Judicial"}
                      </div>
                      <div className="atlas-serif" style={{ fontSize: 20, marginTop: 6 }}>
                        {cd.branches?.[branch] || "\u2014"}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="atlas-sans" style={{ fontSize: 13, color: "var(--atlas-muted)", marginTop: 18, lineHeight: 1.55 }}>
                  A full interactive appointment map &mdash; who nominates whom, who confirms, which terms overlap &mdash; lives here in v2.
                  For now, this is a schematic summary.
                </div>
              </div>
            </div>

            {/* Right resizer */}
            <div className="atlas-resizer" onMouseDown={(e) => startResize("right", e)} />

            {/* Chat rail */}
            <div className="chamber-right">
              <div className="atlas-chat-head">
                <span className="dot" />
                <span className="t">Ask Civica</span>
                <span className="s">AI &middot; context-aware</span>
              </div>
              <div className="atlas-chat-ctx">
                Context:
                <span className="pill">{country.name}</span>
                <span className="pill">{house === "upper" ? "Upper house" : "Lower house"}</span>
              </div>
              <div className="atlas-chat-scroll">
                {chatHistory.map((m, i) => (
                  <div key={i} className="atlas-msg">
                    <div className={`av${m.role === "ai" ? " ai" : ""}`}>{m.role === "ai" ? "C" : "U"}</div>
                    <div className="bub">
                      {m.lead && <div className="lead">{m.lead}</div>}
                      {m.text.split("\n\n").map((p, j) => (
                        <p key={j} dangerouslySetInnerHTML={{ __html: p.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>") }} />
                      ))}
                      {m.cite && <div className="cite">{m.cite}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="atlas-suggest">
                {[
                  { q: "Who has the majority and how stable is the coalition?", label: "Majority stability" },
                  { q: "What's the most controversial bill in motion right now?", label: "Controversial bill" },
                  { q: "How does this chamber compare to the United States House?", label: "Vs. US House" },
                  { q: "Walk me through how a bill becomes law here.", label: "How a bill becomes law" },
                ].map((s) => (
                  <span key={s.label} className="s" onClick={() => sendChat(s.q)}>{s.label}</span>
                ))}
              </div>
              <div className="atlas-chat-input">
                <textarea ref={chatInputRef} placeholder={`Ask anything about ${country.name}'s government\u2026`} rows={2}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                />
                <button onClick={() => sendChat()}>Send</button>
              </div>
            </div>
          </div>
        )}

        {/* ===== COMPARE VIEW ===== */}
        {mode === "compare" && (
          <div className="chamber-grid compare-mode" style={{ position: "absolute", inset: 0 }}>
            <ComparePane
              countryId={compareA}
              side="A"
              house={compareHouseA}
              onChangeCountry={(id) => { setCompareA(id); setCompareHouseA("lower"); }}
              onChangeHouse={setCompareHouseA}
              dimmed={dimmed}
              onSeatHover={(info, e) => setSeatTip({ ...info, x: e.clientX + 14, y: e.clientY + 14 })}
              onSeatLeave={() => setSeatTip(null)}
              countries={COUNTRIES}
              getChamberData={getDefaultChamberData}
            />
            <div className="atlas-resizer decorative" />
            <ComparePane
              countryId={compareB}
              side="B"
              house={compareHouseB}
              onChangeCountry={(id) => { setCompareB(id); setCompareHouseB("lower"); }}
              onChangeHouse={setCompareHouseB}
              dimmed={dimmed}
              onSeatHover={(info, e) => setSeatTip({ ...info, x: e.clientX + 14, y: e.clientY + 14 })}
              onSeatLeave={() => setSeatTip(null)}
              countries={COUNTRIES}
              getChamberData={getDefaultChamberData}
            />
            <div className="atlas-resizer" />
            <div className="chamber-right">
              <div className="atlas-chat-head">
                <span className="dot" />
                <span className="t">Ask Civica &middot; Compare</span>
                <span className="s">AI</span>
              </div>
              <div className="atlas-chat-ctx">
                Context:
                <span className="pill">{COUNTRIES.find((c) => c.id === compareA)?.name}</span>
                <span style={{ color: "var(--atlas-muted)" }}>&harr;</span>
                <span className="pill">{COUNTRIES.find((c) => c.id === compareB)?.name}</span>
              </div>
              <div className="atlas-chat-scroll">
                <div className="atlas-msg">
                  <div className="av ai">C</div>
                  <div className="bub">
                    <div className="lead">Compare &middot; {COUNTRIES.find((c) => c.id === compareA)?.name} &harr; {COUNTRIES.find((c) => c.id === compareB)?.name}</div>
                    <p>Use the selectors above to swap countries or toggle upper/lower chambers. Hover any seat for the member&apos;s name.</p>
                    <div className="cite">Tip &middot; ask me &ldquo;what are the biggest differences in how power flows?&rdquo;</div>
                  </div>
                </div>
              </div>
              <div className="atlas-suggest">
                <span className="s">Compare electoral systems</span>
                <span className="s">Which has stronger executive?</span>
                <span className="s">How do their courts differ?</span>
              </div>
              <div className="atlas-chat-input">
                <textarea placeholder="Ask about the comparison\u2026" rows={2} />
                <button>Send</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== HOVER CARD ===== */}
      {hoverCard && (
        <div className="atlas-hover-card" style={{ left: hoverCard.x, top: hoverCard.y }}>
          <div className="hc-top">
            <h3>{hoverCard.country.name}</h3>
            <span className="hc-code">{hoverCard.country.id.toUpperCase()}</span>
          </div>
          <div className="hc-row"><b>Government</b><span>{hoverCard.country.gov}</span></div>
          <div className="hc-row"><b>Capital</b><span>{hoverCard.country.capital}</span></div>
          <div className="hc-row"><b>Pop.</b><span>{hoverCard.country.pop}</span></div>
          <div className="hc-row"><b>GDP</b><span>{hoverCard.country.gdp}</span></div>
          <div className="hc-leader">
            <span className="r">Head of government</span><br />
            {hoverCard.country.leader}
          </div>
          <div className="hc-cta">Click &rarr; walk into the chamber &nearr;</div>
        </div>
      )}

      {/* ===== SEAT TOOLTIP ===== */}
      {seatTip && (
        <div className="atlas-seat-tip" style={{ left: seatTip.x, top: seatTip.y }}>
          <div className="nm">{seatTip.member.name}</div>
          <div className="pty">{seatTip.party.name}</div>
          <div className="dis">{seatTip.member.district} &middot; Seat {seatTip.index + 1}</div>
        </div>
      )}
    </div>
  );
}

/* ===== BILL CARD ===== */
function BillCard({ bill, index, onAsk }: { bill: Bill; index: number; onAsk: (text: string) => void }) {
  const stages = ["Draft", "Committee", "Lower Floor", "Upper House", "Enacted"];
  return (
    <div className="atlas-bill">
      <div className="idx">{String(index + 1).padStart(2, "0")}</div>
      <div>
        <div className="t">{bill.title}</div>
        <div className="sum">{bill.summary}</div>
        <div className="sponsor">Sponsor &middot; {bill.sponsor}</div>
        <div className="tags">{bill.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
        <div className="timeline">
          {stages.map((s, j) => (
            <span key={s}>
              <span className={`dot${j < bill.stage ? " done" : j === bill.stage ? " now" : ""}`} />
              {j < stages.length - 1 && <span className="line" />}
            </span>
          ))}
        </div>
        <div className="tlabs">{stages.map((s) => <span key={s}>{s}</span>)}</div>
        {bill.votes && (() => {
          const tot = bill.votes.yes + bill.votes.no + bill.votes.abs;
          const y = (bill.votes.yes / tot) * 100;
          const n = (bill.votes.no / tot) * 100;
          const a = (bill.votes.abs / tot) * 100;
          return (
            <>
              <div className="atlas-vote-bar">
                <div className="y" style={{ width: `${y}%` }} />
                <div className="n" style={{ width: `${n}%` }} />
                <div className="a" style={{ width: `${a}%` }} />
              </div>
              <div className="atlas-vote-row">
                <span>Yes {bill.votes!.yes}</span>
                <span>No {bill.votes!.no}</span>
                <span>Abs {bill.votes!.abs}</span>
              </div>
            </>
          );
        })()}
      </div>
      <div className="actions">
        <span className="status-badge">{bill.status}</span>
        <button className="ask-btn" onClick={() => onAsk(`Explain "${bill.title}" to me \u2014 what does it actually do, who wins, who loses, and where is it in the process?`)}>
          Ask AI
        </button>
      </div>
    </div>
  );
}

/* ===== COMPARE PANE ===== */
function ComparePane({ countryId, side, house, onChangeCountry, onChangeHouse, dimmed, onSeatHover, onSeatLeave, countries, getChamberData }: {
  countryId: string;
  side: string;
  house: House;
  onChangeCountry: (id: string) => void;
  onChangeHouse: (h: House) => void;
  dimmed: Set<string>;
  onSeatHover?: (info: { member: { name: string; district: string }; party: { name: string; id: string }; index: number }, e: React.MouseEvent) => void;
  onSeatLeave?: () => void;
  countries: Country[];
  getChamberData: (id: string) => ChamberData;
}) {
  const c = countries.find((x) => x.id === countryId)!;
  const cd = getChamberData(countryId);
  const chamber = house === "upper" && cd.upper ? cd.upper : cd.lower;
  const hasUpper = !!cd.upper;

  return (
    <div className={`chamber-center${side === "A" ? " atlas-compare-divider" : ""}`}>
      <div className="atlas-compare-heading">
        <span>Compare &middot; Side {side}</span>
        <select
          value={countryId}
          onChange={(e) => onChangeCountry(e.target.value)}
          className="atlas-mono"
          style={{ fontSize: 11, padding: "4px 6px", border: "1px solid var(--atlas-ink)", background: "var(--atlas-paper)", color: "var(--atlas-ink)" }}
        >
          {countries.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </div>
      <div style={{ padding: "28px 32px 18px" }}>
        <div className="atlas-mono" style={{ fontSize: 10, color: "var(--atlas-muted)", letterSpacing: ".14em", textTransform: "uppercase" }}>
          {c.region} &middot; {c.id.toUpperCase()}
        </div>
        <h1 className="atlas-serif" style={{ fontWeight: 400, fontSize: 40, letterSpacing: "-0.02em", margin: "4px 0 4px", lineHeight: 1 }}>
          {c.name}
        </h1>
        <div className="atlas-sans" style={{ fontSize: 13, color: "var(--atlas-ink-2)" }}>
          {chamber.name} &middot; {chamber.sub}
        </div>
        <div className="atlas-house-toggle" style={{ marginTop: 14 }}>
          <button className={house === "lower" ? "on" : ""} onClick={() => onChangeHouse("lower")}>Lower</button>
          <button className={house === "upper" ? "on" : ""} disabled={!hasUpper} onClick={() => onChangeHouse("upper")}>Upper</button>
        </div>
      </div>
      <div style={{ padding: "0 32px" }}>
        <div className="atlas-chamber-stage">
          <div className="atlas-chamber-title">
            <span className="nm">{chamber.name}</span>
            <span className="sub">{chamber.total} seats</span>
          </div>
          <Hemicycle chamber={chamber} dimmed={dimmed} onSeatHover={onSeatHover} onSeatLeave={onSeatLeave} />
        </div>
        <div className="atlas-chamber-meta">
          <div className="cell"><div className="k">Seats</div><div className="v">{chamber.total}</div></div>
          <div className="cell"><div className="k">Majority</div><div className="v">{Math.ceil(chamber.total / 2) + 1}</div></div>
          <div className="cell"><div className="k">Leader</div><div className="v" style={{ fontSize: 14 }}>{c.leader}</div></div>
        </div>
        <PartyLegend chamber={chamber} dimmed={new Set()} onToggle={() => {}} />
      </div>
      <div style={{ padding: "24px 32px 60px" }}>
        <div className="atlas-mono" style={{ fontSize: 10, color: "var(--atlas-muted)", letterSpacing: ".14em", textTransform: "uppercase", marginBottom: 10 }}>
          Active legislation &middot; top 2
        </div>
        {(cd.bills || []).slice(0, 2).map((b, i) => (
          <div key={i} style={{ border: "1px solid var(--atlas-rule)", padding: "14px 16px", marginBottom: 8 }}>
            <div className="atlas-serif" style={{ fontSize: 17, lineHeight: 1.25, marginBottom: 4 }}>{b.title}</div>
            <div className="atlas-sans" style={{ fontSize: 12, color: "var(--atlas-ink-2)", lineHeight: 1.5 }}>{b.summary}</div>
            <div style={{ marginTop: 8 }}>
              <span className="atlas-mono" style={{ fontSize: 10, color: "var(--atlas-accent)", letterSpacing: ".1em", textTransform: "uppercase", border: "1px solid var(--atlas-accent)", padding: "2px 6px" }}>
                {b.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
