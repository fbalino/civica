import { getLeaderTimeline } from "@/lib/db/queries";
import { humanizeSectionLabel } from "@/lib/data/humanize-label";
import { SourceDot } from "@/components/SourceDot";

interface FactbookLeadersProps {
  jurisdictionId: string;
  countryName: string;
  // Optional — when the orchestrator already fetched the wikidata source's
  // last_sync_at it can pass it through. Without it the SourceDot still
  // renders, just with the "Not yet synced" tooltip.
  retrievedAt?: string | null;
}

interface OfficeStint {
  officeName: string;
  officeType: string;
  partyName: string | null;
  partyColor: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}

interface PersonGroup {
  personName: string;
  photoUrl: string | null;
  isCurrent: boolean;
  stints: OfficeStint[];
}

const OFFICE_RANK: Record<string, number> = {
  head_of_state: 0,
  head_of_government: 1,
  deputy_head: 2,
  cabinet: 3,
  legislative_leader: 4,
  judicial: 5,
};

function formatDateRange(start: string | null, end: string | null): string {
  const startYear = start ? new Date(start).getUTCFullYear() : null;
  const endYear = end ? new Date(end).getUTCFullYear() : null;
  if (!startYear && !endYear) return "Date unknown";
  if (startYear && !endYear) return `Since ${startYear}`;
  if (!startYear && endYear) return `Until ${endYear}`;
  if (startYear === endYear) return `${startYear}`;
  return `${startYear} – ${endYear}`;
}

// Two initials from a name. Avoids a broken-image flash when photoUrl is
// missing — which is currently every officeholder.
function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export async function FactbookLeaders({
  jurisdictionId,
  retrievedAt,
}: FactbookLeadersProps) {
  const rows = await getLeaderTimeline(jurisdictionId);
  if (rows.length === 0) return null;

  // Group by personName. (We don't get personId back from
  // getLeaderTimeline today, but the ingest path enforces unique names per
  // wikidata QID so this is safe in practice. If two distinct people ever
  // share a name they'd merge in this view — acceptable trade-off until we
  // surface personId in the query.)
  const groupMap = new Map<string, PersonGroup>();
  for (const row of rows) {
    let group = groupMap.get(row.personName);
    if (!group) {
      group = {
        personName: row.personName,
        photoUrl: row.photoUrl,
        isCurrent: false,
        stints: [],
      };
      groupMap.set(row.personName, group);
    }
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

  // Sort stints inside each card: head_of_state → head_of_government →
  // ... → other. Within rank, current first then newest start date.
  for (const group of groupMap.values()) {
    group.stints.sort((a, b) => {
      const ra = OFFICE_RANK[a.officeType] ?? 99;
      const rb = OFFICE_RANK[b.officeType] ?? 99;
      if (ra !== rb) return ra - rb;
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      const aT = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bT = b.startDate ? new Date(b.startDate).getTime() : 0;
      return bT - aT;
    });
  }

  // Sort the cards: current people first; among current, by their
  // top-ranked stint (head_of_state above head_of_government). Past
  // people sorted by their newest stint start date desc.
  const groups = [...groupMap.values()];
  groups.sort((a, b) => {
    if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
    if (a.isCurrent && b.isCurrent) {
      const ra = OFFICE_RANK[a.stints[0]!.officeType] ?? 99;
      const rb = OFFICE_RANK[b.stints[0]!.officeType] ?? 99;
      if (ra !== rb) return ra - rb;
    }
    const aT = a.stints[0]!.startDate
      ? new Date(a.stints[0]!.startDate!).getTime()
      : 0;
    const bT = b.stints[0]!.startDate
      ? new Date(b.stints[0]!.startDate!).getTime()
      : 0;
    return bT - aT;
  });

  const current = groups.filter((g) => g.isCurrent);
  const past = groups.filter((g) => !g.isCurrent);

  return (
    <div className="factbook-leaders">
      {current.length > 0 && (
        <LeaderSubsection
          eyebrow="Current"
          groups={current}
          retrievedAt={retrievedAt}
        />
      )}
      {past.length > 0 && (
        <LeaderSubsection
          eyebrow="Past"
          groups={past}
          retrievedAt={retrievedAt}
        />
      )}
    </div>
  );
}

function LeaderSubsection({
  eyebrow,
  groups,
  retrievedAt,
}: {
  eyebrow: string;
  groups: PersonGroup[];
  retrievedAt: string | null | undefined;
}) {
  return (
    <section className="factbook-leaders-group">
      <h3 className="factbook-leaders-eyebrow">{eyebrow}</h3>
      <ul className="factbook-leaders-list">
        {groups.map((group) => (
          <li key={group.personName} className="factbook-leaders-card">
            <div className="factbook-leaders-avatar" aria-hidden>
              {group.photoUrl ? (
                // Plain <img> on purpose — these are remote Wikimedia URLs
                // and the next/image domain allowlist isn't configured here.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={group.photoUrl} alt="" />
              ) : (
                <span className="factbook-leaders-avatar-fallback">
                  {initialsOf(group.personName)}
                </span>
              )}
            </div>
            <div className="factbook-leaders-body">
              <div className="factbook-leaders-name-row">
                <h4 className="factbook-leaders-name">{group.personName}</h4>
                <SourceDot source="wikidata" retrievedAt={retrievedAt} />
              </div>
              <ul className="factbook-leaders-stints">
                {group.stints.map((stint, idx) => (
                  <li
                    key={`${stint.officeName}-${stint.startDate ?? "x"}-${idx}`}
                    className="factbook-leaders-stint"
                  >
                    <span className="factbook-leaders-office">
                      {humanizeSectionLabel(stint.officeName)}
                    </span>
                    <span className="factbook-leaders-meta">
                      <span className="factbook-leaders-dates">
                        {formatDateRange(stint.startDate, stint.endDate)}
                      </span>
                      {stint.partyName && (
                        <span className="factbook-leaders-party">
                          {stint.partyColor && (
                            <span
                              aria-hidden
                              className="factbook-leaders-party-dot"
                              style={{ background: stint.partyColor }}
                            />
                          )}
                          {stint.partyName}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
