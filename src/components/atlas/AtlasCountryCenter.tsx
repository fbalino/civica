"use client";

import {
  type Bill,
  type ChamberData,
  type Country,
  govDescription,
} from "./data";
import { GovStructureDiagram } from "@/components/GovStructureDiagram";
import { ChamberTab } from "./tabs/ChamberTab";
import { BillsTab } from "./tabs/BillsTab";
import {
  ElectionsTab,
  type ElectionData,
} from "./tabs/ElectionsTab";
import {
  ConstitutionTab,
  type ConstitutionData,
} from "./tabs/ConstitutionTab";
import {
  InternationalTab,
  type InternationalData,
} from "./tabs/InternationalTab";

type Tab =
  | "chamber"
  | "bills"
  | "structure"
  | "elections"
  | "democracy"
  | "leaders"
  | "constitution"
  | "international";

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
  cd: ChamberData;
  tab: Tab;
  house: House;
  dimmed: Set<string>;

  // Per-tab data
  billsData: Bill[] | null;
  billsLoading: boolean;
  structureData: StructureData | null;
  electionData: ElectionData[];
  electionsLoading: boolean;
  democracyData: DemocracyData | null;
  leadersData: LeaderEntry[] | null;
  constitutionData: ConstitutionData | null;
  internationalData: InternationalData | null;
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

const TAB_LABELS: [Tab, string][] = [
  ["chamber", "I · The Chamber"],
  ["bills", "II · Laws in Motion"],
  ["structure", "III · Full Structure"],
  ["elections", "IV · Elections"],
  ["democracy", "V · Democracy"],
  ["leaders", "VI · Leaders"],
  ["constitution", "VII · Constitution"],
  ["international", "VIII · International"],
];

export function AtlasCountryCenter({
  country,
  cd,
  tab,
  house,
  dimmed,
  billsData,
  billsLoading,
  structureData,
  electionData,
  electionsLoading,
  democracyData,
  leadersData,
  constitutionData,
  internationalData,
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
      <div className="atlas-masthead">
        <div>
          <div className="eyebrow">
            {country.region.toUpperCase()} &middot; {country.id.toUpperCase()}
          </div>
          <h1>{country.name}</h1>
          <div className="dek">
            {govDescription(country)} of {country.pop} people, led from{" "}
            {country.capital}.
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <a
              href={`/api/countries/${country.slug ?? country.id}/export?format=json`}
              download
              className="atlas-export-btn"
            >
              JSON
            </a>
            <a
              href={`/api/countries/${country.id}/export?format=csv`}
              download
              className="atlas-export-btn"
            >
              CSV
            </a>
          </div>
        </div>
        <div className="quick-facts">
          <div className="r">
            <b>Leader</b>
            <span>{country.leader}</span>
          </div>
          <div className="r">
            <b>Gov</b>
            <span>{country.gov}</span>
          </div>
          <div className="r">
            <b>Capital</b>
            <span>{country.capital}</span>
          </div>
          <div className="r">
            <b>Population</b>
            <span>{country.pop}</span>
          </div>
          <div className="r">
            <b>GDP</b>
            <span>{country.gdp}</span>
          </div>
        </div>
      </div>

      <div className="atlas-tabs">
        {TAB_LABELS.map(([t, label]) => (
          <button
            key={t}
            className={tab === t ? "on" : ""}
            onClick={() => onTabChange(t)}
          >
            {label}
          </button>
        ))}
      </div>

      <ChamberTab
        active={tab === "chamber"}
        country={country}
        house={house}
        cd={cd}
        dimmed={dimmed}
        onHouseChange={onHouseChange}
        onDimToggle={onDimToggle}
        onSeatHover={onSeatHover}
        onSeatLeave={onSeatLeave}
      />

      <BillsTab
        active={tab === "bills"}
        countryName={country.name}
        billsData={billsData}
        billsLoading={billsLoading}
        onAskBill={onAskBill}
      />

      {/* Tab III: Structure (inline — small, stable, delegates to GovStructureDiagram) */}
      <div className={`atlas-pane${tab === "structure" ? " on" : ""}`}>
        {tabDataLoading && tab === "structure" ? (
          <LoadingPane />
        ) : structureData && structureData.bodies.length > 0 ? (
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
              minHeight: 320,
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
                <div className="atlas-serif" style={{ fontSize: 20, marginTop: 6 }}>
                  {cd.branches?.[branch] || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ElectionsTab
        active={tab === "elections"}
        countryName={country.name}
        electionData={electionData}
        electionsLoading={electionsLoading}
      />

      {/* Tab V: Democracy (inline — compact, no sub-components) */}
      <div className={`atlas-pane${tab === "democracy" ? " on" : ""}`}>
        {tabDataLoading && tab === "democracy" ? (
          <LoadingPane />
        ) : democracyData ? (
          <>
            <div
              style={{
                marginBottom: 20,
                paddingBottom: 16,
                borderBottom: "1px solid var(--atlas-rule)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span className="atlas-serif" style={{ fontSize: 48 }}>
                  {democracyData.democracyIndex != null
                    ? democracyData.democracyIndex.toFixed(2)
                    : "—"}
                </span>
                <span
                  className="atlas-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--atlas-muted)",
                    letterSpacing: ".1em",
                  }}
                >
                  / 1.00 V-DEM
                </span>
              </div>
              {democracyData.democracyIndex != null && (
                <>
                  <div
                    style={{
                      background: "var(--atlas-rule-2)",
                      borderRadius: 3,
                      height: 8,
                      overflow: "hidden",
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        width: `${(democracyData.democracyIndex * 100).toFixed(1)}%`,
                        height: "100%",
                        borderRadius: 3,
                        background:
                          democracyData.democracyIndex >= 0.7
                            ? "var(--color-success)"
                            : democracyData.democracyIndex >= 0.4
                              ? "var(--color-warn)"
                              : "var(--color-danger)",
                      }}
                    />
                  </div>
                  <span
                    className="atlas-mono"
                    style={{
                      fontSize: 10,
                      color: "var(--atlas-ink-2)",
                      letterSpacing: ".08em",
                    }}
                  >
                    {democracyData.democracyIndex >= 0.7
                      ? "LIBERAL DEMOCRACY"
                      : democracyData.democracyIndex >= 0.4
                        ? "ELECTORAL DEMOCRACY / HYBRID"
                        : "AUTOCRACY / CLOSED"}
                  </span>
                </>
              )}
            </div>
            {democracyData.freedomHouseFacts.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <SectionHead>Freedom House</SectionHead>
                {democracyData.freedomHouseFacts.map((f) => (
                  <div
                    key={f.factKey}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 0",
                      borderBottom: "1px solid var(--atlas-rule-2)",
                    }}
                  >
                    <span
                      className="atlas-sans"
                      style={{
                        fontSize: 13,
                        color: "var(--atlas-ink-2)",
                        textTransform: "capitalize",
                      }}
                    >
                      {f.factKey
                        .replace("freedom_house_", "")
                        .replace(/_/g, " ")}
                    </span>
                    <span
                      className="atlas-mono"
                      style={{ fontSize: 12, color: "var(--atlas-ink)" }}
                    >
                      {f.factValue ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {democracyData.regionalComparison.length > 0 && (
              <div>
                <SectionHead>Regional Comparison</SectionHead>
                {democracyData.regionalComparison.slice(0, 8).map((rc, i) => (
                  <div
                    key={rc.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "5px 0",
                      borderBottom: "1px solid var(--atlas-rule-2)",
                      fontWeight: rc.id === country.id ? 700 : 400,
                    }}
                  >
                    <span className="atlas-sans" style={{ fontSize: 13 }}>
                      <span
                        style={{
                          color: "var(--atlas-muted)",
                          marginRight: 6,
                          fontSize: 10,
                        }}
                      >
                        {i + 1}.
                      </span>
                      {rc.name}
                    </span>
                    <span
                      className="atlas-mono"
                      style={{ fontSize: 11, color: "var(--atlas-muted)" }}
                    >
                      {rc.democracyIndex?.toFixed(2) ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <EmptyPane label="No democracy data available" />
        )}
      </div>

      {/* Tab VI: Leaders (inline) */}
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
    </>
  );
}

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
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  );
}
