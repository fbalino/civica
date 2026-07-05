import { getLeaderTimeline } from "@/lib/db/queries";
import { humanizeSectionLabel } from "@/lib/data/humanize-label";
import { titleCaseTitle } from "@/lib/text/title-case";
import { SourceDot } from "@/components/SourceDot";
import { Chip } from "@/components/editorial/Pill";
import {
  LeaderTenureTimeline,
  type TenureEntry,
} from "@/components/factbook/LeaderTenureTimeline";
import { LeaderPortrait } from "@/components/factbook/LeaderPortrait";
import "./leaders.css";

/*
 * FactbookLeaders — the Leaders section of the Civica Data tab.
 *
 * DATA AUDIT (Wikidata via getLeaderTimeline, 2026-06-30) — what is real and
 * what is NOT, so this component never fabricates:
 *
 *   REAL & rich:
 *     - personName, officeName, officeType (head_of_state / head_of_government
 *       / deputy_head / cabinet / legislative_leader / judicial_leader)
 *     - startDate — present on ~94% of terms (the load-bearing temporal fact)
 *     - isCurrent — true for ~99% of terms
 *   REAL but sparse:
 *     - partyName / partyColor — present on only a handful of terms (US/UK)
 *     - photoUrl — a Wikidata P18 portrait (Commons FILE NAME, rendered via
 *       wikimediaUrl) for ~97% of current leaders with a freely licensed image;
 *       carries per-file photoLicense / photoCredit attribution. Null for the
 *       rest → monogram fallback (also on an image 404, see LeaderPortrait).
 *     - dateOfBirth — a Wikidata P569 birthdate for ~99% of current leaders;
 *       surfaced as "Born {date}" on the principal card. Null → omitted.
 *   ABSENT in the data (so deliberately NOT rendered):
 *     - endDate — null for every term → no "former officeholder" history and
 *       no transition sequence; this is a CURRENT-leadership roster, and the
 *       timeline plots tenure-from-start (see LeaderTenureTimeline).
 *     - age / education — not surfaced by the query → omitted
 *
 * Most countries carry exactly the two principal offices (head of state +
 * head of government); only a couple (US/UK) carry deputy/cabinet/legislative/
 * judicial breadth. Every sub-block below degrades cleanly when its data is
 * absent.
 */

interface FactbookLeadersProps {
  jurisdictionId: string;
  countryName: string;
  // Optional — when the orchestrator already fetched the wikidata source's
  // last_sync_at it can pass it through. Without it the SourceDot still
  // renders, just with the "Not yet synced" tooltip.
  retrievedAt?: string | null;
}

type LeaderRow = Awaited<ReturnType<typeof getLeaderTimeline>>[number];

interface OfficeStint {
  officeName: string;
  officeType: string;
  partyName: string | null;
  partyColor: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}

// Person-level media (P2 enrichment). Attached per person, not per stint —
// a dual-office holder has one portrait / birthdate.
interface PersonMedia {
  photoUrl: string | null;
  dateOfBirth: string | null;
  photoLicense: string | null;
  photoCredit: string | null;
}

interface PersonGroup {
  personName: string;
  isCurrent: boolean;
  stints: OfficeStint[];
  media: PersonMedia;
}

const OFFICE_RANK: Record<string, number> = {
  head_of_state: 0,
  head_of_government: 1,
  deputy_head: 2,
  cabinet: 3,
  legislative_leader: 4,
  judicial_leader: 5,
  judicial: 5,
};

// Branch accent hues, keyed to the canonical government-type palette. These
// describe the BRANCH of the office (executive / legislative / judicial), not
// a regime classification — purely a consistent visual coding.
function accentForOffice(officeType: string): string {
  switch (officeType) {
    case "head_of_state":
    case "head_of_government":
    case "deputy_head":
    case "cabinet":
      return "var(--gov-pres)";
    case "legislative_leader":
      return "var(--gov-parl)";
    case "judicial":
    case "judicial_leader":
      return "var(--gov-other)";
    default:
      return "var(--color-accent)";
  }
}

// Human label for a branch grouping of the non-principal offices.
const BRANCH_LABELS: Record<string, string> = {
  deputy_head: "Deputy executive",
  cabinet: "Cabinet",
  legislative_leader: "Legislature",
  judicial_leader: "Judiciary",
  judicial: "Judiciary",
};

function parseYear(value: string | null): number | null {
  if (!value) return null;
  const y = new Date(value).getUTCFullYear();
  return Number.isFinite(y) ? y : null;
}

function formatMonthYear(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Whole years between a start date and "now". Returns null when undated.
function tenureYears(startDate: string | null, nowYear: number): number | null {
  const y = parseYear(startDate);
  if (y === null) return null;
  return Math.max(0, nowYear - y);
}

// "Born 17 September 1950" — the leader's P569 birthdate, when present.
function formatBirthdate(value: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Portrait attribution line, mirroring the country-page galleryCaption:
// "Photo: {credit} · {license} · Wikimedia Commons". Degrades gracefully when
// credit or license is null (e.g. just "Photo: Wikimedia Commons"). This full
// string is folded into the portrait's <Tooltip> beneath the name + office, so
// the attribution is surfaced on hover/focus without an ellipsised caption.
function portraitCredit(media: PersonMedia): string {
  const detail: string[] = [];
  if (media.photoCredit && media.photoCredit !== "Wikimedia Commons") {
    detail.push(media.photoCredit);
  }
  if (media.photoLicense) detail.push(media.photoLicense);
  detail.push("Wikimedia Commons");
  return `Photo: ${detail.join(" · ")}`;
}

function groupByPerson(rows: LeaderRow[]): PersonGroup[] {
  const groupMap = new Map<string, PersonGroup>();
  for (const row of rows) {
    let group = groupMap.get(row.personName);
    if (!group) {
      group = {
        personName: row.personName,
        isCurrent: false,
        stints: [],
        media: {
          photoUrl: row.photoUrl ?? null,
          dateOfBirth: row.dateOfBirth ?? null,
          photoLicense: row.photoLicense ?? null,
          photoCredit: row.photoCredit ?? null,
        },
      };
      groupMap.set(row.personName, group);
    }
    // A later row for the same person may carry the media the first didn't.
    if (!group.media.photoUrl && row.photoUrl) group.media.photoUrl = row.photoUrl;
    if (!group.media.dateOfBirth && row.dateOfBirth)
      group.media.dateOfBirth = row.dateOfBirth;
    if (!group.media.photoLicense && row.photoLicense)
      group.media.photoLicense = row.photoLicense;
    if (!group.media.photoCredit && row.photoCredit)
      group.media.photoCredit = row.photoCredit;
    if (row.isCurrent) group.isCurrent = true;
    group.stints.push({
      officeName: row.officeName,
      officeType: row.officeType,
      partyName: row.partyName,
      partyColor: row.partyColor,
      startDate: row.startDate,
      endDate: row.endDate,
      isCurrent: row.isCurrent ?? false,
    });
  }
  return [...groupMap.values()];
}

export async function FactbookLeaders({
  jurisdictionId,
  retrievedAt,
}: FactbookLeadersProps) {
  const rows = (await getLeaderTimeline(jurisdictionId).catch(
    () => [] as LeaderRow[]
  )) as LeaderRow[];
  if (rows.length === 0) return null;

  const nowYear = new Date().getUTCFullYear();
  const groups = groupByPerson(rows);

  // ---- Principal leadership: head of state + head of government ----------
  // A single person can hold both (presidential systems). We render one card
  // per person, listing each principal office they hold.
  interface Principal {
    personName: string;
    offices: OfficeStint[]; // head_of_state and/or head_of_government
    media: PersonMedia;
  }
  const principalMap = new Map<string, Principal>();
  for (const g of groups) {
    for (const s of g.stints) {
      if (
        s.isCurrent &&
        (s.officeType === "head_of_state" ||
          s.officeType === "head_of_government")
      ) {
        let p = principalMap.get(g.personName);
        if (!p) {
          p = { personName: g.personName, offices: [], media: g.media };
          principalMap.set(g.personName, p);
        }
        p.offices.push(s);
      }
    }
  }
  const principals = [...principalMap.values()];
  // head_of_state cards before head_of_government cards.
  principals.sort((a, b) => {
    const ra = Math.min(...a.offices.map((o) => OFFICE_RANK[o.officeType] ?? 99));
    const rb = Math.min(...b.offices.map((o) => OFFICE_RANK[o.officeType] ?? 99));
    return ra - rb;
  });
  const dualHolders = principals.filter((p) => p.offices.length > 1);

  // ---- Other offices (deputy / cabinet / legislature / judiciary) --------
  // Most countries have none of these; only deeper-coverage countries (US/UK)
  // carry them. Each row keeps its officeholder name alongside the stint.
  const otherWithName = groups
    .flatMap((g) =>
      g.stints
        .filter(
          (s) =>
            s.isCurrent &&
            s.officeType !== "head_of_state" &&
            s.officeType !== "head_of_government"
        )
        // Carry the person's media (P18 portrait + credit) so a cabinet
        // minister enriched by the person-portraits backfill shows a thumbnail
        // here, not just a text row. Null photoUrl → monogram (same as leaders).
        .map((s) => ({ name: g.personName, stint: s, media: g.media }))
    )
    // Stable order within a branch: by office rank then name.
    .sort((a, b) => {
      const ra = OFFICE_RANK[a.stint.officeType] ?? 99;
      const rb = OFFICE_RANK[b.stint.officeType] ?? 99;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });

  // Group the "other" offices by branch label, preserving rank order.
  const branchOrder = ["deputy_head", "cabinet", "legislative_leader", "judicial_leader", "judicial"];
  const branches: {
    type: string;
    label: string;
    rows: { name: string; stint: OfficeStint; media: PersonMedia }[];
  }[] = [];
  for (const type of branchOrder) {
    const inType = otherWithName.filter((o) => o.stint.officeType === type);
    if (inType.length === 0) continue;
    const label = BRANCH_LABELS[type] ?? humanizeSectionLabel(type);
    // Merge judicial + judicial_leader under one "Judiciary" branch.
    const existing = branches.find((b) => b.label === label);
    if (existing) existing.rows.push(...inType);
    else branches.push({ type, label, rows: inType });
  }

  // ---- Tenure timeline entries (current, dated officeholders) ------------
  const timelineEntries: TenureEntry[] = [];
  const seenTimeline = new Set<string>();
  for (const p of principals) {
    // Use the principal's earliest principal-office start date.
    const dated = p.offices
      .map((o) => parseYear(o.startDate))
      .filter((y): y is number => y !== null);
    if (dated.length === 0) continue;
    const startYear = Math.min(...dated);
    const officeLabel =
      p.offices.length > 1
        ? "Head of state & government"
        : titleCaseTitle(p.offices[0]!.officeName);
    const key = `${p.personName}|principal`;
    if (seenTimeline.has(key)) continue;
    seenTimeline.add(key);
    timelineEntries.push({
      personName: p.personName,
      officeLabel,
      startYear,
      accent: accentForOffice(p.offices[0]!.officeType),
    });
  }

  // ---- Section stats (all real, derived from the data above) -------------
  const distinctOfficeholders = groups.filter((g) => g.isCurrent).length;
  const principalCount = principals.length;
  // Longest continuously-serving current officeholder (max tenure).
  let longest: { name: string; years: number } | null = null;
  for (const g of groups) {
    for (const s of g.stints) {
      if (!s.isCurrent) continue;
      const yrs = tenureYears(s.startDate, nowYear);
      if (yrs === null) continue;
      if (!longest || yrs > longest.years) {
        longest = { name: g.personName, years: yrs };
      }
    }
  }

  return (
    <div className="lead">
      {/* Stat strip — the at-a-glance summary of who currently governs. */}
      <div className="lead-stats">
        <div className="lead-stat">
          <p className="lead-stat-k">Current officeholders</p>
          <p className="lead-stat-v">{distinctOfficeholders}</p>
          <p className="lead-stat-sub">tracked by Civica</p>
        </div>
        <div className="lead-stat">
          <p className="lead-stat-k">Principal offices</p>
          <p className="lead-stat-v">{principalCount}</p>
          <p className="lead-stat-sub">
            {dualHolders.length > 0 ? "head of state & government" : "head of state / government"}
          </p>
        </div>
        <div className="lead-stat">
          <p className="lead-stat-k">Longest serving</p>
          <p className="lead-stat-v">
            {longest ? longest.years : "—"}
            {longest ? <span className="lead-stat-unit"> yrs</span> : null}
          </p>
          <p className="lead-stat-sub">{longest ? longest.name : "date unknown"}</p>
        </div>
      </div>

      {/* Principal leadership cards. */}
      {principals.length > 0 && (
        <section className="lead-block">
          <h3 className="lead-eyebrow">Principal leadership</h3>
          <ul className="lead-principals">
            {principals.map((p) => {
              const accent = accentForOffice(p.offices[0]!.officeType);
              const dual = p.offices.length > 1;
              const officeLabel = dual
                ? "Head of state & government"
                : titleCaseTitle(p.offices[0]!.officeName);
              // Earliest principal start for "since" + tenure.
              const startDates = p.offices
                .map((o) => o.startDate)
                .filter((d): d is string => Boolean(d))
                .sort();
              const since = startDates[0]
                ? formatMonthYear(startDates[0])
                : null;
              const yrs = startDates[0]
                ? tenureYears(startDates[0], nowYear)
                : null;
              // Party (rare): from whichever principal office carries one.
              const partyOffice = p.offices.find((o) => o.partyName);
              const born = formatBirthdate(p.media.dateOfBirth);
              const hasPortrait = Boolean(p.media.photoUrl);
              const credit = hasPortrait ? portraitCredit(p.media) : null;
              return (
                <li
                  key={p.personName}
                  className="lead-card"
                  style={{ ["--lead-accent" as string]: accent }}
                >
                  <span className="lead-card-source">
                    <SourceDot source="wikidata" retrievedAt={retrievedAt} />
                  </span>
                  <LeaderPortrait
                    photoFile={p.media.photoUrl}
                    personName={p.personName}
                    office={officeLabel}
                    credit={credit}
                  />
                  <div className="lead-card-body">
                    <p className="lead-card-office">
                      <span className="lead-card-office-dot" aria-hidden />
                      {officeLabel}
                    </p>
                    <div className="lead-card-name-row">
                      <h4 className="lead-card-name">{p.personName}</h4>
                    </div>
                    <div className="lead-card-meta">
                      {born && (
                        <span className="lead-born">
                          Born <span className="lead-born-date">{born}</span>
                        </span>
                      )}
                      {since && (
                        <span className="lead-since">
                          In office since{" "}
                          <span className="lead-since-date">{since}</span>
                        </span>
                      )}
                      {yrs !== null && (
                        <span className="lead-tenure">
                          <span className="lead-tenure-num">{yrs}</span>
                          {yrs === 1 ? "yr" : "yrs"}
                        </span>
                      )}
                      {partyOffice?.partyName && (
                        <span className="lead-party">
                          {partyOffice.partyColor && (
                            <span
                              aria-hidden
                              className="lead-party-dot"
                              style={{ background: partyOffice.partyColor }}
                            />
                          )}
                          {partyOffice.partyName}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {dualHolders.length > 0 && (
            <p className="lead-dual-note">
              {dualHolders.length === 1
                ? `${dualHolders[0]!.personName} serves as both head of state and head of government.`
                : "One person serves as both head of state and head of government, as in a presidential system."}
            </p>
          )}
        </section>
      )}

      {/* Tenure timeline — honest "in office since" plot (no past terms exist
          in the data, so this is the genuine temporal view we can build). */}
      {timelineEntries.length >= 2 && (
        <section className="lead-block">
          <h3 className="lead-eyebrow">Time in office</h3>
          <LeaderTenureTimeline entries={timelineEntries} nowYear={nowYear} />
        </section>
      )}

      {/* Other offices — only present for countries with deeper coverage. */}
      {branches.length > 0 && (
        <section className="lead-block">
          <h3 className="lead-eyebrow">Other offices</h3>
          <div className="lead-others">
            {branches.map((branch) => {
              const accent = accentForOffice(branch.type);
              return (
                <div
                  key={branch.label}
                  className="lead-branch"
                  style={{ ["--lead-accent" as string]: accent }}
                >
                  <p className="lead-branch-head">
                    <span className="lead-branch-dot" aria-hidden />
                    {branch.label}
                    <span className="lead-branch-count">
                      {branch.rows.length}
                    </span>
                  </p>
                  <div className="lead-rows">
                    {branch.rows.map(({ name, stint, media }, idx) => {
                      const since = parseYear(stint.startDate);
                      const hasPortrait = Boolean(media.photoUrl);
                      const rowCredit = hasPortrait
                        ? portraitCredit(media)
                        : null;
                      return (
                        <div
                          key={`${name}-${stint.officeName}-${idx}`}
                          className="lead-row"
                        >
                          <span className="lead-row-id">
                            <LeaderPortrait
                              photoFile={media.photoUrl}
                              personName={name}
                              office={titleCaseTitle(stint.officeName)}
                              credit={rowCredit}
                            />
                            <span className="lead-row-text">
                              <span className="lead-row-name">{name}</span>
                              <span className="lead-row-office">
                                {titleCaseTitle(stint.officeName)}
                              </span>
                            </span>
                          </span>
                          {stint.partyName ? (
                            <span className="lead-row-party">
                              {stint.partyColor && (
                                <span
                                  aria-hidden
                                  className="lead-party-dot"
                                  style={{ background: stint.partyColor }}
                                />
                              )}
                              {stint.partyName}
                            </span>
                          ) : (
                            <span />
                          )}
                          <span className="lead-row-since">
                            {since ? `since ${since}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <p className="lead-foot">
        <Chip variant="neutral" size="sm">
          Current officeholders only
        </Chip>
        Officeholders, offices, and term start dates from Wikidata. Portraits and
        birthdates are drawn from Wikidata and Wikimedia Commons where a freely
        licensed image exists; leaders without one show a monogram.
      </p>
    </div>
  );
}
