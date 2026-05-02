"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { AtlasCountry, AtlasChamberData } from "@/lib/atlas/load-atlas-data";
import {
  type Bill,
  type ChamberData,
  type Country,
  getDefaultChamberData as getFallbackChamberData,
} from "./data";
import {
  AtlasCountryCenter,
  type DemocracyData,
  type LeaderEntry,
  type StructureData,
} from "./AtlasCountryCenter";
import type { ConstitutionData } from "./tabs/ConstitutionTab";
import type { InternationalData } from "./tabs/InternationalTab";
import type { ScoreRow } from "@/lib/db/queries-scores";
import { useAtlasUrlState } from "@/hooks/useAtlasUrlState";
import { atlasIdToSlug } from "@/lib/atlas/ids";
import { dispatchCivicaAsk } from "@/lib/shell/events";

export interface AtlasCountryShellClientProps {
  country: Country;
  /** DB-typed country records — used to resolve slugs for per-tab fetches. */
  dbCountries: AtlasCountry[];
  /** SSR-loaded chamber composition keyed by 3-letter id. */
  dbChambers: Record<string, AtlasChamberData>;
}

/**
 * Client wrapper for the (shell)/atlas/[slug]/[tab] country view. Owns
 * per-tab data fetches and passes them into AtlasCountryCenter, which is
 * presentational.
 *
 * Tab and house come from the URL via useAtlasUrlState — toggling either
 * does a shallow `router.replace` without a full page reload, so tab
 * switches stay instant just like the legacy / route.
 */
export function AtlasCountryShellClient({
  country,
  dbCountries,
  dbChambers,
}: AtlasCountryShellClientProps) {
  const router = useRouter();
  const { tab, house, setTab, setHouse } = useAtlasUrlState();

  function getChamberData(id: string): ChamberData {
    if (dbChambers[id]) {
      const dc = dbChambers[id];
      return {
        lower: {
          ...dc.lower,
          parties:
            dc.lower.parties.length > 0
              ? dc.lower.parties
              : [
                  {
                    id: "unk",
                    name: "Unknown",
                    seats: dc.lower.total || 1,
                    color: "gray",
                  },
                ],
        },
        upper: dc.upper
          ? {
              ...dc.upper,
              parties:
                dc.upper.parties.length > 0
                  ? dc.upper.parties
                  : [
                      {
                        id: "unk",
                        name: "Unknown",
                        seats: dc.upper.total || 1,
                        color: "gray",
                      },
                    ],
            }
          : null,
        branches: dc.branches,
        coalition: undefined,
        next: undefined,
        bills: [],
      };
    }
    return getFallbackChamberData(id);
  }

  const cd = getChamberData(country.id);

  const [dimmed, setDimmed] = useState<Set<string>>(new Set());
  const [, setSeatTip] = useState<unknown>(null);

  const [billsData, setBillsData] = useState<Bill[] | null>(null);
  const [billsLoading, setBillsLoading] = useState(false);
  const [structureData, setStructureData] = useState<StructureData | null>(null);
  const [democracyData, setDemocracyData] = useState<DemocracyData | null>(null);
  const [leadersData, setLeadersData] = useState<LeaderEntry[] | null>(null);
  const [constitutionData, setConstitutionData] =
    useState<ConstitutionData | null>(null);
  const [internationalData, setInternationalData] =
    useState<InternationalData | null>(null);
  const [scoresRows, setScoresRows] = useState<ScoreRow[] | null>(null);
  const [tabDataLoading, setTabDataLoading] = useState(false);


  // Clear per-tab data when the country changes (mirrors AtlasApp's reset effect).
  useEffect(() => {
    setBillsData(null);
    setStructureData(null);
    setDemocracyData(null);
    setLeadersData(null);
    setConstitutionData(null);
    setInternationalData(null);
    setScoresRows(null);
    setDimmed(new Set());
  }, [country.id]);

  // Phase C — Elections retired at the country level (route redirects to
  // global /elections). The unconditional /api/countries/<slug>/elections
  // fetch that used to live here is gone with it.

  // Shared fetch effect for bills / scores / leaders / constitution /
  // structure / international. Mirrors AtlasApp.tsx's consolidated loader.
  useEffect(() => {
    // Phase C — fetch list updated for the consolidated 6-tab set.
    // "scores" picks up democracy data (Democracy folded into Scores).
    if (!["bills", "scores", "leaders", "constitution", "structure", "international"].includes(tab))
      return;
    const slug = country.slug ?? country.id;
    let cancelled = false;

    async function load() {
      if (tab === "international") {
        setTabDataLoading(true);
        setInternationalData(null);
        try {
          const res = await fetch(`/api/countries/${country.id}/international`);
          if (!cancelled && res.ok) setInternationalData(await res.json());
        } finally {
          if (!cancelled) setTabDataLoading(false);
        }
        return;
      }
      if (tab === "bills") {
        if (billsData !== null) return;
        setBillsLoading(true);
        try {
          const res = await fetch(`/api/countries/${slug}/bills`);
          if (!cancelled && res.ok) {
            const json = await res.json();
            setBillsData(json.bills ?? []);
          } else if (!cancelled) {
            setBillsData([]);
          }
        } finally {
          if (!cancelled) setBillsLoading(false);
        }
        return;
      }
      setTabDataLoading(true);
      try {
        if (tab === "scores") {
          // Two parallel fetches: the new Scores & Rankings table (P1.1
          // canonical surface) and the legacy democracy payload (which
          // ScoresTab still uses for its Freedom House facts strip and
          // regional comparison list, kept until those move into the
          // unified row format).
          const tasks: Promise<unknown>[] = [];
          if (!scoresRows) {
            tasks.push(
              fetch(`/api/countries/${slug}/scores`)
                .then((res) => (res.ok ? res.json() : null))
                .then((json) => {
                  if (!cancelled && json?.rows) setScoresRows(json.rows);
                })
                .catch(() => {}),
            );
          }
          if (!democracyData) {
            tasks.push(
              fetch(`/api/countries/${slug}/democracy`)
                .then((res) => (res.ok ? res.json() : null))
                .then((json) => {
                  if (!cancelled && json) setDemocracyData(json);
                })
                .catch(() => {}),
            );
          }
          await Promise.all(tasks);
        } else if (tab === "leaders" && !leadersData) {
          const res = await fetch(`/api/countries/${slug}/leaders`);
          if (!cancelled && res.ok) {
            const json = await res.json();
            setLeadersData(json.leaders ?? []);
          }
        } else if (tab === "constitution" && !constitutionData) {
          const res = await fetch(`/api/countries/${slug}/constitution`);
          if (!cancelled && res.ok) setConstitutionData(await res.json());
        } else if (tab === "structure" && !structureData) {
          const res = await fetch(`/api/countries/${slug}/structure`);
          if (!cancelled && res.ok) setStructureData(await res.json());
        }
      } finally {
        if (!cancelled) setTabDataLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [country, tab, billsData, democracyData, leadersData, constitutionData, structureData, scoresRows]);

  function toggleDim(partyId: string) {
    setDimmed((prev) => {
      const next = new Set(prev);
      if (next.has(partyId)) next.delete(partyId);
      else next.add(partyId);
      return next;
    });
  }

  return (
    <div style={{ paddingTop: 32, paddingBottom: 32 }}>
      <AtlasCountryCenter
        country={country}
        cd={cd}
        tab={tab}
        house={house}
        dimmed={dimmed}
        billsData={billsData}
        billsLoading={billsLoading}
        structureData={structureData}
        democracyData={democracyData}
        leadersData={leadersData}
        constitutionData={constitutionData}
        internationalData={internationalData}
        scoresRows={scoresRows}
        tabDataLoading={tabDataLoading}
        onTabChange={setTab}
        onHouseChange={(h) => {
          setHouse(h);
          setDimmed(new Set());
        }}
        onDimToggle={toggleDim}
        onSeatHover={() => {}}
        onSeatLeave={() => setSeatTip(null)}
        onAskBill={(text) => dispatchCivicaAsk(text)}
        onPickOrg={(slug) => router.push(`/atlas#org=${slug}`)}
        onPickCountry={(slug) => {
          const match = dbCountries.find(
            (x) => x.slug === slug || x.id === slug,
          );
          if (match) router.push(`/atlas/${atlasIdToSlug(match.id, dbCountries)}/international`);
        }}
      />
    </div>
  );
}
