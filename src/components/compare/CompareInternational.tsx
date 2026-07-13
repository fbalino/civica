import { CompareColumnHeader } from "./CompareColumnHeader";

interface Membership {
  jurisdictionId: string;
  orgId: string;
  orgSlug: string;
  orgName: string;
  orgFullName: string | null;
  orgType: string;
  foundedYear: number | null;
  joinDate: string | Date | null;
  endDate: string | Date | null;
  role: string | null;
  status: string;
  disputed: boolean;
  sourceUrl: string | null;
  upstreamVintage: string | null;
}

export interface CompareInternationalProps {
  countries: Array<{
    jurisdiction: {
      id: string;
      slug: string;
      name: string;
      iso2: string | null;
    };
    seriesColor: string;
  }>;
  memberships: Membership[];
}

const ORG_TYPE_LABELS: Record<string, string> = {
  un: "United Nations",
  security: "Security",
  regional: "Regional",
  trade: "Trade & Economic",
  cultural: "Cultural & Linguistic",
  other: "Other",
};

const ORG_TYPE_ORDER = [
  "un",
  "security",
  "regional",
  "trade",
  "cultural",
  "other",
];

function joinYear(m: Membership): number | null {
  if (!m.joinDate) return null;
  const d = typeof m.joinDate === "string" ? new Date(m.joinDate) : m.joinDate;
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

function endYear(m: Membership): number | null {
  if (!m.endDate) return null;
  const d = typeof m.endDate === "string" ? new Date(m.endDate) : m.endDate;
  return Number.isNaN(d.getTime()) ? null : d.getUTCFullYear();
}

export function CompareInternational({
  countries,
  memberships,
}: CompareInternationalProps) {
  if (countries.length === 0) return null;
  const countryIds = countries.map((c) => c.jurisdiction.id);

  // Group memberships by org, then within each group we know which countries belong.
  const orgIndex = new Map<
    string,
    {
      orgId: string;
      orgSlug: string;
      orgName: string;
      orgType: string;
      byCountry: Map<string, Membership>;
    }
  >();
  for (const m of memberships) {
    if (!orgIndex.has(m.orgId)) {
      orgIndex.set(m.orgId, {
        orgId: m.orgId,
        orgSlug: m.orgSlug,
        orgName: m.orgName,
        orgType: m.orgType,
        byCountry: new Map(),
      });
    }
    orgIndex.get(m.orgId)!.byCountry.set(m.jurisdictionId, m);
  }

  // Group orgs by type in canonical order
  const byType = new Map<
    string,
    typeof orgIndex extends Map<string, infer V> ? V[] : never
  >();
  for (const type of ORG_TYPE_ORDER) byType.set(type, []);
  for (const org of orgIndex.values()) {
    const bucket = byType.get(org.orgType) ?? byType.get("other")!;
    bucket.push(org);
  }
  for (const bucket of byType.values()) {
    bucket.sort((a, b) => a.orgName.localeCompare(b.orgName));
  }

  const colCount = countries.length;

  if (memberships.length === 0) {
    return (
      <div className="compare-international-empty">
        International membership data not available for the selected countries.
      </div>
    );
  }

  return (
    <div className="compare-international">
      <div
        className="compare-international-header"
        style={{
          display: "grid",
          gridTemplateColumns: `minmax(200px, 1.6fr) repeat(${colCount}, minmax(0, 1fr))`,
          gap: 1,
          background: "var(--color-grid-bg)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        <div className="compare-intl-cell compare-intl-headcell" />
        {countries.map((c) => (
          <div
            key={c.jurisdiction.slug}
            className="compare-intl-cell compare-intl-headcell"
          >
            <CompareColumnHeader
              slug={c.jurisdiction.slug}
              name={c.jurisdiction.name}
              iso2={c.jurisdiction.iso2}
              seriesColor={c.seriesColor}
            />
          </div>
        ))}

        {ORG_TYPE_ORDER.map((type) => {
          const orgs = byType.get(type) ?? [];
          if (orgs.length === 0) return null;
          return [
            <div
              key={`label-${type}`}
              className="compare-intl-cell compare-intl-section-label"
              style={{ gridColumn: `span ${colCount + 1}` }}
            >
              {ORG_TYPE_LABELS[type] ?? type}
            </div>,
            ...orgs.flatMap((org) => {
              const shared = countryIds.every(
                (id) => org.byCountry.get(id)?.status === "current",
              );
              const rowCells: React.ReactNode[] = [
                <div
                  key={`${org.orgId}-name`}
                  className="compare-intl-cell compare-intl-orgname"
                  style={{
                    background: shared
                      ? "color-mix(in oklch, var(--color-accent) 8%, var(--color-bg))"
                      : "var(--color-bg)",
                  }}
                >
                  <div className="compare-intl-org-primary">{org.orgName}</div>
                  {shared && (
                    <div className="compare-intl-shared-tag">Shared</div>
                  )}
                </div>,
              ];
              for (const c of countries) {
                const m = org.byCountry.get(c.jurisdiction.id);
                const year = m ? joinYear(m) : null;
                const ended = m ? endYear(m) : null;
                rowCells.push(
                  <div
                    key={`${org.orgId}-${c.jurisdiction.slug}`}
                    className="compare-intl-cell"
                    style={{
                      background: shared
                        ? "color-mix(in oklch, var(--color-accent) 8%, var(--color-bg))"
                        : "var(--color-bg)",
                    }}
                  >
                    {m ? (
                      <span className="compare-intl-member">
                        {m.status === "current"
                          ? "Member"
                          : m.status.charAt(0).toUpperCase() +
                            m.status.slice(1)}
                        {year ? ` · ${year}${ended ? `–${ended}` : ""}` : ""}
                        {m.disputed ? " · disputed" : ""}
                        {m.sourceUrl && (
                          <>
                            {" · "}
                            <a
                              href={m.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              title={m.upstreamVintage ?? undefined}
                            >
                              Source
                            </a>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="compare-intl-nonmember">—</span>
                    )}
                  </div>,
                );
              }
              return rowCells;
            }),
          ];
        })}
      </div>
    </div>
  );
}
