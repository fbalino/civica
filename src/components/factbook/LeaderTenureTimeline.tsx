/*
 * LeaderTenureTimeline — a horizontal "in office since" plot of the current
 * officeholders for one country.
 *
 * HONESTY NOTE. The source (Wikidata via getLeaderTimeline) stores only
 * CURRENT terms — every term's end_date is null and is_current is true. There
 * is no historical sequence of past officeholders to draw a true "leadership
 * transitions" timeline from. What IS real and well-populated is each current
 * term's START date. So this component plots the genuine fact we have: when
 * each sitting leader took office, on a shared time axis. A longer bar = a
 * longer continuous tenure to date. This surfaces the real, interesting
 * signal (e.g. decades-long heads of state vs. a government sworn in last
 * year) without inventing predecessors, end dates, or transitions.
 *
 * Pure presentational server component; tokens only.
 */

export interface TenureEntry {
  personName: string;
  officeLabel: string;
  startYear: number;
  accent: string;
}

function yearsBetween(start: number, end: number): number {
  return Math.max(0, end - start);
}

export function LeaderTenureTimeline({
  entries,
  nowYear,
}: {
  entries: TenureEntry[];
  nowYear: number;
}) {
  // Need at least two dated officeholders for a comparison axis to mean
  // anything. The caller already filters to dated entries; guard anyway.
  if (entries.length < 2) return null;

  const earliest = Math.min(...entries.map((e) => e.startYear));
  // Pad the left so the longest-serving bar doesn't pin to the very edge.
  const axisStart = earliest === nowYear ? nowYear - 1 : earliest;
  const span = Math.max(1, nowYear - axisStart);

  // Sort longest-serving first — the most editorially interesting at top.
  const sorted = [...entries].sort((a, b) => a.startYear - b.startYear);

  return (
    <div className="lead-timeline">
      <p className="lead-timeline-caption">
        Continuous time in office for each sitting officeholder, measured from
        the start of their current term. Bars extend to today.
      </p>
      <div className="lead-timeline-rows">
        {sorted.map((e, idx) => {
          const years = yearsBetween(e.startYear, nowYear);
          // Bar width as a share of the axis span (anchored to the right edge).
          const widthPct = Math.min(
            100,
            Math.max(4, (yearsBetween(axisStart, e.startYear) === 0
              ? span
              : nowYear - e.startYear) / span * 100)
          );
          return (
            <div
              className="lead-tl-row"
              key={`${e.personName}-${e.officeLabel}-${idx}`}
              style={{ ["--lead-accent" as string]: e.accent }}
            >
              <div className="lead-tl-head">
                <span className="lead-tl-name">
                  {e.personName}
                  <span className="lead-tl-office">{e.officeLabel}</span>
                </span>
                <span className="lead-tl-years">
                  {years === 0 ? "< 1 yr" : `${years} yr${years === 1 ? "" : "s"}`}
                </span>
              </div>
              <div className="lead-tl-track">
                <span
                  className="lead-tl-bar"
                  style={{ width: `${Math.round(widthPct * 100) / 100}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="lead-tl-axis" aria-hidden>
        <span>{axisStart}</span>
        <span>{nowYear}</span>
      </div>
    </div>
  );
}
