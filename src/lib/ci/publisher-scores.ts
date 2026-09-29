/**
 * Country publisher measures — the pure contract (CLM-020,
 * publisher-attribution/v1). DB-free: `src/lib/db/queries-scores.ts` reads the
 * frozen release rows and shapes them here, so reader components, the
 * design-system demo, the scores API, and the validators can use this module
 * without reaching the database.
 *
 * The country Civica Data "Rankings" section and
 * GET /api/countries/:slug/scores show the two publisher measures held in the
 * frozen Civica Index release (CURRENT_CI_RELEASE_ID):
 *
 *   1. V-Dem Liberal Democracy Index (`v2x_libdem`): V-Dem's own figure on
 *      its native 0–1 scale, at V-Dem's published precision (three decimals).
 *   2. Freedom House status: Free, Partly Free, or Not Free, with the Freedom
 *      in the World edition. Civica's frozen release stored Freedom House's
 *      two ratings (political rights and civil liberties, as their 2–14 sum)
 *      but not the workbook's status column, so the status comes from applying
 *      Freedom House's own published rule to the stored ratings. The row shows
 *      no number.
 *
 * Attribution rule: a value shown beside a publisher's name is that
 * publisher's own figure, or a category produced by the publisher's own rule.
 * This contract carries no Civica rescale, rank, trend, or composite.
 *
 * Four clocks (APR-D058) stay separate on every row:
 *   1. `observationPeriod` — the year the publisher's figure describes;
 *   2. `publisherEdition` — the publisher release the figure comes from;
 *   3. `retrievedAt` — the retrieval time recorded for the input in the
 *      release's hash-bound input manifest (one capture-record time shared by
 *      the release's four inputs);
 *   4. `release` — the frozen Civica Index release that holds the row.
 * The release rows' temporal-coverage label ("2024") is the Freedom in the
 * World edition year, not the year it covers, so it is never used here.
 */

import { z } from "zod";

import type { PublisherValueOrigin } from "@/lib/provenance/publisher-attribution";

import { CURRENT_CI_RELEASE_ID } from "./current-release";
import { resolveCiRelease } from "./release-selection";

export const SCORE_ROW_CONTRACT = "country-publisher-scores/v2" as const;
export const SCORE_ROW_IDS = ["vdem-libdem", "freedom-house"] as const;
export type ScoreRowId = (typeof SCORE_ROW_IDS)[number];
export const FREEDOM_HOUSE_STATUSES = ["Free", "Partly Free", "Not Free"] as const;
export type FreedomHouseStatus = (typeof FREEDOM_HOUSE_STATUSES)[number];

/** The release identity a score row carries: exactly what its chip needs. */
export interface ScoreRowRelease {
  releaseId: string;
  quarter: string;
  vintageLabel: string;
}

const CI_RELEASE = resolveCiRelease(CURRENT_CI_RELEASE_ID);

const CI_RELEASE_IDENTITY: ScoreRowRelease = Object.freeze({
  releaseId: CI_RELEASE.releaseId,
  quarter: CI_RELEASE.quarter,
  vintageLabel: CI_RELEASE.vintageLabel,
});

/**
 * One publisher measure in the country Civica Data "Rankings" table
 * (country-publisher-scores/v2).
 *
 * The displayed value is the publisher's own figure (`publisher_published`)
 * or a category produced by applying the publisher's own published rule to
 * stored publisher figures (`publisher_rule_applied`). The contract carries no
 * Civica rescale, rank, trend, or composite.
 */
export interface ScoreRow {
  id: ScoreRowId;
  /** Publisher measure named in the Measure column. */
  label: string;
  /** The publisher's own number on its native scale (V-Dem 0.769). Null for
   *  the Freedom House row, whose displayed value is a category. */
  score: number | null;
  /** The publisher category shown instead of a number; otherwise null. */
  category: FreedomHouseStatus | null;
  /** Exact Value-cell text: "0.769" or "Free · Freedom in the World 2024". */
  scoreFormatted: string;
  /** How the displayed value relates to the publisher's figures. */
  valueOrigin: PublisherValueOrigin;
  /** SOURCE_NAMES key for <SourceDot>. */
  source: "vdem" | "freedom_house";
  /** Clock 2 — the publisher release the value comes from. */
  publisherEdition: string;
  /** Clock 1 — the year the publisher's figure describes ("2023"). */
  observationPeriod: string;
  /** Clock 1 in words for the SourceDot ("covering calendar year 2023"). */
  observationPeriodLabel: string;
  /** Clock 3 — ISO 8601 UTC retrieval time recorded in the release input
   *  manifest. Never a year, a quarter, or a Civica release label. */
  retrievedAt: string;
  /** Clock 4 — the frozen Civica Index release that holds the row. */
  freshness: "frozen_release";
  release: ScoreRowRelease;
}

/**
 * Freedom House's published status rule. The frozen release stored the
 * Political Rights and Civil Liberties ratings but not the workbook's Status
 * column (`parseFreedomHouse` in production-source-adapters.ts keeps only the
 * ratings), so Civica applies the rule: a Freedom Rating (the average of the
 * two ratings) of 1.0–2.5 is Free, 3.0–5.0 Partly Free, and 5.5–7.0 Not Free
 * (FIW 2019 Methodology p.4; the FIW FAQ states that the formula converting
 * scores into status is unchanged since the 2020 edition). Verified
 * 2026-09-29 against Freedom House's FIW 2024 country pages at the rule's
 * boundaries: Colombia and Brazil (sum 5) Free; India and Ecuador (sum 6)
 * Partly Free; Niger and Pakistan (sum 10) Partly Free; Turkey (sum 11) Not
 * Free. The stored value is the 2–14 sum, so the Freedom Rating is sum ÷ 2.
 */
export const FREEDOM_HOUSE_STATUS_RULE = Object.freeze({
  ruleId: "freedom-house-status-from-ratings/v1",
  sourceUrls: Object.freeze([
    "https://freedomhouse.org/sites/default/files/2020-02/Methodology_FIW_2019_for_website.pdf",
    "https://freedomhouse.org/reports/freedom-world/faq-freedom-world",
  ]),
  verifiedOn: "2026-09-29",
  ruleText:
    "Civica's frozen release stored Freedom House's political rights and civil liberties ratings but not its status column, so Civica applied Freedom House's published rule to those ratings: an average rating of 1.0 to 2.5 is Free, 3.0 to 5.0 is Partly Free, and 5.5 to 7.0 is Not Free.",
  apply(prClSum: number): FreedomHouseStatus {
    if (!Number.isInteger(prClSum) || prClSum < 2 || prClSum > 14) {
      throw new RangeError(
        `Freedom House PR+CL sum must be an integer from 2 to 14; received ${prClSum}`,
      );
    }
    const freedomRating = prClSum / 2;
    if (freedomRating <= 2.5) return "Free";
    if (freedomRating <= 5) return "Partly Free";
    return "Not Free";
  },
});

/**
 * Clocks 1–3 for the two release rows, copied from the release's hash-bound
 * input manifest (data/releases/ci-beta-2024-Q4/source-input-manifest.v1.json,
 * whose SHA-256 is the release contract's inputManifestSha256) and from the
 * adapters' dataset year (CI_RELEASE_DATASET_YEAR, the V-Dem observation year
 * and the Freedom in the World edition year). publisher-scores.test.ts proves
 * every value against those sources, so a release change cannot ship with
 * stale clocks.
 */
export const RELEASE_PUBLISHER_INPUTS = Object.freeze({
  releaseId: "ci-beta-r5-2024-Q4",
  vdem: Object.freeze({
    publisherEdition: "V-Dem Country-Year Core v15",
    observationPeriod: "2024",
    observationPeriodLabel: "covering 2024",
    retrievedAt: "2026-07-10T20:56:16.125Z",
    contentSha256:
      "bd6430d6b78785c7422acee7d75bef1b852f2ce1baa5f673ae40ffca64ffe51b",
  }),
  freedom_house: Object.freeze({
    publisherEdition: "Freedom in the World 2024",
    observationPeriod: "2023",
    observationPeriodLabel: "covering calendar year 2023",
    retrievedAt: "2026-07-10T20:56:16.125Z",
    contentSha256:
      "d6ac861af6e7dcea7e870e39ddbcd2925730a653c1466f8992a7d0005f53be88",
  }),
});

/** V-Dem publishes v2x_libdem with three decimals. */
const VDEM_PUBLISHED_DECIMALS = 3;

export function shapeVdemScoreRow(rawValue: number): ScoreRow {
  if (!Number.isFinite(rawValue) || rawValue < 0 || rawValue > 1) {
    throw new RangeError(
      `V-Dem v2x_libdem must be a finite value from 0 to 1; received ${rawValue}`,
    );
  }
  const input = RELEASE_PUBLISHER_INPUTS.vdem;
  const formatted = rawValue.toFixed(VDEM_PUBLISHED_DECIMALS);
  return {
    id: "vdem-libdem",
    label: "V-Dem Liberal Democracy Index",
    score: Number(formatted),
    category: null,
    scoreFormatted: formatted,
    valueOrigin: { kind: "publisher_published" },
    source: "vdem",
    publisherEdition: input.publisherEdition,
    observationPeriod: input.observationPeriod,
    observationPeriodLabel: input.observationPeriodLabel,
    retrievedAt: input.retrievedAt,
    freshness: "frozen_release",
    release: CI_RELEASE_IDENTITY,
  };
}

export function shapeFreedomHouseScoreRow(prClSum: number): ScoreRow {
  const input = RELEASE_PUBLISHER_INPUTS.freedom_house;
  const category = FREEDOM_HOUSE_STATUS_RULE.apply(prClSum);
  return {
    id: "freedom-house",
    label: "Freedom House status",
    score: null,
    category,
    scoreFormatted: `${category} · ${input.publisherEdition}`,
    valueOrigin: {
      kind: "publisher_rule_applied",
      ruleId: FREEDOM_HOUSE_STATUS_RULE.ruleId,
      note: `${input.publisherEdition} covers calendar year ${input.observationPeriod}. ${FREEDOM_HOUSE_STATUS_RULE.ruleText}`,
    },
    source: "freedom_house",
    publisherEdition: input.publisherEdition,
    observationPeriod: input.observationPeriod,
    observationPeriodLabel: input.observationPeriodLabel,
    retrievedAt: input.retrievedAt,
    freshness: "frozen_release",
    release: CI_RELEASE_IDENTITY,
  };
}

// ---- Public API shape (GET /api/countries/:slug/scores) --------------------

/** Source-specific export rights, as the rights manifest reports them. */
export interface ScoreRowRights {
  exportPermission: string;
  termsUrl: string;
}

const zScoreRowRelease = z
  .object({
    releaseId: z.string().min(1),
    quarter: z.string().regex(/^\d{4}-Q[1-4]$/),
    vintageLabel: z.string().min(1),
  })
  .strict();

const zPublisherValueOrigin = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("publisher_published") }).strict(),
  z
    .object({
      kind: z.literal("publisher_rule_applied"),
      ruleId: z.string().min(1),
      note: z.string().min(1),
    })
    .strict(),
]);

export const zPublicScoreRow = z
  .object({
    id: z.enum(SCORE_ROW_IDS),
    label: z.string().min(1),
    valueStatus: z.enum(["observed", "withheld"]),
    score: z.number().nullable(),
    category: z.enum(FREEDOM_HOUSE_STATUSES).nullable(),
    scoreFormatted: z.string().min(1).nullable(),
    withheldReason: z.string().min(1).nullable(),
    valueOrigin: zPublisherValueOrigin,
    source: z.enum(["vdem", "freedom_house"]),
    publisherEdition: z.string().min(1),
    observationPeriod: z.string().regex(/^\d{4}$/),
    retrievedAt: z.string().datetime(),
    exportPermission: z.string().min(1),
    termsUrl: z.string().min(1),
    freshness: z.literal("frozen_release"),
    release: zScoreRowRelease,
  })
  .strict()
  .superRefine((row, context) => {
    const report = (message: string) =>
      context.addIssue({ code: "custom", message });
    if (row.valueStatus === "withheld") {
      if (row.score !== null || row.category !== null || row.scoreFormatted !== null) {
        report("a withheld row must not carry a value");
      }
      if (row.withheldReason === null) report("a withheld row needs a reason");
      return;
    }
    if (row.withheldReason !== null) report("an observed row has no withheld reason");
    if (row.valueOrigin.kind === "publisher_rule_applied") {
      if (row.score !== null || row.category === null) {
        report("a rule-applied row carries a category and no number");
      }
    } else if (row.score === null || row.category !== null) {
      report("a publisher-published row carries the publisher's number and no category");
    }
  });

export const zPublicCountryScores = z
  .object({
    contract: z.literal(SCORE_ROW_CONTRACT),
    country: z.string().min(1),
    notice: z.string().min(1),
    rows: z.array(zPublicScoreRow),
  })
  .strict();

export type PublicCountryScores = z.infer<typeof zPublicCountryScores>;

/**
 * Rights-filtered public response. Values stay only for sources whose
 * verified terms permit public export, the same rule as the Governance
 * Evidence API; every other row keeps its labels, clocks, origin, and terms
 * link without redistributing the publisher's figure.
 */
export function shapePublicCountryScores(
  countryName: string,
  rows: readonly ScoreRow[],
  rightsFor: (sourceId: string) => ScoreRowRights,
): PublicCountryScores {
  return zPublicCountryScores.parse({
    contract: SCORE_ROW_CONTRACT,
    country: countryName,
    notice:
      "Only measures with verified public-export permission retain values. Withheld rows link to the publisher's terms.",
    rows: rows.map((row) => {
      const rights = rightsFor(row.source);
      const canExport = rights.exportPermission === "allowed";
      return {
        id: row.id,
        label: row.label,
        valueStatus: canExport ? "observed" : "withheld",
        score: canExport ? row.score : null,
        category: canExport ? row.category : null,
        scoreFormatted: canExport ? row.scoreFormatted : null,
        withheldReason: canExport
          ? null
          : "Civica bulk redistribution is blocked pending or under publisher terms; use termsUrl.",
        valueOrigin: row.valueOrigin,
        source: row.source,
        publisherEdition: row.publisherEdition,
        observationPeriod: row.observationPeriod,
        retrievedAt: row.retrievedAt,
        exportPermission: rights.exportPermission,
        termsUrl: rights.termsUrl,
        freshness: row.freshness,
        release: row.release,
      };
    }),
  });
}
