/**
 * The canonical pre-DB shape every source adapter targets. Each adapter
 * (us-congress, uk-parliament, etc.) maps the source's payload to one or
 * more `BillIngest` rows; `upsertBills` then writes them to the `bills`
 * table.
 *
 * Field semantics:
 * - `externalId` is *source-side* and unique within a single source. The
 *   `(sourceId, externalId)` composite unique index in the schema makes
 *   re-syncs idempotent.
 * - `stage` is the 0-4 normalised value the BillsTab UI consumes. The
 *   `rawStatus` text is preserved verbatim for citation.
 * - `lastActionDate` is required because it drives the
 *   "10 most recent bills" query. If the source only exposes
 *   `updateDate`, fall back to that.
 * - `raw` keeps the full source payload so we can extract more fields
 *   later without re-syncing.
 */
export interface BillIngest {
  jurisdictionId: string;
  bodyId: string | null;
  sourceId: string;
  externalId: string;
  title: string;
  longTitle: string | null;
  summary: string | null;
  stage: number;
  rawStatus: string | null;
  introducedDate: string | null;
  lastActionDate: string;
  lastActionText: string | null;
  sponsorName: string | null;
  sponsorParty: string | null;
  url: string;
  textUrl: string | null;
  voteYes: number | null;
  voteNo: number | null;
  voteAbstain: number | null;
  raw: unknown;
}

/**
 * Pre-summarisation shape returned by source adapters. Adapters resolve
 * the jurisdiction + source IDs and stage; the caller then runs the
 * batch summariser to fill `summary`, then writes via `upsertBills`.
 */
export type BillIngestDraft = Omit<BillIngest, "summary"> & {
  summary?: string | null;
};

export type BillSourceEmptyReason =
  "upstream_returned_no_rows" | "no_bill_records_in_period";

/**
 * Per-upstream evidence returned by adapters that aggregate more than one
 * publisher feed. An empty successful feed is different from a failed feed:
 * the former may be a legitimate quiet period, while the latter must make the
 * whole scheduled sync fail before any rows or freshness are written.
 */
export type BillSourceFetchOutcome =
  | {
      sourceId: string;
      status: "success";
      /** Structured rows returned by the publisher before bill mapping. */
      fetched: number;
      /** Canonical drafts retained for this source after mapping/deduplication. */
      mapped: number;
      /** Required when a successful source maps no drafts. */
      emptyReason?: BillSourceEmptyReason;
    }
  | {
      sourceId: string;
      status: "failed";
      fetched: number;
      mapped: 0;
      error: string;
    };

export interface BillFetchBatch {
  drafts: BillIngestDraft[];
  sourceOutcomes: BillSourceFetchOutcome[];
}

export type BillFetchResult = BillIngestDraft[] | BillFetchBatch;
