import type {
  GovStructure,
  GovBranch,
  GovBranchKind,
  GovRole,
  GovChamber,
} from "@/lib/factbook/gov-org-chart";
import {
  formatRosterDate,
  getCabinetRosterProvenance,
} from "@/lib/factbook/cabinet-roster-provenance";
import { SourceDot } from "@/components/SourceDot";
import "./gov-chart.css";

/**
 * Government structure for the Civica Data → Government section
 * ("How power is organised").
 *
 * Branch-columned hierarchy (Executive / Legislative / Judicial), each
 * column listing its principal roles and named bodies with the CURRENT
 * officeholder and the year they took office. Server component — no
 * interactivity, matching the rest of the Civica Data sections.
 *
 * Honest-data posture: every card shows only sourced facts. Offices with
 * no current holder render an explicit "Vacant / not recorded" line rather
 * than a fabricated name. Cabinet offices from the CIA World Leaders roster
 * carry no "since" year because the roster publishes no appointment dates;
 * the note credits the roster and its "Last Updated" date instead (DAT-037). Branches with no data are omitted entirely, so a
 * thin country (head of state + head of government + one chamber) reads as a
 * clean two-column layout, and a rich country (United States, United
 * Kingdom) fills out cabinet and chamber-leadership detail.
 */

interface Props {
  /** Built by `buildOrgChartFromGovernmentStructure`. Prop name retained
   *  for the existing call site. */
  chart: GovStructure;
  countryName: string;
}

const BRANCH_ACCENT: Record<GovBranchKind, string> = {
  executive: "var(--color-branch-executive)",
  legislative: "var(--color-branch-legislative)",
  judicial: "var(--color-branch-judicial)",
  other: "var(--color-text-40)",
};

export async function FactbookGovOrgChart({ chart, countryName }: Props) {
  if (!chart || chart.branches.length === 0) {
    return (
      <div className="govstruct govstruct--empty">
        <p className="govstruct-empty-note">
          Limited structural data available for {countryName}. See the CIA
          reference below for the textual government summary.
        </p>
      </div>
    );
  }

  const roster =
    chart.hasRosterOffices && chart.executiveBodyId
      ? await getCabinetRosterProvenance({
          executiveBodyId: chart.executiveBodyId,
        })
      : null;
  const rosterUpdated = formatRosterDate(roster?.rosterUpdated ?? null);
  const officeholders =
    chart.officeholderCount > 0
      ? `${chart.officeholderCount} current officeholder${
          chart.officeholderCount === 1 ? "" : "s"
        }`
      : null;

  return (
    <div className="govstruct">
      <div className="govstruct-branches">
        {chart.branches.map((branch) => (
          <BranchColumn key={branch.kind} branch={branch} />
        ))}
      </div>

      <div className="govstruct-foot">
        <div className="govstruct-legend">
          {chart.branches.map((branch) => (
            <span key={branch.kind} className="govstruct-legend-item">
              <span
                className="govstruct-legend-swatch"
                style={{ background: BRANCH_ACCENT[branch.kind] }}
                aria-hidden
              />
              {branch.label}
            </span>
          ))}
        </div>
        <p className="govstruct-note">
          {officeholders ? `${officeholders} · ${chart.source}` : chart.source}
          {roster?.hasRosterRows && (
            <>
              <span>
                {rosterUpdated
                  ? `· Cabinet roster updated ${rosterUpdated}`
                  : "· Cabinet roster date not recorded"}
              </span>
              <SourceDot
                source="cia_world_leaders"
                retrievedAt={roster.retrievedAt}
                upstreamVintage={
                  roster.rosterUpdated
                    ? `Roster last updated ${roster.rosterUpdated}`
                    : null
                }
              />
            </>
          )}
          {chart.hasUnsourcedOffices && (
            <span>· Some offices are older Civica records without a cited source</span>
          )}
        </p>
      </div>
    </div>
  );
}

function BranchColumn({ branch }: { branch: GovBranch }) {
  const accent = BRANCH_ACCENT[branch.kind];
  return (
    <section
      className="govstruct-branch"
      style={{ ["--govstruct-accent" as string]: accent }}
    >
      <header className="govstruct-branch-head">
        <h4 className="govstruct-branch-label">{branch.label}</h4>
        {branch.summary && (
          <p className="govstruct-branch-summary">{branch.summary}</p>
        )}
      </header>

      <div className="govstruct-branch-body">
        {branch.roles.map((role) => (
          <RoleCard key={role.id} role={role} />
        ))}
        {branch.chambers.map((chamber) => (
          <ChamberBlock key={chamber.id} chamber={chamber} />
        ))}
      </div>
    </section>
  );
}

function RoleCard({ role }: { role: GovRole }) {
  return (
    <div className={`govstruct-role govstruct-role--rank${role.rank}`}>
      <span className="govstruct-role-tick" aria-hidden />
      <div className="govstruct-role-main">
        <p className="govstruct-role-title">{role.title}</p>
        {role.holderName ? (
          <>
            <p className="govstruct-role-holder">{role.holderName}</p>
            {(role.sinceYear || role.party) && (
              <div className="govstruct-role-meta">
                {role.sinceYear && (
                  <span className="govstruct-role-since">
                    Since {role.sinceYear}
                  </span>
                )}
                {role.party && (
                  <span className="govstruct-role-party">
                    <span
                      className="govstruct-role-party-dot"
                      style={
                        role.partyColor
                          ? { background: role.partyColor }
                          : undefined
                      }
                      aria-hidden
                    />
                    {role.party}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="govstruct-role-vacant">Vacant or not recorded</p>
        )}
      </div>
    </div>
  );
}

function ChamberBlock({ chamber }: { chamber: GovChamber }) {
  const hasRoles = chamber.roles.length > 0;
  return (
    <div
      className={`govstruct-chamber${
        hasRoles ? " govstruct-chamber--has-roles" : ""
      }`}
    >
      <header className="govstruct-chamber-head">
        <div className="govstruct-chamber-headline">
          <h5 className="govstruct-chamber-name">{chamber.name}</h5>
          {chamber.chamberLabel && (
            <p className="govstruct-chamber-tag">{chamber.chamberLabel}</p>
          )}
        </div>
        {typeof chamber.totalSeats === "number" && (
          <span className="govstruct-chamber-seats">
            {chamber.totalSeats.toLocaleString("en-US")} seats
          </span>
        )}
      </header>
      {hasRoles && (
        <div className="govstruct-chamber-roles">
          {chamber.roles.map((role) => (
            <div key={role.id} className="govstruct-chamber-role">
              <span className="govstruct-chamber-role-title">{role.title}</span>
              {role.holderName && (
                <span className="govstruct-chamber-role-holder">
                  {role.holderName}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
