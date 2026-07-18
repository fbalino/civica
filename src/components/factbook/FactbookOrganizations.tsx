import Link from "next/link";
import {
  getCountryOrganizationsData,
  type CountryOrganizationsData,
  type OrgMembershipDetail,
} from "@/lib/db/queries-organizations";
import { SourceDot } from "@/components/SourceDot";
import { Banner } from "@/components/editorial/Banner";
import "@/app/organizations-section.css";

interface FactbookOrganizationsProps {
  jurisdictionId: string;
  countryName: string;
  /** Wikidata source last_sync_at (ISO) for the section's SourceDot. */
  retrievedAt?: string | null;
  /** A route-level prefetch preserves an outage separately from no memberships. */
  initialData?: CountryOrganizationsData | null;
}

const ORG_TYPE_LABELS: Record<string, string> = {
  un: "United Nations & Agencies",
  security: "Security Alliances",
  regional: "Regional Blocs",
  trade: "Trade & Economic",
  cultural: "Cultural & Linguistic",
  other: "Other",
};

const ORG_TYPE_COLORS: Record<string, string> = {
  un: "var(--cat-un)",
  security: "var(--cat-security)",
  regional: "var(--cat-regional)",
  trade: "var(--cat-trade)",
  cultural: "var(--cat-cultural)",
  other: "var(--color-text-40)",
};

const ORG_TYPE_ORDER = [
  "un",
  "security",
  "regional",
  "trade",
  "cultural",
  "other",
];

// Curated, encyclopedic one-line scope notes keyed by the DB org slug. These
// are factual reference descriptions (the same register as the descriptions
// already shipping on /organizations) — NOT generated values. An org without
// an entry simply renders no scope line.
const ORG_DESCRIPTIONS: Record<string, string> = {
  "united-nations":
    "Global intergovernmental body for peace, security, human rights, and development.",
  "un-security-council":
    "The 15-member Council charged with maintaining international peace and security.",
  who: "UN specialised agency directing and coordinating international public health.",
  unesco:
    "UN agency for cooperation in education, science, culture, and communication.",
  iaea: "UN-affiliated agency promoting peaceful nuclear use and safeguarding against proliferation.",
  nato: "Transatlantic military alliance founded on collective defence.",
  "european-union":
    "Political and economic union of European states with a single market.",
  eurozone:
    "The bloc of EU states that have adopted the euro as their currency.",
  "council-of-europe":
    "Pan-European body upholding human rights, democracy, and the rule of law.",
  asean: "Political and economic union of Southeast Asian states.",
  "african-union":
    "Continental union of African states for political and economic integration.",
  ecowas: "Regional economic and political bloc of West African states.",
  gcc: "Regional union of Arab states bordering the Persian Gulf.",
  wto: "Global body that regulates and facilitates international trade.",
  imf: "International organisation that promotes monetary cooperation and financial stability.",
  oecd: "Forum of market economies coordinating economic and social policy.",
  g7: "Forum of seven major advanced economies coordinating global economic policy.",
  g20: "Forum of major advanced and emerging economies for international economic cooperation.",
  "la-francophonie":
    "Organisation of states and governments that share the French language.",
};

const ROLE_CHIP_CLASS: Record<string, string> = {
  founding: "editorial-chip--accent",
  permanent: "editorial-chip--blue",
  observer: "editorial-chip--sand",
};

function roleLabel(orgType: string, role: string | null): string | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (orgType === "un" && r === "permanent") return "Permanent (P5)";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function membershipYear(joinDate: string | null): number | null {
  if (!joinDate) return null;
  const d = new Date(joinDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

export async function FactbookOrganizations({
  jurisdictionId,
  countryName,
  initialData,
}: FactbookOrganizationsProps) {
  let data: CountryOrganizationsData;
  if (initialData === null) {
    return (
      <Banner variant="warn">
        International-organization memberships are temporarily unavailable.
        Civica is not treating this as evidence that {countryName} belongs to
        no organizations.
      </Banner>
    );
  }
  if (initialData !== undefined) {
    data = initialData;
  } else {
    try {
      data = await getCountryOrganizationsData(jurisdictionId);
    } catch {
      return (
        <Banner variant="warn">
          International-organization memberships are temporarily unavailable.
          Civica is not treating this as evidence that {countryName} belongs
          to no organizations.
        </Banner>
      );
    }
  }
  const { memberships, hostsOrgs } = data;

  if (memberships.length === 0) {
    return (
      <p className="org-section-empty">
        No source-backed international-organization memberships have been
        compiled for {countryName} yet. This is not a non-membership claim.
      </p>
    );
  }

  // Group by org type, preserving the canonical order.
  const byType = new Map<string, OrgMembershipDetail[]>();
  for (const m of memberships) {
    const type = ORG_TYPE_ORDER.includes(m.orgType) ? m.orgType : "other";
    const list = byType.get(type) ?? [];
    list.push(m);
    byType.set(type, list);
  }

  const currentMemberships = memberships.filter((m) => m.status === "current");
  const historicalMemberships = memberships.filter(
    (m) => m.status !== "current",
  );
  const accessionYears = currentMemberships
    .map((m) => membershipYear(m.joinDate))
    .filter((y): y is number => y != null);
  const earliestAccession =
    accessionYears.length > 0 ? Math.min(...accessionYears) : null;
  const foundingCount = currentMemberships.filter(
    (m) => (m.role ?? "").toLowerCase() === "founding",
  ).length;

  return (
    <>
      {/* Summary band */}
      <div id="organizations--summary" className="org-stats">
        <div className="org-stat">
          <div className="org-stat-k">Current memberships</div>
          <div className="org-stat-v">{currentMemberships.length}</div>
        </div>
        {historicalMemberships.length > 0 && (
          <div className="org-stat">
            <div className="org-stat-k">Historical relationships</div>
            <div className="org-stat-v">{historicalMemberships.length}</div>
          </div>
        )}
        <div className="org-stat">
          <div className="org-stat-k">Founding member of</div>
          <div className="org-stat-v">{foundingCount}</div>
        </div>
        <div className="org-stat">
          <div className="org-stat-k">Earliest accession</div>
          <div className="org-stat-v">{earliestAccession ?? "—"}</div>
        </div>
        {hostsOrgs.length > 0 && (
          <div className="org-stat">
            <div className="org-stat-k">Hosts HQ of</div>
            <div className="org-stat-v">{hostsOrgs.length}</div>
            <div className="org-stat-note">
              {hostsOrgs.map((o, i) => (
                <span key={o.slug}>
                  {i > 0 ? ", " : ""}
                  <Link href={`/organizations/${o.slug}`}>{o.name}</Link>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grouped membership list — category headers → one row per org.
          Each row: name (+ full name), role chip, accession year, and a
          one-line purpose where a curated scope note exists. The full-width
          tab gives the rows room the old card grid couldn't use well. */}
      <div id="organizations--list" className="org-groups">
        {ORG_TYPE_ORDER.map((type) => {
          const items = byType.get(type);
          if (!items || items.length === 0) return null;
          const color = ORG_TYPE_COLORS[type] ?? ORG_TYPE_COLORS.other;
          return (
            <section key={type} className="org-group">
              <header className="org-group-head" style={{ color }}>
                <span
                  className="org-group-dot"
                  style={{ background: color }}
                  aria-hidden
                />
                <span className="org-group-label">
                  {ORG_TYPE_LABELS[type] ?? type}
                </span>
                <span className="org-group-count">{items.length}</span>
              </header>

              <ul className="org-rows">
                {items.map((m) => {
                  const year = membershipYear(m.joinDate);
                  const rLabel = roleLabel(m.orgType, m.role);
                  const rClass = m.role
                    ? (ROLE_CHIP_CLASS[m.role.toLowerCase()] ?? "")
                    : "";
                  const desc = ORG_DESCRIPTIONS[m.orgSlug] ?? null;
                  const endYear = membershipYear(m.endDate);
                  const statusLabel =
                    m.status === "current"
                      ? rLabel
                      : m.status.charAt(0).toUpperCase() + m.status.slice(1);
                  const statusClass =
                    m.status === "current" ? rClass : "editorial-chip--sand";

                  return (
                    <li
                      key={m.orgId}
                      className={`org-row${m.status === "current" ? "" : " org-row--historical"}`}
                    >
                      <span
                        className="org-row-dot"
                        style={{ background: color }}
                        aria-hidden
                      />
                      <div className="org-row-main">
                        <div className="org-row-title">
                          {m.orgSlug ? (
                            <Link
                              href={`/organizations/${m.orgSlug}`}
                              className="org-row-name"
                            >
                              {m.orgName}
                            </Link>
                          ) : (
                            <span className="org-row-name">{m.orgName}</span>
                          )}
                          {m.orgFullName && m.orgFullName !== m.orgName && (
                            <span className="org-row-full">
                              {m.orgFullName}
                            </span>
                          )}
                        </div>
                        {desc && <p className="org-row-desc">{desc}</p>}
                        <p className="org-row-source">
                          {m.disputed && "Disputed · "}
                          {m.role &&
                            m.status !== "current" &&
                            `${roleLabel(m.orgType, m.role)} · `}
                          <a
                            href={m.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Source
                          </a>
                          {` · ${m.upstreamVintage}`}
                        </p>
                      </div>
                      {statusLabel ? (
                        <span
                          className={`editorial-chip ${statusClass} org-row-chip`}
                        >
                          {statusLabel}
                        </span>
                      ) : (
                        <span aria-hidden className="org-row-chip" />
                      )}
                      <span className="org-row-year">
                        {year != null && endYear != null
                          ? `${year}–${endYear}`
                          : year != null
                            ? year
                            : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <div className="org-section-source">
        <SourceDot
          source="civica_organization_roster_v1"
          retrievedAt={memberships[0]?.sourceRetrievedAt ?? null}
        />
        <span>
          Only source-backed relationships are shown. Some organization rosters
          are intentionally partial; absence is not evidence of non-membership.
        </span>
      </div>
    </>
  );
}
