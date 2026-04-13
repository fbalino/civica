"use client";

import { useState } from "react";
import { SourceDot } from "./SourceDot";

interface RankingRow {
  rank: number;
  name: string;
  slug: string;
  value: string;
  numericValue?: number;
  flagUrl?: string;
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
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-heading text-xl font-medium tracking-tight">
          {title}
        </h3>
        {unit && (
          <span className="text-xs text-[var(--color-text-tertiary)] uppercase tracking-wide">
            {unit}
          </span>
        )}
      </div>

      <div className="border border-[var(--color-border)] rounded-[var(--radius-lg)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
              <th className="text-left py-3 px-4 font-medium text-[var(--color-text-tertiary)] w-12">
                #
              </th>
              <th className="text-left py-3 px-4 font-medium text-[var(--color-text-tertiary)]">
                Country
              </th>
              <th className="text-right py-3 px-4 font-medium text-[var(--color-text-tertiary)]">
                <button
                  onClick={() => setSortAsc(!sortAsc)}
                  className="inline-flex items-center gap-1 hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Value
                  <span className="text-xs">{sortAsc ? "\u2191" : "\u2193"}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <tr
                key={row.slug}
                className="border-b border-[var(--color-border-muted)] last:border-b-0 hover:bg-[var(--color-surface-alt)] transition-colors"
              >
                <td className="py-3 px-4 text-[var(--color-text-tertiary)] tabular-nums">
                  {page * pageSize + i + 1}
                </td>
                <td className="py-3 px-4">
                  <a
                    href={`/countries/${row.slug}`}
                    className="flex items-center gap-3 text-[var(--color-text-primary)] hover:text-[var(--color-accent-text)] no-underline transition-colors"
                  >
                    {row.flagUrl && (
                      <img
                        src={row.flagUrl}
                        alt=""
                        className="w-6 h-4 object-cover rounded-sm"
                      />
                    )}
                    {row.name}
                  </a>
                </td>
                <td className="py-3 px-4 text-right tabular-nums font-medium text-[var(--color-text-primary)]">
                  {row.value}
                  {row.source && row.retrievedAt && (
                    <SourceDot
                      source={row.source}
                      retrievedAt={row.retrievedAt}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--color-text-tertiary)] tabular-nums">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1.5 text-sm rounded-[var(--radius-md)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-alt)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
