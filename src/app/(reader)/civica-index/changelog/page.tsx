import type { Metadata } from "next";
import Link from "next/link";
import {
  getPulseChangelog,
  getPulseChangelogSummary,
  getPulseChangelogDailyGlobal,
} from "@/lib/db/queries";
import { CountryFlag } from "@/components/CountryFlag";

export const metadata: Metadata = {
  title: "Civica Pulse Changelog — Every governance event, every day",
  description:
    "The live feed of governance events altering Civica Pulse scores — with category, severity, confidence, and one-sentence justification.",
  alternates: { canonical: "https://civicaatlas.org/civica-index/changelog" },
};

interface PulseEvent {
  id: string;
  eventDate: string;
  category: string;
  severity: number;
  confidence: number;
  headline: string;
  justification: string;
  sourceUrl: string | null;
  sourceName: string | null;
  isActive: boolean;
  slug: string;
  countryName: string;
  iso2: string | null;
  flagUrl: string | null;
  continent: string | null;
  capital: string | null;
  pulseLatest: number | string | null;
}

interface SummaryRow {
  totalEvents: number;
  countriesMoved: number;
  totalCountries: number;
  biggestDropCountry: string | null;
  biggestDropValue: number | string | null;
  biggestGainCountry: string | null;
  biggestGainValue: number | string | null;
}

interface DailyRow {
  eventDate: string;
  positiveImpact: number | string | null;
  negativeImpact: number | string | null;
  netImpact: number | string | null;
  eventCount: number;
}

type FilterMode = "all" | "positive" | "negative";
type ContinentFilter = "all" | "Africa" | "Americas" | "Asia" | "Europe" | "Oceania";

function toNum(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v);
}

function categoryLabel(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function severityBadgeClass(severity: number): string {
  if (severity <= -7) return "sev-cat";
  if (severity <= -4) return "sev-sev";
  if (severity <= -1) return "sev-sig";
  if (severity === 0) return "sev-mod";
  if (severity <= 4) return "sev-pos";
  return "sev-pos-big";
}

function formatSeverity(severity: number): string {
  const rounded = Math.round(severity);
  return rounded > 0 ? `+${rounded}` : `${rounded}`;
}

function formatImpact(severity: number, confidence: number): string {
  const impact = (severity * confidence) / 10;
  return (impact >= 0 ? "+" : "") + impact.toFixed(2);
}

function formatDayStamp(date: Date): { stamp: string; sub: string } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const weekday = d.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  if (d.getTime() === today.getTime()) {
    return { stamp: "Today", sub: `${monthDay} · ${weekday}` };
  }
  if (d.getTime() === yesterday.getTime()) {
    return { stamp: "Yesterday", sub: `${monthDay} · ${weekday}` };
  }
  return { stamp: monthDay, sub: weekday };
}

function continentLabel(c: string | null): string {
  if (!c) return "";
  return c;
}

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const countryFilter =
    typeof sp?.country === "string" ? sp.country : undefined;
  const mode: FilterMode =
    sp?.mode === "positive"
      ? "positive"
      : sp?.mode === "negative"
        ? "negative"
        : "all";
  const continent: ContinentFilter =
    typeof sp?.continent === "string" &&
    ["Africa", "Americas", "Asia", "Europe", "Oceania"].includes(sp.continent)
      ? (sp.continent as ContinentFilter)
      : "all";
  const q =
    typeof sp?.q === "string" && sp.q.trim().length > 0
      ? sp.q.trim()
      : undefined;

  let events: PulseEvent[] = [];
  let summary: SummaryRow | null = null;
  let daily: DailyRow[] = [];
  try {
    const [evRes, sumRes, dailyRes] = await Promise.all([
      getPulseChangelog(countryFilter, 200, 0),
      getPulseChangelogSummary(30),
      getPulseChangelogDailyGlobal(30),
    ]);
    events = (evRes as unknown as { rows: PulseEvent[] }).rows ?? [];
    const sumRows =
      (sumRes as unknown as { rows: SummaryRow[] }).rows ?? [];
    summary = sumRows[0] ?? null;
    daily = (dailyRes as unknown as { rows: DailyRow[] }).rows ?? [];
  } catch {
    // DB not seeded
  }

  const filteredEvents = events.filter((e) => {
    if (mode === "positive" && e.severity <= 0) return false;
    if (mode === "negative" && e.severity >= 0) return false;
    if (continent !== "all" && e.continent !== continent) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (
        !e.countryName.toLowerCase().includes(needle) &&
        !e.headline.toLowerCase().includes(needle) &&
        !e.category.toLowerCase().includes(needle)
      ) {
        return false;
      }
    }
    return true;
  });

  const grouped: Array<{ date: string; events: PulseEvent[] }> = [];
  for (const e of filteredEvents) {
    const last = grouped[grouped.length - 1];
    if (last && last.date === e.eventDate) {
      last.events.push(e);
    } else {
      grouped.push({ date: e.eventDate, events: [e] });
    }
  }

  // SVG geometry
  const SVG_W = 1120;
  const SVG_H = 120;
  const BASELINE = 60;
  const SLOT = 32;
  const BAR_W = 24;
  const maxMag = daily.reduce((m, r) => {
    return Math.max(
      m,
      Math.abs(toNum(r.positiveImpact)),
      Math.abs(toNum(r.negativeImpact))
    );
  }, 1);
  const scale = 50 / maxMag;

  const netPoints: Array<{ x: number; y: number }> = daily.map((r, i) => {
    const x = 20 + i * SLOT;
    const net = toNum(r.netImpact);
    const y = Math.max(0, Math.min(SVG_H, BASELINE - net * scale));
    return { x, y };
  });
  const netPath =
    netPoints.length > 0
      ? netPoints
          .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
          .join(" ")
      : "";

  const qParam = countryFilter ? `country=${encodeURIComponent(countryFilter)}` : "";
  const linkWith = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    if (countryFilter) params.set("country", countryFilter);
    if (mode !== "all") params.set("mode", mode);
    if (continent !== "all") params.set("continent", continent);
    if (q) params.set("q", q);
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined) params.delete(k);
      else params.set(k, v);
    }
    const s = params.toString();
    return `/civica-index/changelog${s ? `?${s}` : ""}`;
  };

  const hasData = events.length > 0;
  const biggestDrop = toNum(summary?.biggestDropValue);
  const biggestGain = toNum(summary?.biggestGainValue);

  return (
    <main className="civica-changelog-page">
      <nav className="ci-breadcrumb">
        <Link href="/civica-index">← Civica Index</Link>
        <span>/</span>
        Changelog
      </nav>

      <section className="ci-hero">
        <div>
          <div className="ci-hero-eyebrow">
            <span className="dot live" aria-hidden="true" />
            Live · refreshed daily
          </div>
          <h1 className="ci-hero-title">
            Every Pulse movement, every country, every day.
          </h1>
        </div>
        <p className="ci-hero-lede">
          The Civica Pulse moves with the news. This feed shows every event
          that has altered any country&rsquo;s score in the last 30 days —
          with category, severity, confidence, and the one-sentence
          justification from the scoring model.
        </p>
      </section>

      {countryFilter && (
        <div className="ci-scope-banner">
          <span>
            Filtered to <strong>{countryFilter}</strong>
          </span>
          <Link href="/civica-index/changelog">Show all countries →</Link>
        </div>
      )}

      <div className="pulse-global">
        <div className="pulse-global-head">
          <div className="pulse-global-title">
            Global Pulse · 30-day movement index
          </div>
          <div className="pulse-global-legend">
            <span>
              <span
                className="legend-swatch"
                style={{ background: "var(--color-source-live)" }}
              />
              Positive impact
            </span>
            <span>
              <span
                className="legend-swatch"
                style={{ background: "var(--tier-failed)" }}
              />
              Negative impact
            </span>
            <span>
              <span
                className="legend-swatch"
                style={{ background: "var(--color-text-40)" }}
              />
              Net shift
            </span>
          </div>
        </div>
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="none"
          style={{ width: "100%", height: 120 }}
          role="img"
          aria-label="30-day global pulse movement"
        >
          <line
            x1="0"
            y1={BASELINE}
            x2={SVG_W}
            y2={BASELINE}
            stroke="var(--color-divider)"
            strokeWidth="1"
          />
          <g fill="var(--color-source-live)" opacity="0.9">
            {daily.map((r, i) => {
              const pos = toNum(r.positiveImpact);
              if (pos <= 0) return null;
              const h = Math.max(2, pos * scale);
              return (
                <rect
                  key={`p-${r.eventDate}`}
                  x={8 + i * SLOT}
                  y={BASELINE - h}
                  width={BAR_W}
                  height={h}
                />
              );
            })}
          </g>
          <g fill="var(--tier-failed)" opacity="0.85">
            {daily.map((r, i) => {
              const neg = toNum(r.negativeImpact);
              if (neg >= 0) return null;
              const h = Math.max(2, Math.abs(neg) * scale);
              return (
                <rect
                  key={`n-${r.eventDate}`}
                  x={8 + i * SLOT}
                  y={BASELINE}
                  width={BAR_W}
                  height={h}
                />
              );
            })}
          </g>
          {netPath && (
            <path
              d={netPath}
              fill="none"
              stroke="var(--color-text-40)"
              strokeWidth="1.5"
            />
          )}
        </svg>
      </div>

      <div className="filter-bar" role="group" aria-label="Filter events">
        <Link
          className={`chip ${mode === "all" ? "chip--active" : ""}`}
          href={linkWith({ mode: undefined })}
        >
          All events
        </Link>
        <Link
          className={`chip ${mode === "negative" ? "chip--active" : ""}`}
          href={linkWith({ mode: "negative" })}
        >
          Negative only
        </Link>
        <Link
          className={`chip ${mode === "positive" ? "chip--active" : ""}`}
          href={linkWith({ mode: "positive" })}
        >
          Positive only
        </Link>
        <span className="chip chip--divider" aria-hidden="true">
          |
        </span>
        <Link
          className={`chip ${continent === "all" ? "chip--active" : ""}`}
          href={linkWith({ continent: undefined })}
        >
          Global
        </Link>
        {(["Africa", "Americas", "Asia", "Europe", "Oceania"] as const).map(
          (c) => (
            <Link
              key={c}
              className={`chip ${continent === c ? "chip--active" : ""}`}
              href={linkWith({ continent: c })}
            >
              {c}
            </Link>
          )
        )}
        <div className="filter-spacer" />
        <form action="/civica-index/changelog" method="get" className="search-form">
          {countryFilter && (
            <input type="hidden" name="country" value={countryFilter} />
          )}
          {mode !== "all" && <input type="hidden" name="mode" value={mode} />}
          {continent !== "all" && (
            <input type="hidden" name="continent" value={continent} />
          )}
          <input
            className="search-input"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search country or keyword…"
          />
        </form>
      </div>

      {summary && (
        <div className="summary-grid">
          <div className="summary-cell">
            <div className="summary-label">Events scored · 30d</div>
            <div className="summary-value">
              {summary.totalEvents.toLocaleString()}
            </div>
          </div>
          <div className="summary-cell">
            <div className="summary-label">Countries with movement</div>
            <div className="summary-value">
              {summary.countriesMoved} / {summary.totalCountries}
            </div>
          </div>
          <div className="summary-cell">
            <div className="summary-label">Biggest drop</div>
            <div
              className="summary-value"
              style={{ color: "var(--tier-failed)" }}
            >
              {summary.biggestDropCountry ? (
                <>
                  {summary.biggestDropCountry} {biggestDrop.toFixed(1)}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
          <div className="summary-cell">
            <div className="summary-label">Biggest gain</div>
            <div
              className="summary-value"
              style={{ color: "var(--tier-exceptional)" }}
            >
              {summary.biggestGainCountry ? (
                <>
                  {summary.biggestGainCountry} +{biggestGain.toFixed(1)}
                </>
              ) : (
                "—"
              )}
            </div>
          </div>
        </div>
      )}

      {!hasData && (
        <div className="ci-empty">
          <p className="ci-empty-title">No Pulse events recorded yet.</p>
          <p className="ci-empty-sub">
            Events will appear here once the Pulse pipeline is active.
          </p>
        </div>
      )}

      {hasData && grouped.length === 0 && (
        <div className="ci-empty">
          <p className="ci-empty-title">No events match your filters.</p>
          <Link href={qParam ? `/civica-index/changelog?${qParam}` : "/civica-index/changelog"}>
            Clear filters
          </Link>
        </div>
      )}

      {grouped.map((group) => {
        const d = new Date(group.date);
        const { stamp, sub } = formatDayStamp(d);
        const countries = new Set(group.events.map((e) => e.slug)).size;
        return (
          <section key={group.date} className="feed-wrap">
            <div className="feed-day-col">
              <div className="feed-date-stamp">{stamp}</div>
              <div className="feed-date-sub">{sub}</div>
              <div className="feed-date-count">
                {group.events.length} event
                {group.events.length === 1 ? "" : "s"} · {countries} countr
                {countries === 1 ? "y" : "ies"}
              </div>
            </div>
            <div className="feed-events">
              {group.events.map((event) => {
                const sevBadge = severityBadgeClass(event.severity);
                const isNeg = event.severity < 0;
                const timeStr = new Date(
                  `${event.eventDate}T00:00:00Z`
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
                return (
                  <Link
                    key={event.id}
                    className="event-row"
                    href={`/civica-index/${event.slug}`}
                  >
                    <div className={`event-sev ${sevBadge}`}>
                      {formatSeverity(event.severity)}
                    </div>
                    <div className="event-country">
                      <div className="event-country-inline">
                        <CountryFlag iso2={event.iso2} size={16} />
                        <div className="event-country-name">
                          {event.countryName}
                        </div>
                      </div>
                      <div className="event-country-meta">
                        {[event.capital, continentLabel(event.continent)]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <div className="event-body">
                      <div className="event-cat">
                        {categoryLabel(event.category)} · {timeStr}
                        {event.confidence < 0.7 && (
                          <> · conf {(event.confidence * 100).toFixed(0)}%</>
                        )}
                      </div>
                      <div className="event-head">{event.headline}</div>
                    </div>
                    <div
                      className={`event-impact ${isNeg ? "impact-neg" : "impact-pos"}`}
                    >
                      {formatImpact(event.severity, event.confidence)}
                    </div>
                    <div className="event-score-after">
                      {event.pulseLatest !== null &&
                      event.pulseLatest !== undefined ? (
                        <>
                          CP now{" "}
                          <strong>{toNum(event.pulseLatest).toFixed(1)}</strong>
                        </>
                      ) : (
                        <span style={{ color: "var(--color-text-20)" }}>
                          CP —
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <footer className="ci-page-footer">
        <Link href="/civica-index">Back to rankings</Link>
        <Link href="/civica-index/methodology">Methodology</Link>
        <Link href="/civica-index/government-types">By government type</Link>
        <span className="footer-meta">
          Civica Pulse (Beta) · every event logged · every score auditable
        </span>
      </footer>

      <style>{`
        .civica-changelog-page {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px var(--spacing-page-x, 40px) 64px;
          font-family: var(--font-body);
          color: var(--color-text-primary);
        }
        .ci-breadcrumb {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          letter-spacing: 0.03em;
          color: var(--color-text-30);
          padding: 0 0 14px;
          display: flex; gap: 8px; align-items: center;
        }
        .ci-breadcrumb a { color: var(--color-text-30); text-decoration: none; }
        .ci-breadcrumb a:hover { color: var(--color-text-primary); }

        .ci-hero {
          padding: 8px 0 40px;
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 48px;
          align-items: end;
        }
        .ci-hero-eyebrow {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 14px;
          display: flex; align-items: center; gap: 10px;
        }
        .ci-hero-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 56px;
          font-weight: 400;
          letter-spacing: -0.04em;
          line-height: 1.02;
          color: var(--color-text-primary);
          margin: 0;
        }
        .ci-hero-lede {
          font-family: var(--font-body);
          font-size: 16px;
          color: var(--color-text-60);
          line-height: 1.6;
          max-width: 520px;
          margin: 0;
        }

        .ci-scope-banner {
          margin-bottom: 16px;
          padding: 10px 14px;
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          background: var(--color-grid-cell);
          display: flex; justify-content: space-between; align-items: center;
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-50);
        }
        .ci-scope-banner a {
          color: var(--color-accent);
          text-decoration: none;
        }
        .ci-scope-banner strong { color: var(--color-text-primary); }

        .pulse-global {
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          background: var(--color-grid-cell);
          padding: 24px 28px;
          margin-bottom: 16px;
        }
        .pulse-global-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 12px;
          flex-wrap: wrap;
          gap: 12px;
        }
        .pulse-global-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 22px;
          font-weight: 400;
          letter-spacing: -0.02em;
          color: var(--color-text-primary);
        }
        .pulse-global-legend {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 11px;
          color: var(--color-text-40);
          display: flex; gap: 18px; flex-wrap: wrap;
        }
        .legend-swatch {
          display: inline-block;
          width: 12px; height: 3px;
          margin-right: 6px;
          vertical-align: middle;
        }

        .filter-bar {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          padding: 16px 20px;
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          background: var(--color-grid-cell);
          margin-bottom: 8px;
        }
        .chip {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          padding: 7px 14px;
          background: transparent;
          color: var(--color-text-40);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          cursor: pointer;
          transition: all .15s;
          text-decoration: none;
          line-height: 1;
        }
        .chip:hover {
          color: var(--color-text-primary);
          border-color: var(--color-text-40);
        }
        .chip--active {
          background: var(--color-accent);
          color: var(--color-bg);
          border-color: var(--color-accent);
        }
        .chip--divider {
          border-color: transparent;
          color: var(--color-text-20);
          padding: 7px 4px;
          cursor: default;
        }
        .filter-spacer { flex: 1; }
        .search-form { display: contents; }
        .search-input {
          background: transparent;
          border: 1px solid var(--color-card-border);
          color: var(--color-text-primary);
          padding: 8px 12px;
          border-radius: 4px;
          font-family: var(--font-mono);
          font-size: 12px;
          min-width: 180px;
        }
        .search-input::placeholder { color: var(--color-text-30); }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: var(--color-grid-bg);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 32px;
        }
        .summary-cell {
          background: var(--color-grid-cell);
          padding: 18px 22px;
        }
        .summary-label {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 4px;
        }
        .summary-value {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 24px;
          letter-spacing: -0.02em;
          font-weight: 400;
          line-height: 1.1;
        }

        .feed-wrap {
          display: grid;
          grid-template-columns: 180px 1fr;
          gap: 40px;
          margin-bottom: 40px;
        }
        .feed-day-col {
          position: sticky;
          top: 80px;
          align-self: start;
          padding-top: 8px;
        }
        .feed-date-stamp {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 28px;
          font-weight: 400;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .feed-date-sub {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--color-text-30);
          text-transform: uppercase;
          margin-top: 4px;
        }
        .feed-date-count {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          color: var(--color-text-50);
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid var(--color-divider);
        }

        .feed-events {
          display: grid;
          gap: 1px;
          background: var(--color-grid-bg);
          border: 1px solid var(--color-card-border);
          border-radius: 4px;
          overflow: hidden;
        }
        .event-row {
          background: var(--color-grid-cell);
          padding: 18px 24px;
          display: grid;
          grid-template-columns: 64px 180px minmax(0, 1fr) 120px 110px;
          gap: 18px;
          align-items: center;
          text-decoration: none;
          color: inherit;
          transition: background-color .15s;
        }
        .event-row:hover { background: var(--color-grid-cell-hover); }

        .event-sev {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 22px;
          font-weight: 500;
          letter-spacing: -0.02em;
          text-align: center;
          padding: 6px 0;
          border-radius: 2px;
          line-height: 1;
        }
        .sev-cat { background: color-mix(in oklch, var(--tier-failed) 15%, transparent); color: var(--tier-failed); }
        .sev-sev { background: color-mix(in oklch, var(--tier-weak) 15%, transparent); color: var(--tier-weak); }
        .sev-sig { background: color-mix(in oklch, var(--tier-mixed) 15%, transparent); color: var(--tier-mixed); }
        .sev-mod { background: color-mix(in oklch, var(--color-text-40) 12%, transparent); color: var(--color-text-50); }
        .sev-pos { background: color-mix(in oklch, var(--tier-exceptional) 15%, transparent); color: var(--tier-exceptional); }
        .sev-pos-big { background: color-mix(in oklch, var(--tier-exceptional) 22%, transparent); color: var(--tier-exceptional); }

        .event-country { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .event-country-inline { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .event-country-name {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 17px;
          line-height: 1.1;
          color: var(--color-text-primary);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .event-country-meta {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          color: var(--color-text-30);
          letter-spacing: 0.03em;
        }
        .event-body { min-width: 0; }
        .event-cat {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--color-text-30);
          margin-bottom: 4px;
        }
        .event-head {
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-primary);
          line-height: 1.4;
          overflow: hidden;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }
        .event-impact {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 18px;
          font-weight: 500;
          letter-spacing: -0.01em;
          text-align: right;
        }
        .impact-pos { color: var(--color-source-live); }
        .impact-neg { color: var(--tier-failed); }
        .event-score-after {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          text-align: right;
          color: var(--color-text-40);
        }
        .event-score-after strong {
          color: var(--color-text-primary);
          font-weight: 500;
        }

        .ci-empty {
          padding: 80px 0;
          text-align: center;
        }
        .ci-empty-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 18px;
          color: var(--color-text-40);
          margin-bottom: 8px;
        }
        .ci-empty-sub {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-text-25);
        }
        .ci-empty a {
          font-family: var(--font-mono);
          font-size: 12px;
          color: var(--color-accent);
          text-decoration: none;
        }

        .ci-page-footer {
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid var(--color-divider);
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          align-items: center;
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.08em;
          color: var(--color-text-30);
        }
        .ci-page-footer a {
          color: var(--color-accent);
          text-decoration: none;
        }
        .ci-page-footer .footer-meta {
          margin-left: auto;
          color: var(--color-text-30);
        }

        @media (max-width: 900px) {
          .ci-hero { grid-template-columns: 1fr; gap: 24px; }
          .ci-hero-title { font-size: 40px; }
          .feed-wrap { grid-template-columns: 1fr; gap: 8px; }
          .feed-day-col {
            position: static;
            padding: 16px 0 8px;
            border-bottom: 1px solid var(--color-divider);
            display: flex;
            gap: 20px;
            align-items: baseline;
            flex-wrap: wrap;
          }
          .feed-date-count {
            border-top: none;
            padding-top: 0;
            margin-top: 0;
          }
          .event-row {
            grid-template-columns: 48px 1fr;
            padding: 14px 18px;
            gap: 12px;
          }
          .event-row > :nth-child(2) { grid-column: 1 / -1; }
          .event-row > :nth-child(3) { grid-column: 1 / -1; }
          .event-row > :nth-child(4),
          .event-row > :nth-child(5) {
            grid-column: 1 / -1;
            text-align: left;
          }
          .summary-grid { grid-template-columns: 1fr 1fr; }
        }
      `}</style>
    </main>
  );
}
