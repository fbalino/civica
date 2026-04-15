"use client";

import { useState } from "react";
import { SourceDot } from "./SourceDot";
import { CountryFlag } from "./CountryFlag";

interface RankingRow {
  rank: number;
  name: string;
  slug: string;
  value: string;
  numericValue?: number;
  iso2?: string;
  source?: string;
  retrievedAt?: string;
}

interface RankingTableProps {
  title: string;
  unit?: string;
  rows: RankingRow[];
  pageSize?: number;
}

export function RankingTable({
  title,
  unit,
  rows,
  pageSize = 20,
}: RankingTableProps) {
  const [page, setPage] = useState(0);
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = [...rows].sort((a, b) => {
    const av = a.numericValue ?? 0;
    const bv = b.numericValue ?? 0;
    return sortAsc ? av - bv : bv - av;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const visible = sorted.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
        <h3
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "var(--text-20)",
            fontWeight: 400,
            letterSpacing: "var(--tracking-tight)",
            color: "var(--color-text-primary)",
          }}
        >
          {title}
        </h3>
        {unit && (
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-11)", color: "var(--color-text-30)", textTransform: "uppercase", letterSpacing: "var(--tracking-wide)" }}>
            {unit}
          </span>
        )}
      </div>

      <div
        style={{
          border: "1px solid var(--color-card-border)",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-13)" }}>
          <thead>
            <tr style={{ background: "var(--color-card-bg)", borderBottom: "1px solid var(--color-divider)" }}>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 500, color: "var(--color-text-30)", width: 48 }}>
                #
              </th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontWeight: 500, color: "var(--color-text-30)" }}>
                Country
              </th>
              <th style={{ textAlign: "right", padding: "12px 16px", fontWeight: 500, color: "var(--color-text-30)" }}>
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-text-30)", fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-13)", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  Value
                  <span style={{ fontSize: "var(--text-11)" }}>{sortAsc ? "\u2191" : "\u2193"}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={row.slug}
                style={{ borderBottom: "1px solid var(--color-stat-border)" }}
              >
                <td style={{ padding: "12px 16px", color: "var(--color-text-30)", fontVariantNumeric: "tabular-nums" }}>
                  {page * pageSize + i + 1}
                </td>
                <td style={{ padding: "12px 16px" }}>
                  <a
                    href={`/countries/${row.slug}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      color: "var(--color-text-primary)",
                      textDecoration: "none",
                    }}
                  >
                    <CountryFlag iso2={row.iso2 ?? null} size={20} />
                    {row.name}
                  </a>
                </td>
                <td style={{ padding: "12px 16px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500, color: "var(--color-text-primary)" }}>
                  {row.value}
                  {row.source && row.retrievedAt && (
                    <SourceDot source={row.source} retrievedAt={row.retrievedAt} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 }}>
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            style={{
              padding: "6px 12px",
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-card-border)",
              color: "var(--color-text-40)",
              background: "none",
              cursor: page === 0 ? "not-allowed" : "pointer",
              opacity: page === 0 ? 0.4 : 1,
            }}
          >
            Previous
          </button>
          <span style={{ fontFamily: "var(--font-mono)", fontWeight: "var(--font-weight-mono)", fontSize: "var(--text-12)", color: "var(--color-text-30)", fontVariantNumeric: "tabular-nums" }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            style={{
              padding: "6px 12px",
              fontFamily: "var(--font-mono)",
              fontWeight: "var(--font-weight-mono)",
              fontSize: "var(--text-12)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-card-border)",
              color: "var(--color-text-40)",
              background: "none",
              cursor: page === totalPages - 1 ? "not-allowed" : "pointer",
              opacity: page === totalPages - 1 ? 0.4 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
