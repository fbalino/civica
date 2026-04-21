import type { Metadata } from "next";
import Link from "next/link";
import { getPulseChangelog } from "@/lib/db/queries";
import { CountryFlag } from "@/components/CountryFlag";

export const metadata: Metadata = {
  title: "Civica Pulse Changelog — Global Governance Events",
  description:
    "A live feed of governance events worldwide, scored for severity and impact on Civica Pulse scores.",
  alternates: { canonical: "https://civicaatlas.org/index/changelog" },
};

function severityColor(severity: number): string {
  if (severity >= 3) return "oklch(52% 0.20 25)";
  if (severity >= 1) return "oklch(60% 0.17 45)";
  if (severity <= -3) return "oklch(52% 0.18 145)";
  if (severity <= -1) return "oklch(52% 0.14 145)";
  return "var(--color-text-30)";
}

function severityLabel(severity: number): string {
  if (severity >= 3) return "Major negative";
  if (severity >= 1) return "Negative";
  if (severity <= -3) return "Major positive";
  if (severity <= -1) return "Positive";
  return "Neutral";
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function categoryLabel(cat: string): string {
  return cat
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
}

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const countryFilter =
    typeof sp?.country === "string" ? sp.country : undefined;

  let events: PulseEvent[] = [];
  try {
    const result = await getPulseChangelog(countryFilter, 100, 0);
    const res = result as unknown as { rows: PulseEvent[] };
    events = res.rows ?? [];
  } catch {
    // DB not seeded
  }

  return (
    <div
      style={{
        maxWidth: "var(--max-w-content, 720px)",
        margin: "0 auto",
        padding: "var(--spacing-section-y) var(--spacing-page-x)",
      }}
    >
      <nav
        style={{
          fontFamily: "var(--font-mono)",
          fontWeight: "var(--font-weight-mono)",
          fontSize: "var(--text-11)",
          color: "var(--color-text-30)",
          marginBottom: 32,
        }}
      >
        <Link
          href="/index"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          Civica Index
        </Link>
        <span style={{ margin: "0 8px", color: "var(--color-text-20)" }}>
          /
        </span>
        Pulse Changelog
      </nav>

      <header style={{ marginBottom: 40 }}>
        <h1 className="page-heading">Pulse Changelog</h1>
        <p
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "var(--text-18)",
            color: "var(--color-text-60)",
            lineHeight: 1.5,
            maxWidth: 560,
          }}
        >
          A global feed of governance events that impact Civica Pulse scores.
        </p>
      </header>

      {countryFilter && (
        <div
          style={{
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-40)",
            }}
          >
            Filtered: {countryFilter}
          </span>
          <Link
            href="/index/changelog"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-11)",
              color: "var(--color-accent)",
              textDecoration: "none",
            }}
          >
            Show all
          </Link>
        </div>
      )}

      {events.length > 0 ? (
        <div style={{ display: "grid", gap: 0 }}>
          {events.map((event, i) => {
            const showDateHeader =
              i === 0 || events[i - 1].eventDate !== event.eventDate;
            return (
              <div key={event.id}>
                {showDateHeader && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontWeight: "var(--font-weight-mono)",
                      fontSize: "var(--text-11)",
                      color: "var(--color-text-30)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "20px 0 8px",
                      borderBottom: "1px solid var(--color-divider)",
                      marginTop: i === 0 ? 0 : 16,
                    }}
                  >
                    {formatDate(event.eventDate)}
                  </div>
                )}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "4px 1fr",
                    gap: 16,
                    padding: "16px 0",
                    borderBottom: "1px solid var(--color-card-border)",
                  }}
                >
                  {/* Severity bar */}
                  <div
                    style={{
                      width: 4,
                      borderRadius: 2,
                      background: severityColor(event.severity),
                      minHeight: 40,
                    }}
                  />

                  <div>
                    {/* Header row */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <Link
                        href={`/index/${event.slug}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          textDecoration: "none",
                          color: "inherit",
                        }}
                      >
                        <CountryFlag iso2={event.iso2} size={18} />
                        <span
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontWeight: 500,
                            fontSize: "var(--text-13)",
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {event.countryName}
                        </span>
                      </Link>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: "var(--font-weight-mono)",
                          fontSize: "var(--text-10)",
                          padding: "2px 6px",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--color-card-bg)",
                          border: "1px solid var(--color-card-border)",
                          color: "var(--color-text-40)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {categoryLabel(event.category)}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: "var(--font-weight-mono)",
                          fontSize: "var(--text-10)",
                          color: severityColor(event.severity),
                        }}
                      >
                        {severityLabel(event.severity)} ({event.severity > 0 ? "+" : ""}{event.severity.toFixed(1)})
                      </span>
                    </div>

                    {/* Headline */}
                    <p
                      style={{
                        fontFamily: "var(--font-body, var(--font-sans))",
                        fontSize: "var(--text-14)",
                        lineHeight: 1.5,
                        color: "var(--color-text-60)",
                        margin: "0 0 6px",
                      }}
                    >
                      {event.headline}
                    </p>

                    {/* Meta */}
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                        fontFamily: "var(--font-mono)",
                        fontWeight: "var(--font-weight-mono)",
                        fontSize: "var(--text-10)",
                        color: "var(--color-text-25)",
                      }}
                    >
                      {event.confidence < 0.7 && (
                        <span title="Low confidence classification">
                          Confidence: {(event.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      {event.sourceUrl && (
                        <a
                          href={event.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            color: "var(--color-accent)",
                            textDecoration: "none",
                          }}
                        >
                          {event.sourceName ?? "Source"}
                        </a>
                      )}
                      {!event.isActive && (
                        <span style={{ color: "var(--color-text-20)" }}>
                          Expired
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            padding: "80px 0",
            textAlign: "center",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "var(--text-18)",
              color: "var(--color-text-40)",
              marginBottom: 8,
            }}
          >
            No Pulse events recorded yet.
          </p>
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-12)",
              color: "var(--color-text-25)",
            }}
          >
            Events will appear here once the Pulse pipeline is active.
          </p>
        </div>
      )}

      <footer
        style={{
          marginTop: 40,
          borderTop: "1px solid var(--color-divider)",
          paddingTop: 24,
          display: "flex",
          gap: 24,
          flexWrap: "wrap",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-11)",
          color: "var(--color-text-25)",
        }}
      >
        <Link
          href="/index"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          Back to rankings
        </Link>
        <Link
          href="/index/methodology"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          Methodology
        </Link>
        <Link
          href="/index/government-types"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          By government type
        </Link>
      </footer>
    </div>
  );
}
