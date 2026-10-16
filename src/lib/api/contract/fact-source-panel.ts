import { z } from "zod";
import { DATA_VALUE_STATUSES } from "@/lib/data/value-state";

/**
 * Kept in its own module (not `schemas.ts`) because the source-panel
 * client imports it to validate the response, and `schemas.ts` pulls in
 * every public API contract.
 */

/* ────────────────────────────────────────────────────────────────
 * Fact source panel (internal, on-demand reader panel)
 * ────────────────────────────────────────────────────────────────
 * `GET /api/facts/:jurisdictionId/:factKey/panel` returns the reconciliation
 * detail shown when a reader opens a value's source panel: the evidence
 * relationship, the full resolver trace, and every source row (canonical,
 * alternate, projected, rejected). Country pages ship only a compact source
 * reference; this document is fetched when a panel is opened. It is an
 * internal reader endpoint, not a documented public `/api/v1` route.
 */

export const zFactSourcePanelRow = z
  .object({
    id: z.string(),
    sourceLabel: z.string(),
    isCanonical: z.boolean(),
    isRejected: z.boolean(),
    isProjected: z.boolean(),
    stackedValue: z.boolean(),
    value: z.string(),
    valueStatus: z.enum(DATA_VALUE_STATUSES),
    valueStatusReason: z.string().nullable(),
    asOfText: z.string(),
    vintageLabel: z.string().nullable(),
    growthBasisLabel: z.string().nullable(),
    sourceUrl: z.string().nullable(),
    statusReason: z.string().nullable(),
    producingFamily: z.string(),
    relationship: z.string(),
    independentEligible: z.boolean(),
  })
  .strict();

export const zFactSourcePanel = z
  .object({
    schemaVersion: z.literal("fact-source-panel/v1"),
    jurisdictionId: z.string(),
    factKey: z.string(),
    isDisputed: z.boolean(),
    canonicalId: z.string().nullable(),
    evidence: z
      .object({
        posture: z.enum([
          "single_source",
          "agreement",
          "resolver_selected",
          "unavailable",
        ]),
        heading: z.string(),
        explanation: z.string(),
        rationale: z.string(),
      })
      .strict(),
    trace: z.array(
      z.object({ code: z.string(), detail: z.string() }).strict(),
    ),
    rows: z.array(zFactSourcePanelRow),
    methodology: z
      .object({ version: z.string(), isBeta: z.boolean() })
      .strict(),
  })
  .strict();

export type FactSourcePanelRow = z.infer<typeof zFactSourcePanelRow>;
export type FactSourcePanel = z.infer<typeof zFactSourcePanel>;
