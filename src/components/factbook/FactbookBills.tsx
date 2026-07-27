import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { bills, governmentBodies, sources } from "@/lib/db/schema";
import { getBillsForJurisdiction } from "@/lib/db/queries";
import { SourceDot } from "@/components/SourceDot";
import { Banner } from "@/components/editorial/Banner";
import {
  BILLS_SOURCE_LABELS,
  BILLS_STAGE_LABELS,
  billsSupportedCoverageNote,
} from "@/lib/bills/coverage";
import { FactbookBillAskButton } from "./FactbookBillAskButton";

/**
 * Factbook · Bills (ATL-013)
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
 * This ONLY runs for the six bills-supported jurisdictions in practice —
 * `hasBills`/`isVisible("bills")` in the parent `civica-data/page.tsx`
 * (an Index-change-control-protected file, `src/lib/ci/index-change-control.ts`)
 * already excludes the whole numbered "Bills" section from the sidebar and
 * scroll column whenever `getBillsForJurisdiction` returns zero rows, so an
 * unsupported country (e.g. Japan) never reaches this component at all —
 * see `plan/evidence/ATL-013/README.md` for why that gate could not be
 * changed here and what a follow-up would need to do.
 *
 * Provenance: each row carries a SourceDot tied to the bill's
 * `sourceId` plus the matching `sources.last_sync_at` timestamp. A
 * coverage banner names the six supported jurisdictions and links to the
 * generated domain-coverage report (source, freshness, jurisdiction count).
 *
 * Civica AI: the per-bill "Ask Civica" button dispatches a `civica:ask`
 * CustomEvent on `window`; the factbook drawer listens and sends it.
 */

const SOURCE_TAG = BILLS_SOURCE_LABELS;

const STAGE_LABELS = BILLS_STAGE_LABELS;

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

  // Chamber — `bodyId` is a FK into `government_bodies`, populated by the
  // DE/FR/BR/CA sync adapters (not by US/UK; see the ATL-013 evidence doc
  // for why that half of the coverage set can't publish a chamber yet).
  // Best-effort: a lookup failure just omits the chip, never hides bills.
  const bodyIds = Array.from(
    new Set(result.rows.map((b) => b.bodyId).filter((id): id is string => !!id)),
  );
  const bodyMap = new Map<string, { name: string; chamberType: string | null }>();
  if (bodyIds.length > 0) {
    try {
      const bodyRows = await db
        .select({
          id: governmentBodies.id,
          name: governmentBodies.name,
          chamberType: governmentBodies.chamberType,
        })
        .from(governmentBodies)
        .where(inArray(governmentBodies.id, bodyIds));
      for (const r of bodyRows) {
        bodyMap.set(r.id, { name: r.name, chamberType: r.chamberType });
      }
    } catch {
      /* best-effort */
    }
  }

  // Pagination — this component always shows the latest `limit` (20) rows;
  // without a visible total, a reader can't tell a 20-bill jurisdiction
  // from a 4,000-bill jurisdiction truncated to 20. Best-effort count.
  let totalCount: number | null = null;
  try {
    const countRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(bills)
      .where(eq(bills.jurisdictionId, result.jurisdiction.id));
    totalCount = countRows[0] ? Number(countRows[0].count) : null;
  } catch {
    /* best-effort */
  }

  return (
    <div className="factbook-bills-list">
      <Banner variant="info" className="factbook-bill-coverage-note">
        {billsSupportedCoverageNote()} Showing the {result.rows.length} most recent
        {totalCount != null && totalCount > result.rows.length
          ? ` of ${totalCount.toLocaleString("en-US")} tracked ${countryName} bills`
          : ` tracked ${countryName} bills`}
        . See the{" "}
        <a href="/methodology/source-coverage#bills">
          source coverage report
        </a>{" "}
        for per-jurisdiction freshness.
      </Banner>
      {result.rows.map((b, i) => {
        const title = b.longTitle ? `${b.title} - ${b.longTitle}` : b.title;
        const tag = SOURCE_TAG[b.sourceId] ?? b.sourceId;
        const lastSyncAt = sourceMap.get(b.sourceId) ?? null;
        const chamber = b.bodyId ? bodyMap.get(b.bodyId) : undefined;
        const chamberLabel = chamber
          ? chamber.chamberType
            ? `${chamber.name} (${chamber.chamberType})`
            : chamber.name
          : null;
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
                {chamberLabel && (
                  <span className="factbook-bill-tag">{chamberLabel}</span>
                )}
                <SourceDot source={b.sourceId} retrievedAt={lastSyncAt} />
                {b.introducedDate && (
                  <span className="factbook-bill-meta">
                    Introduced {b.introducedDate}
                  </span>
                )}
                {b.lastActionDate && (
                  <span className="factbook-bill-meta">
                    Last action {b.lastActionDate}
                  </span>
                )}
                {b.rawStatus && (
                  <span className="factbook-bill-meta">
                    Status: {b.rawStatus}
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
