"use client";

import {
  type Bill,
  type ChamberData,
  type Country,
} from "./data";
import { CountryMasthead } from "./CountryMasthead";
import { GovStructureDiagram } from "@/components/GovStructureDiagram";
import { ChamberTab } from "./tabs/ChamberTab";
import { BillsTab } from "./tabs/BillsTab";
import { ScoresTab } from "./tabs/ScoresTab";
import {
  ConstitutionTab,
  type ConstitutionData,
} from "./tabs/ConstitutionTab";
import {
  InternationalTab,
  type InternationalData,
} from "./tabs/InternationalTab";
import {
  type AtlasTab,
  ATLAS_TAB_LABELS,
  ATLAS_TAB_ORDER,
} from "@/lib/atlas/ids";
import { CiteAccordion } from "@/components/cite/CiteAccordion";

type Tab = AtlasTab;
type House = "upper" | "lower";

export interface DemocracyData {
  democracyIndex: number | null;
  freedomHouseFacts: {
    factKey: string;
    factValue: string | null;
    factYear: number | null;
  }[];
  regionalComparison: {
    id: string;
    name: string;
    slug: string;
    democracyIndex: number | null;
  }[];
}

export interface LeaderEntry {
  personName: string;
  officeName: string;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  partyName: string | null;
  partyColor: string | null;
  photoUrl: string | null;
}

export interface GovStructureBody {
  id: string;
  name: string;
  branch: string | null;
  bodyType: string;
  chamberType?: string | null;
  totalSeats?: number | null;
  hierarchyLevel: number | null;
  parentBodyId?: string | null;
}

export interface GovStructureOffice {
  id: string;
  bodyId: string;
  name: string;
  officeType: string;
  reportsToOfficeId?: string | null;
}

export interface GovStructureTerm {
  term: {
    officeId: string;
    partyName?: string | null;
    partyColor?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  person: {
    name: string;
    photoUrl: string | null;
    wikidataQid?: string | null;
  };
}

export interface GovStructureParty {
  bodyId: string;
  partyName: string;
  partyColor: string | null;
  seatCount: number;
  isRulingCoalition: boolean | null;
}

export interface StructureData {
  country: string;
  bodies: GovStructureBody[];
  offices: GovStructureOffice[];
  currentTerms: GovStructureTerm[];
  parties?: GovStructureParty[];
}

export interface AtlasCountryCenterProps {
  country: Country;
  /** Phase F.4 — pre-fetched resolver outputs for the masthead's
   *  pop + GDP rows. Threaded through from
   *  AtlasCountryShellClient. */
  headerFacts?: import("./AtlasCountryShellClient").AtlasHeaderFacts;
  cd: ChamberData;
  tab: Tab;
  house: House;
  dimmed: Set<string>;

  // Per-tab data
  billsData: Bill[] | null;
  billsLoading: boolean;
  structureData: StructureData | null;
  democracyData: DemocracyData | null;
  leadersData: LeaderEntry[] | null;
  constitutionData: ConstitutionData | null;
  internationalData: InternationalData | null;
  scoresRows: import("@/lib/db/queries-scores").ScoreRow[] | null;
  tabDataLoading: boolean;

  // Interactions
  onTabChange: (tab: Tab) => void;
  onHouseChange: (house: House) => void;
  onDimToggle: (partyId: string) => void;
  onSeatHover: (
    info: {
      member: { name: string; district: string };
      party: { name: string };
      index: number;
    },
    e: { clientX: number; clientY: number },
  ) => void;
  onSeatLeave: () => void;
  onAskBill: (prompt: string) => void;
  onPickOrg: (slug: string) => void;
  onPickCountry: (slug: string) => void;
}

/**
 * Phase C — 6-tab consolidation.
 *
 * Old 8-tab Roman-numeral list (Chamber / Bills / Structure / Elections /
 * Democracy / Leaders / Constitution / International) is replaced by:
 *   1. Structure   (folds in Chamber — government diagram on top, then
 *                   the chamber composition with its upper/lower toggle)
 *   2. Bills
 *   3. Leaders
 *   4. Constitution
 *   5. International
 *   6. Scores & Rankings   (folds in Democracy)
 *
 * Elections at the country level is retired in this phase; the global
 * /elections page still exists and the legacy `/atlas/[slug]/elections`
 * URL redirects to /elections via next.config.ts. Old URLs for chamber
 * and democracy redirect to their new homes too.
 *
 * Tab labels are read from ATLAS_TAB_LABELS (single source of truth in
 * src/lib/atlas/ids.ts) — the local TAB_LABELS const is gone.
 */
export function AtlasCountryCenter({
  country,
  headerFacts,
  cd,
  tab,
  house,
  dimmed,
  billsData,
  billsLoading,
  structureData,
  democracyData,
  leadersData,
  constitutionData,
  internationalData,
  scoresRows,
  tabDataLoading,
  onTabChange,
  onHouseChange,
  onDimToggle,
  onSeatHover,
  onSeatLeave,
  onAskBill,
  onPickOrg,
  onPickCountry,
}: AtlasCountryCenterProps) {
  return (
    <>
      <CountryMasthead country={country} headerFacts={headerFacts} />

      <div className="atlas-tabs">
        {ATLAS_TAB_ORDER.map((t) => (
          <button
            key={t}
            className={tab === t ? "on" : ""}
            onClick={() => onTabChange(t)}
          >
            {ATLAS_TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab 1: Structure — folds in Chamber.
          Top: ChamberTab (hemicycle + house toggle + all-parties
          accordion). Bottom: GovStructureDiagram (branches + bodies +
          offices + terms). User-preferred order — the seat composition
          is the most-asked question; the org-chart is the deeper
          drill-down. */}
      <div className={`atlas-pane${tab === "structure" ? " on" : ""}`}>
        {tabDataLoading && tab === "structure" ? (
          <LoadingPane />
        ) : (
          <>
            <ChamberTab
              active
              country={country}
              house={house}
              cd={cd}
              dimmed={dimmed}
              onHouseChange={onHouseChange}
              onDimToggle={onDimToggle}
              onSeatHover={onSeatHover}
              onSeatLeave={onSeatLeave}
            />

            {/* Section divider between chamber composition (above) and
                the full government structure diagram (below). */}
            <div
              className="atlas-section-divider"
              role="separator"
              aria-label="Full government structure"
            >
              <span className="atlas-section-divider-label">
                Full government structure
              </span>
            </div>

            {structureData && structureData.bodies.length > 0 ? (
              <GovStructureDiagram
                bodies={structureData.bodies}
                offices={structureData.offices}
                currentTerms={structureData.currentTerms}
                countryName={country.name}
                parties={structureData.parties ?? []}
              />
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: 14,
                  border: "1px dashed var(--atlas-rule)",
                  padding: 24,
                  minHeight: 200,
                  background: "var(--atlas-paper-2)",
                }}
              >
                {(["exec", "legis", "jud"] as const).map((branch) => (
                  <div key={branch}>
                    <div
                      className="atlas-mono"
                      style={{
                        fontSize: 10,
                        color: "var(--atlas-muted)",
                        letterSpacing: ".14em",
                        textTransform: "uppercase",
                      }}
                    >
                      {branch === "exec"
                        ? "Executive"
                        : branch === "legis"
                          ? "Legislative"
                          : "Judicial"}
                    </div>
                    <div
                      className="atlas-serif"
                      style={{ fontSize: 20, marginTop: 6 }}
                    >
                      {cd.branches?.[branch] || "—"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <BillsTab
        active={tab === "bills"}
        countryName={country.name}
        billsData={billsData}
        billsLoading={billsLoading}
        onAskBill={onAskBill}
      />

      {/* Tab 3: Leaders (inline)
          TODO Phase I: Redesign as an org-chart hierarchy. Current ordering
          puts cabinet members above heads of state because the SQL sorts by
          desc(startDate). See
          ~/.claude/plans/great-questions-1-build-tender-falcon.md Phase I. */}
      <div className={`atlas-pane${tab === "leaders" ? " on" : ""}`}>
        {tabDataLoading && tab === "leaders" ? (
          <LoadingPane />
        ) : leadersData && leadersData.length > 0 ? (
          <>
            {leadersData.filter((l) => l.isCurrent).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <SectionHead>Current Leaders</SectionHead>
                {leadersData
                  .filter((l) => l.isCurrent)
                  .map((l, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 0",
                        borderBottom: "1px solid var(--atlas-rule-2)",
                      }}
                    >
                      {l.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.photoUrl}
                          alt={l.personName}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            objectFit: "cover",
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div>
                        <div className="atlas-serif" style={{ fontSize: 17 }}>
                          {l.personName}
                        </div>
                        <div
                          className="atlas-mono"
                          style={{
                            fontSize: 10,
                            color: "var(--atlas-muted)",
                            marginTop: 2,
                          }}
                        >
                          {l.officeName}
                          {l.partyName ? ` · ${l.partyName}` : ""}
                          {l.startDate
                            ? ` · Since ${new Date(l.startDate).getFullYear()}`
                            : ""}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
            {leadersData.filter((l) => !l.isCurrent).length > 0 && (
              <div>
                <SectionHead>Past Leaders</SectionHead>
                {leadersData
                  .filter((l) => !l.isCurrent)
                  .slice(0, 12)
                  .map((l, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 0",
                        borderBottom: "1px solid var(--atlas-rule-2)",
                      }}
                    >
                      <span className="atlas-sans" style={{ fontSize: 13 }}>
                        {l.personName}
                      </span>
                      <span
                        className="atlas-mono"
                        style={{ fontSize: 10, color: "var(--atlas-muted)" }}
                      >
                        {l.startDate
                          ? new Date(l.startDate).getFullYear()
                          : ""}
                        {l.endDate
                          ? `–${new Date(l.endDate).getFullYear()}`
                          : ""}
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </>
        ) : (
          <EmptyPane label="No leader data available" />
        )}
      </div>

      <ConstitutionTab
        active={tab === "constitution"}
        loading={tabDataLoading}
        data={constitutionData}
      />

      <InternationalTab
        active={tab === "international"}
        loading={tabDataLoading}
        country={country}
        data={internationalData}
        onPickOrg={onPickOrg}
        onPickCountry={onPickCountry}
      />

      <ScoresTab
        active={tab === "scores"}
        loading={tabDataLoading}
        country={country}
        democracyData={democracyData}
        scoresRows={scoresRows}
      />

      {/* Phase E — auto-citation. Sits inside .atlas-pane padding so it
          aligns with the tab content above it. Renders on every tab so
          the citation always references whatever the user is currently
          looking at. */}
      <div className="atlas-pane on" style={{ paddingTop: 0 }}>
        <CiteAccordion
          subject={country.name}
          pageTitle={ATLAS_TAB_LABELS[tab]}
          downloadSlug={country.slug ?? country.id}
          sourceNames={CIVICA_DATA_SOURCES}
        />
      </div>
    </>
  );
}

const CIVICA_DATA_SOURCES = [
  "Wikidata",
  "IPU Parline",
  "Constitute Project",
  "Bjornskov-Rode / CGV regime taxonomy (QoG)",
  "V-Dem",
  "Freedom House",
  "World Bank WGI",
  "UNDP HDI",
  "Transparency International CPI",
  "Civica Pulse (GDELT-derived)",
];

function LoadingPane() {
  return (
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
      Loading…
    </div>
  );
}

function EmptyPane({ label }: { label: string }) {
  return (
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
      {label}
    </div>
  );
}

function SectionHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="atlas-mono"
      style={{
        fontSize: 10,
        color: "var(--atlas-muted)",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        marginBottom: 8,
        marginTop: 4,
      }}
    >
      {children}
    </div>
  );
}
