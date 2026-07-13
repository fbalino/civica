"use client";

/**
 * PartyExplorer — the interactive client for /parties. It owns the filter state
 * and drives BOTH the ideology compass and the sortable party table from one
 * server-fetched list (no client fetching): filtering narrows the compass and
 * the table together.
 *
 * (Named PartyExplorer, not PartyBrowser, to stay distinct from the per-country
 * hemicycle `src/components/factbook/PartyBrowser.tsx`.)
 *
 * PROVENANCE IS LOAD-BEARING (resolution §5): a party with no DISPLAYABLE
 * V-Party position — none recorded, a fuzzy 'review' match, or a party in a
 * one-party / non-competitive legislature — is shown in the table with an honest
 * "Ideology not recorded" chip and is never plotted on the compass. Nothing is
 * fabricated. Per-metric SourceDots mark seats and positions (V-Party)
 * distinctly. The seats SourceDot reads each party's REAL recorded source
 * (`party.seatsSource`, resolved server-side from the `statements` row
 * `writeLegislatureComposition` writes per chamber) — IPU Parline and the
 * Wikidata fallback sync populate different, non-overlapping chambers, so the
 * source is never assumed to be a single fixed id. A chamber with no recorded
 * `statements` row (legacy pre-provenance seed data) renders an honest
 * "Source not recorded" chip instead of a SourceDot — never a fabricated one.
 *
 * Controls reuse the SAME primitives as the conditions / government-type pages:
 * the shared canonical `SingleSelectMenu`, the canonical SortableDataTable,
 * Chip, CountryFlag, and SourceDot. No new control styling is invented here.
 *
 * The full ~1,548-row list is paginated (PAGE_SIZE below) so the initial DOM
 * stays small; the compass always reflects the ENTIRE filtered set, not just the
 * current page, and every row stays reachable via the pager.
 */

import { useMemo, useRef, useState, useEffect } from "react";
import { IdeologyCompass, type CompassParty } from "./IdeologyCompass";
import { SortableDataTable, type SortableColumn } from "@/components/editorial/SortableDataTable";
import {
  SingleSelectMenu,
  type SingleSelectItem,
} from "@/components/editorial/SingleSelectMenu";
import { Chip } from "@/components/editorial/Pill";
import { Button } from "@/components/editorial/Button";
import { CountryFlag } from "@/components/CountryFlag";
import { SourceDot } from "@/components/SourceDot";
import { ideologyLabelForEconLR } from "@/lib/parties/ideology-labels";
import type { BrowserParty } from "@/lib/db/queries-parties";

interface PartyExplorerProps {
  parties: BrowserParty[];
  countries: { name: string; slug: string; region: string | null }[];
  regions: string[];
  /** Coverage aggregates for the honest compass caption. */
  coverage: {
    totalParties: number;
    partiesWithPosition: number;
    totalSeats: number;
    seatsWithPosition: number;
  };
  /**
   * `sources.last_sync_at` (ISO) for V-Party (`vparty`), the single ideology
   * source. Seats have no equivalent single-source prop — each row carries its
   * own real `seatsSource` (see `BrowserParty`), because IPU Parline and the
   * Wikidata fallback sync populate different chambers.
   */
  positionsSyncedAt: string | null;
}

const ALL = "__all__";

// Default rows rendered before "Show all" — bounds the initial DOM (the full
// list is ~1,548 rows / ~72,000px tall unvirtualized). The compass always uses
// the FULL filtered set; only the table body is capped.
const PAGE_SIZE = 100;

// ─── Coalition + ideology cell renderers ─────────────────────────────────────

function CoalitionChip({ ruling }: { ruling: boolean }) {
  return ruling ? (
    <Chip variant="sage" size="sm">
      In government
    </Chip>
  ) : (
    <Chip variant="neutral" size="sm">
      Opposition
    </Chip>
  );
}

function IdeologyCell({ party }: { party: BrowserParty }) {
  if (!party.position) {
    // Honest gap treatment — never a fabricated position.
    return (
      <span className="parties-cell-ideology">
        <Chip variant="neutral" size="sm">
          Ideology not recorded
        </Chip>
      </span>
    );
  }
  const { tone, label } = ideologyLabelForEconLR(party.position.economicLR);
  return (
    <span className="parties-cell-ideology">
      <Chip variant={tone} size="sm">
        {label}
      </Chip>
    </span>
  );
}

/**
 * Seats/coalition provenance for one party row. Reads the REAL per-chamber
 * source recorded in `statements` (`party.seatsSource` — resolved by
 * `getPartiesForBrowser`), never a hardcoded sync id: IPU Parline and the
 * Wikidata fallback sync populate different chambers, so assuming one source
 * for every row would misattribute roughly half of them. A chamber with no
 * recorded `statements` row (legacy pre-provenance seed data) renders an
 * honest "Source not recorded" chip — never a fabricated SourceDot.
 */
function SeatsSourceCell({ party }: { party: BrowserParty }) {
  if (!party.seatsSource) {
    return (
      <Chip variant="neutral" size="sm">
        Source not recorded
      </Chip>
    );
  }
  return (
    <SourceDot
      source={party.seatsSource.id}
      retrievedAt={party.seatsSource.retrievedAt}
    />
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

export function PartyExplorer({
  parties,
  countries,
  regions,
  coverage,
  positionsSyncedAt,
}: PartyExplorerProps) {
  const [region, setRegion] = useState<string>(ALL);
  const [countrySlug, setCountrySlug] = useState<string>(ALL);
  const [coalition, setCoalition] = useState<string>(ALL);
  const [onlyWithIdeology, setOnlyWithIdeology] = useState<boolean>(false);
  const [openMenu, setOpenMenu] = useState<
    null | "region" | "country" | "coalition"
  >(null);
  // Table pagination — keeps the initial DOM small (default page below).
  const [showAll, setShowAll] = useState<boolean>(false);

  const menusRef = useRef<HTMLDivElement>(null);

  // Close open menu on outside click / Escape.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (menusRef.current?.contains(e.target as Node)) return;
      setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  // Countries available under the region filter (so the country picker only
  // offers countries in the chosen region).
  const countryItems = useMemo<SingleSelectItem[]>(() => {
    const list = countries
      .filter((c) => region === ALL || c.region === region)
      .map((c) => ({ value: c.slug, label: c.name }));
    return [{ value: ALL, label: "All countries" }, ...list];
  }, [countries, region]);

  const regionItems = useMemo<SingleSelectItem[]>(
    () => [
      { value: ALL, label: "All regions" },
      ...regions.map((r) => ({ value: r, label: r })),
    ],
    [regions],
  );

  const coalitionItems: SingleSelectItem[] = useMemo(
    () => [
      { value: ALL, label: "All parties" },
      { value: "ruling", label: "In government" },
      { value: "opposition", label: "Opposition" },
    ],
    [],
  );

  // Apply the filters over the single server-fetched list — drives BOTH views.
  const filtered = useMemo(() => {
    return parties.filter((p) => {
      if (region !== ALL && p.country.region !== region) return false;
      if (countrySlug !== ALL && p.country.slug !== countrySlug) return false;
      if (coalition === "ruling" && !p.isRulingCoalition) return false;
      if (coalition === "opposition" && p.isRulingCoalition) return false;
      if (onlyWithIdeology && !p.position) return false;
      return true;
    });
  }, [parties, region, countrySlug, coalition, onlyWithIdeology]);

  // Reset to the first page whenever the filter set changes, so a narrowed view
  // never opens already-expanded to thousands of rows.
  useEffect(() => {
    setShowAll(false);
  }, [region, countrySlug, coalition, onlyWithIdeology]);

  // Rows fed to the table. The compass always uses the FULL `filtered` set; the
  // table body is capped to PAGE_SIZE (seat-ranked, matching the default sort)
  // until "Show all" is pressed. Every row stays reachable via the pager.
  const isPaged = !showAll && filtered.length > PAGE_SIZE;
  const tableRows = useMemo(() => {
    if (!isPaged) return filtered;
    return [...filtered]
      .sort((a, b) => b.seatCount - a.seatCount)
      .slice(0, PAGE_SIZE);
  }, [filtered, isPaged]);

  // Compass gets only the matched (positioned) subset of the filtered list.
  const compassParties: CompassParty[] = useMemo(
    () =>
      filtered
        .filter((p) => p.position != null)
        .map((p) => ({
          id: p.id,
          partyName: p.partyName,
          countryName: p.country.name,
          seatCount: p.seatCount,
          seatShare: p.seatShare,
          color: p.color,
          economicLR: p.position!.economicLR,
          antiPlural: p.position!.antiPlural,
        })),
    [filtered],
  );

  const plottedCount = compassParties.length;
  const seatCoveragePct =
    coverage.totalSeats > 0
      ? Math.round((coverage.seatsWithPosition / coverage.totalSeats) * 100)
      : 0;

  // ── Table columns ──
  const columns: SortableColumn<BrowserParty>[] = useMemo(
    () => [
      {
        id: "party",
        label: "Party",
        sortValue: (p) => p.partyName.toLowerCase(),
        render: (p) => (
          <span className="parties-cell-party">
            <span
              className="parties-cell-swatch"
              aria-hidden
              style={{ background: p.color ?? "var(--color-text-40)" }}
            />
            <span className="parties-cell-name" title={p.partyName}>
              {p.partyName}
            </span>
          </span>
        ),
      },
      {
        id: "country",
        label: "Country",
        sortValue: (p) => p.country.name.toLowerCase(),
        render: (p) => (
          <span className="parties-cell-country">
            <CountryFlag iso2={p.country.iso2} size={20} decorative />
            <span className="parties-cell-country-name">{p.country.name}</span>
          </span>
        ),
      },
      {
        id: "chamber",
        label: "Chamber",
        sortValue: (p) => p.chamber.toLowerCase(),
        render: (p) => p.chamber,
      },
      {
        id: "seats",
        label: "Seats",
        numeric: true,
        sortValue: (p) => p.seatCount,
        render: (p) => p.seatCount.toLocaleString(),
      },
      {
        id: "share",
        label: "Seat share",
        numeric: true,
        sortValue: (p) => p.seatShare ?? -1,
        render: (p) =>
          p.seatShare != null ? `${(p.seatShare * 100).toFixed(1)}%` : null,
      },
      {
        id: "coalition",
        label: "Status",
        sortValue: (p) => (p.isRulingCoalition ? 1 : 0),
        render: (p) => <CoalitionChip ruling={p.isRulingCoalition} />,
      },
      {
        id: "ideology",
        label: "Ideology",
        // Sort by economic L–R; unrecorded sort to the bottom via null.
        sortValue: (p) => p.position?.economicLR ?? null,
        render: (p) => <IdeologyCell party={p} />,
      },
      {
        id: "provenance",
        label: "Source",
        render: (p) => (
          <span className="parties-cell-provenance">
            <SeatsSourceCell party={p} />
            {p.position ? (
              <SourceDot source="vparty" retrievedAt={positionsSyncedAt} />
            ) : null}
          </span>
        ),
      },
    ],
    [positionsSyncedAt],
  );

  return (
    <>
      {/* Compass panel */}
      <div className="parties-compass-panel">
        <IdeologyCompass parties={compassParties} scaleBySeatShare />
        <p className="ideology-compass-caption">
          Plotting {plottedCount.toLocaleString()} of{" "}
          {filtered.length.toLocaleString()} parties in view with a V-Party
          position ({coverage.partiesWithPosition.toLocaleString()} of{" "}
          {coverage.totalParties.toLocaleString()} overall, ≈{seatCoveragePct}%
          of seats). Parties formed or renamed after 2019, and parties in
          single-party legislatures, are listed but not plotted — a position is
          never fabricated. Dot size reflects each party&rsquo;s share of its
          chamber.
        </p>
      </div>

      {/* Filters */}
      <div className="parties-filters" ref={menusRef}>
        <SingleSelectMenu
          label="Region"
          ariaLabel="Filter by region"
          value={region}
          items={regionItems}
          open={openMenu === "region"}
          onOpenChange={(o) => setOpenMenu(o ? "region" : null)}
          onSelect={(v) => {
            setRegion(v);
            // Reset country if it no longer belongs to the chosen region.
            if (v !== ALL) {
              const stillValid =
                countrySlug === ALL ||
                countries.some((c) => c.slug === countrySlug && c.region === v);
              if (!stillValid) setCountrySlug(ALL);
            }
          }}
          minWidth={170}
        />
        <SingleSelectMenu
          label="Country"
          ariaLabel="Filter by country"
          value={countrySlug}
          items={countryItems}
          open={openMenu === "country"}
          onOpenChange={(o) => setOpenMenu(o ? "country" : null)}
          onSelect={setCountrySlug}
          minWidth={210}
        />
        <SingleSelectMenu
          label="Coalition status"
          ariaLabel="Filter by coalition status"
          value={coalition}
          items={coalitionItems}
          open={openMenu === "coalition"}
          onOpenChange={(o) => setOpenMenu(o ? "coalition" : null)}
          onSelect={setCoalition}
          minWidth={180}
        />
        <label className="parties-filter-toggle">
          <input
            type="checkbox"
            checked={onlyWithIdeology}
            onChange={(e) => setOnlyWithIdeology(e.target.checked)}
          />
          Has ideology
        </label>
      </div>

      {/* Result count */}
      <div className="parties-result-row">
        <span className="parties-result-count">
          {isPaged ? (
            <>
              Showing the top {PAGE_SIZE.toLocaleString()} by seats of{" "}
              {filtered.length.toLocaleString()} matching parties
            </>
          ) : (
            <>
              Showing {filtered.length.toLocaleString()} of{" "}
              {parties.length.toLocaleString()} parties
            </>
          )}
        </span>
      </div>

      {/* Sortable table */}
      {filtered.length > 0 ? (
        <>
          <div className="editorial-table-scroll">
            <SortableDataTable
              columns={columns}
              rows={tableRows}
              getRowKey={(p) => p.id}
              initialSort={{ columnId: "seats", direction: "desc" }}
            />
          </div>
          {isPaged ? (
            <div className="parties-pager">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAll(true)}
              >
                Show all {filtered.length.toLocaleString()} parties
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="editorial-empty">
          No parties match these filters. Try widening the region or clearing
          the &ldquo;Has ideology&rdquo; toggle.
        </p>
      )}
    </>
  );
}
