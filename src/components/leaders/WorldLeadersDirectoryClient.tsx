"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Banner } from "@/components/editorial/Banner";
import { Chip } from "@/components/editorial/Pill";
import {
  SortableDataTable,
  type SortableColumn,
} from "@/components/editorial/SortableDataTable";
import { SearchField } from "@/components/editorial/SearchField";
import { SourceDot } from "@/components/SourceDot";
import type { LeaderDirectoryRow } from "@/lib/leaders/directory";

function roleLabel(role: LeaderDirectoryRow["officeType"]) {
  return role === "head_of_state" ? "Head of state" : "Head of government";
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

export function WorldLeadersDirectoryClient({
  rows,
}: {
  rows: LeaderDirectoryRow[];
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | LeaderDirectoryRow["officeType"]>(
    "all",
  );
  const [continent, setContinent] = useState("all");
  const continents = useMemo(
    () =>
      [...new Set(rows.map((row) => row.continent).filter(Boolean) as string[])]
        .sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("en");
    return rows.filter((row) => {
      if (role !== "all" && row.officeType !== role) return false;
      if (continent !== "all" && row.continent !== continent) return false;
      if (!needle) return true;
      return [
        row.personName,
        row.jurisdictionName,
        row.officeName,
      ].some((value) => value.toLocaleLowerCase("en").includes(needle));
    });
  }, [continent, query, role, rows]);

  const columns: SortableColumn<LeaderDirectoryRow>[] = [
    {
      id: "person",
      label: "Officeholder",
      sortValue: (row) => row.personName,
      render: (row) => (
        <div>
          <Link href={`/country/${row.jurisdictionSlug}/civica-data#leaders`}>
            {row.personName}
          </Link>
          <div className="editorial-card-pills">
            {row.leadershipCapacity !== "source_not_specified" ? (
              <Chip variant="sand">{row.leadershipCapacity}</Chip>
            ) : null}
            {row.coLeadership ? <Chip variant="blue">co-leadership</Chip> : null}
            {row.dualOffice ? <Chip variant="sage">dual office</Chip> : null}
          </div>
        </div>
      ),
    },
    {
      id: "country",
      label: "Country or area",
      sortValue: (row) => row.jurisdictionName,
      render: (row) => (
        <Link href={`/country/${row.jurisdictionSlug}`}>
          {row.jurisdictionName}
        </Link>
      ),
    },
    {
      id: "office",
      label: "Office",
      sortValue: (row) => roleLabel(row.officeType),
      render: (row) => (
        <>
          <span>{row.officeName}</span>
          <br />
          <span className="editorial-meta">{roleLabel(row.officeType)}</span>
        </>
      ),
    },
    {
      id: "start",
      label: "Current term from",
      sortValue: (row) => row.startDate,
      render: (row) => formatDate(row.startDate),
    },
    {
      id: "source",
      label: "Evidence",
      sortValue: (row) => row.sourceRetrievedAt,
      render: (row) => (
        <span>
          <SourceDot
            source={row.sourceId}
            retrievedAt={row.sourceRetrievedAt}
            upstreamVintage={null}
          />{" "}
          <a href={row.sourceUrl} target="_blank" rel="noreferrer noopener">
            Wikidata
          </a>
          <br />
          <span className="editorial-meta">
            Retrieved {formatDate(row.sourceRetrievedAt)}
          </span>
          <br />
          <a
            href={`/api/citations/person/${row.personId}`}
            target="_blank"
            rel="noreferrer"
          >
            Stable record
          </a>
        </span>
      ),
    },
  ];

  return (
    <>
      <div className="editorial-filter-bar">
        <SearchField
          label="Search leaders, countries, or offices"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search leaders, countries, or offices…"
        />
        <div className="editorial-filter-row">
          <label className="editorial-filter-form">
            <span className="editorial-filter-label">Role</span>
            <select
              value={role}
              onChange={(event) =>
                setRole(
                  event.target.value as
                    | "all"
                    | LeaderDirectoryRow["officeType"],
                )
              }
            >
              <option value="all">All principal roles</option>
              <option value="head_of_state">Head of state</option>
              <option value="head_of_government">Head of government</option>
            </select>
          </label>
          <label className="editorial-filter-form">
            <span className="editorial-filter-label">Region</span>
            <select
              value={continent}
              onChange={(event) => setContinent(event.target.value)}
            >
              <option value="all">All regions</option>
              {continents.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <p className="editorial-meta" role="status" aria-live="polite">
        Showing {filtered.length.toLocaleString("en")} of{" "}
        {rows.length.toLocaleString("en")} verified current office records.
      </p>
      {filtered.length ? (
        <div className="editorial-table-scroll">
          <SortableDataTable
            rows={filtered}
            columns={columns}
            getRowKey={(row) => row.termId}
            initialSort={{ columnId: "country", direction: "asc" }}
            caption="Verified current heads of state and heads of government"
          />
        </div>
      ) : (
        <Banner variant="info">
          No verified current office record matches these filters.
        </Banner>
      )}
    </>
  );
}
