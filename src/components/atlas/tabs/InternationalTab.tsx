"use client";

import type { Country } from "../data";
import {
  ORG_TYPE_COLOR,
  ORG_TYPE_LABEL,
  type OrgType,
} from "../organizations";

export interface InternationalMembership {
  orgId: string;
  orgSlug: string;
  orgName: string;
  orgFullName: string;
  type: OrgType;
  joinYear: number | null;
  role: string | null;
}

export interface InternationalCoMember {
  id: string;
  name: string;
  slug: string;
  sharedCount: number;
}

export interface InternationalData {
  country: string;
  countryId: string;
  memberships: InternationalMembership[];
  coMembers: InternationalCoMember[];
}

export interface InternationalTabProps {
  active: boolean;
  loading: boolean;
  country: Country;
  data: InternationalData | null;
  onPickOrg: (slug: string) => void;
  onPickCountry: (slug: string) => void;
}

const ORDER: OrgType[] = ["un", "security", "regional", "trade", "cultural"];

export function InternationalTab({
  active,
  loading,
  country,
  data,
  onPickOrg,
  onPickCountry,
}: InternationalTabProps) {
  return (
    <div className={`atlas-pane${active ? " on" : ""}`}>
      {loading && active ? (
        <div
          className="atlas-mono"
          style={{
            fontSize: 11,
            color: "var(--atlas-muted)",
            padding: "40px 0",
            textAlign: "center",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Loading&hellip;
        </div>
      ) : data && data.memberships.length > 0 ? (
        <InternationalPanel
          data={data}
          country={country}
          onPickOrg={onPickOrg}
          onPickCountry={onPickCountry}
        />
      ) : (
        <div className="intl-empty">
          <div className="atlas-serif" style={{ fontSize: 22, marginBottom: 6 }}>
            No international memberships recorded
          </div>
          <div
            className="atlas-sans"
            style={{ fontSize: 13, color: "var(--atlas-muted)" }}
          >
            This country does not appear in the curated international
            organisations dataset yet.
          </div>
        </div>
      )}
    </div>
  );
}

function InternationalPanel({
  data,
  country,
  onPickOrg,
  onPickCountry,
}: {
  data: InternationalData;
  country: Country;
  onPickOrg: (slug: string) => void;
  onPickCountry: (slug: string) => void;
}) {
  const grouped = new Map<OrgType, InternationalMembership[]>();
  for (const m of data.memberships) {
    const list = grouped.get(m.type) ?? [];
    list.push(m);
    grouped.set(m.type, list);
  }
  const oldestYear = data.memberships.reduce<number | null>(
    (acc, m) =>
      m.joinYear != null && (acc == null || m.joinYear < acc) ? m.joinYear : acc,
    null,
  );
  const foundingCount = data.memberships.filter(
    (m) => (m.role ?? "").toLowerCase() === "founding",
  ).length;

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div
          className="atlas-mono"
          style={{
            fontSize: 10,
            color: "var(--atlas-muted)",
            letterSpacing: ".14em",
            textTransform: "uppercase",
          }}
        >
          {country.name.toUpperCase()} &middot; INTERNATIONAL FOOTPRINT
        </div>
        <div
          className="atlas-serif"
          style={{
            fontSize: 36,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            marginTop: 4,
          }}
        >
          Where {country.name} sits in the world
        </div>
        <div
          className="atlas-sans"
          style={{ fontSize: 13, color: "var(--atlas-ink-2)", marginTop: 6 }}
        >
          Memberships in intergovernmental organizations, alliances, and
          cultural blocs.
        </div>
      </div>

      <div className="intl-stats">
        <div className="cell">
          <div className="k">Memberships</div>
          <div className="v">{data.memberships.length}</div>
        </div>
        <div className="cell">
          <div className="k">Founding member of</div>
          <div className="v">{foundingCount}</div>
        </div>
        <div className="cell">
          <div className="k">Earliest accession</div>
          <div className="v">{oldestYear ?? "—"}</div>
        </div>
      </div>

      {data.coMembers.length > 0 && (
        <>
          <div className="intl-section-head">
            Closest partners <span>by shared memberships</span>
          </div>
          <div className="intl-panel" style={{ padding: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                gap: 8,
              }}
            >
              {data.coMembers.map((cm) => (
                <div
                  key={cm.id}
                  onClick={() => onPickCountry(cm.slug)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    border: "1px solid var(--atlas-rule-2)",
                    background: "var(--atlas-paper-2)",
                    cursor: "pointer",
                  }}
                  className="atlas-sans"
                >
                  <span style={{ fontSize: 13, color: "var(--atlas-ink)" }}>
                    {cm.name}
                  </span>
                  <span
                    className="atlas-mono"
                    style={{ fontSize: 10, color: "var(--atlas-muted)" }}
                  >
                    {cm.sharedCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="intl-section-head">
        Memberships <span>grouped by type, oldest first</span>
      </div>
      <div className="intl-mem-list">
        {ORDER.map((t) => {
          const items = grouped.get(t);
          if (!items || items.length === 0) return null;
          return (
            <div key={t} className="intl-mem-group">
              <div className="group-head" style={{ color: ORG_TYPE_COLOR[t] }}>
                <span
                  className="dot"
                  style={{ background: ORG_TYPE_COLOR[t] }}
                />
                {ORG_TYPE_LABEL[t]}
                <span className="count">{items.length}</span>
              </div>
              {items.map((m) => {
                const role = (m.role ?? "").toLowerCase();
                const isP5 = m.type === "un" && role === "permanent";
                const badgeClass =
                  role === "founding"
                    ? "role-badge founding"
                    : isP5
                      ? "role-badge p5"
                      : role === "observer"
                        ? "role-badge observer"
                        : role
                          ? "role-badge"
                          : "";
                return (
                  <div
                    key={m.orgId}
                    className="intl-mem-row"
                    onClick={() => onPickOrg(m.orgSlug)}
                  >
                    <span
                      className="dot"
                      style={{ background: ORG_TYPE_COLOR[t] }}
                    />
                    <span className="name" title={m.orgFullName}>
                      {m.orgName}
                      <span className="full">{m.orgFullName}</span>
                    </span>
                    <span className="year">{m.joinYear ?? "—"}</span>
                    {m.role && (
                      <span className={badgeClass}>
                        {isP5 ? "P5" : m.role}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
