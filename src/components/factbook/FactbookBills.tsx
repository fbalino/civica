import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema";
import { getBillsForJurisdiction } from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { FactbookBillAskButton } from "./FactbookBillAskButton";

/**
 * Factbook · Bills
 *
 * Server component that ports the visual + behavioural contract of the
 * legacy Atlas `BillsTab` into the new factbook reader page. Reads the
 * 20 most recent rows from the `bills` table (populated by the per-source
 * sync scripts under `scripts/sync-bills-*` and the matching cron routes
 * under `/api/cron/bills/*`).
 *
 * Empty state: returns null so the orchestrator can hide the section
 * entirely (matching how visibleSections filters out empty CIA factbook
 * sections in `(reader)/factbook/[slug]/page.tsx`).
 *
 * Provenance: each row carries a SourceDot tied to the bill's
 * `sourceId` plus the matching `sources.last_sync_at` timestamp.
 *
 * Civica AI: the per-bill "Ask Civica" button dispatches a `civica:ask`
 * CustomEvent on `window`; the factbook drawer listens and sends it.
 */

const SOURCE_TAG: Record<string, string> = {
  congress_gov: "U.S. Congress",
  uk_parliament: "UK Parliament",
  legisinfo_ca: "Parliament of Canada",
  camara_br: "Câmara dos Deputados",
  senado_br: "Senado Federal",
  bundestag_dip: "Bundestag",
  data_assemblee_fr: "Assemblée Nationale",
  senat_fr: "Sénat",
};

const STAGE_LABELS = ["Draft", "Committee", "Lower Floor", "Upper House", "Enacted"];

export interface FactbookBillsProps {
  countrySlug: string;
  countryName: string;
}

export async function FactbookBills({
  countrySlug,
  countryName,
}: FactbookBillsProps) {
  let result;
  try {
    result = await getBillsForJurisdiction(countrySlug, 20);
  } catch {
    // DB unavailable — same posture as the API route: hide the section.
    return null;
  }
  if (!result || result.rows.length === 0) return null;

  // Look up sources.last_sync_at once for the distinct sources in
  // the result so each bill row carries its own provenance dot.
  const sourceIds = Array.from(new Set(result.rows.map((b) => b.sourceId)));
  const sourceMap = new Map<string, string | null>();
  if (sourceIds.length > 0) {
    try {
      const rows = await db
        .select({ id: sources.id, lastSyncAt: sources.lastSyncAt })
        .from(sources)
        .where(inArray(sources.id, sourceIds));
      for (const r of rows) {
        sourceMap.set(
          r.id,
          r.lastSyncAt ? r.lastSyncAt.toISOString() : null,
        );
      }
    } catch {
      /* best-effort */
    }
  }

  return (
    <div className="factbook-bills-list">
      {result.rows.map((b, i) => {
        const title = b.longTitle ? `${b.title} - ${b.longTitle}` : b.title;
        const tag = SOURCE_TAG[b.sourceId] ?? b.sourceId;
        const lastSyncAt = sourceMap.get(b.sourceId) ?? null;
        const votes =
          b.voteYes != null && b.voteNo != null
            ? {
                yes: b.voteYes,
                no: b.voteNo,
                abs: b.voteAbstain ?? 0,
              }
            : null;

        return (
          <article key={b.id} className="factbook-bill">
            <div className="factbook-bill-idx">
              {String(i + 1).padStart(2, "0")}
            </div>

            <div className="factbook-bill-body">
              <h3 className="factbook-bill-title">{title}</h3>

              {b.summary && (
                <p className="factbook-bill-summary">{b.summary}</p>
              )}

              <div className="factbook-bill-tags">
                <span className="factbook-bill-tag">{tag}</span>
                <SourceDot source={b.sourceId} retrievedAt={lastSyncAt} />
                {b.lastActionDate && (
                  <span className="factbook-bill-meta">
                    Last action {b.lastActionDate}
                  </span>
                )}
                {b.sponsorName && (
                  <span className="factbook-bill-meta">
                    Sponsor: {b.sponsorName}
                  </span>
                )}
              </div>

              <div className="factbook-bill-timeline" aria-hidden="true">
                {STAGE_LABELS.map((_, j) => (
                  <span key={`row-${j}`} className="factbook-bill-timeline-step">
                    <span
                      className={
                        "factbook-bill-dot" +
                        (j < b.stage
                          ? " is-done"
                          : j === b.stage
                          ? " is-now"
                          : "")
                      }
                    />
                    {j < STAGE_LABELS.length - 1 && (
                      <span className="factbook-bill-line" />
                    )}
                  </span>
                ))}
              </div>
              <div className="factbook-bill-tlabs">
                {STAGE_LABELS.map((s) => (
                  <span key={s}>{s}</span>
                ))}
              </div>

              {votes && (() => {
                const tot = votes.yes + votes.no + votes.abs;
                if (tot <= 0) return null;
                const y = (votes.yes / tot) * 100;
                const n = (votes.no / tot) * 100;
                const a = (votes.abs / tot) * 100;
                return (
                  <>
                    <div className="factbook-bill-vote-bar">
                      <span
                        className="factbook-bill-vote-yes"
                        style={{ width: `${y}%` }}
                      />
                      <span
                        className="factbook-bill-vote-no"
                        style={{ width: `${n}%` }}
                      />
                      <span
                        className="factbook-bill-vote-abs"
                        style={{ width: `${a}%` }}
                      />
                    </div>
                    <div className="factbook-bill-vote-row">
                      <span>Yes {votes.yes}</span>
                      <span>No {votes.no}</span>
                      <span>Abs {votes.abs}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            <div className="factbook-bill-actions">
              {b.url && (
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="factbook-bill-btn"
                >
                  Official Text →
                </a>
              )}
              <FactbookBillAskButton title={title} countryName={countryName} />
            </div>
          </article>
        );
      })}
    </div>
  );
}
