import {
  buildJurisdictionStatusPresentation,
  type JurisdictionStatusInput,
} from "./status-presentation";
import type { JurisdictionStatusType } from "./status-taxonomy";

/**
 * Checked jurisdiction directory contract (CAC-003).
 *
 * The site-wide header search and footer country list are mounted in the root
 * layout and must not reach the database on every request. They read the
 * checked `directory.generated.json` artifact instead, which freezes the
 * slow-moving identity fields below at deploy time. Regenerate with
 * `npm run generate:jurisdiction-directory`; drift against the live
 * `jurisdictions` table fails `npm run validate:jurisdiction-directory`.
 */
export const JURISDICTION_DIRECTORY_VERSION = "jurisdiction-directory/v1";

export type JurisdictionDirectoryRow = {
  slug: string;
  name: string;
  iso2: string | null;
  capital: string | null;
  statusType: JurisdictionStatusType;
  statusLabel: string;
};

export type JurisdictionDirectoryArtifact = {
  schemaVersion: typeof JURISDICTION_DIRECTORY_VERSION;
  generatedAt: string;
  rowCount: number;
  rowsSha256: string;
  rows: JurisdictionDirectoryRow[];
};

/** Raw `jurisdictions` fields the directory row derivation consumes. */
export type JurisdictionDirectorySourceRow = JurisdictionStatusInput & {
  name: string;
  iso2: string | null;
  capital: string | null;
};

/**
 * Derive directory rows from raw jurisdiction rows. Status fields go through
 * `buildJurisdictionStatusPresentation`, which fails closed on any stored
 * status inconsistency. Ordering is a deterministic codepoint sort on name
 * (slug tie-break) so the generator and validator agree regardless of
 * database collation.
 */
export function buildJurisdictionDirectoryRows(
  raw: JurisdictionDirectorySourceRow[],
): JurisdictionDirectoryRow[] {
  return raw
    .map((row) => {
      const status = buildJurisdictionStatusPresentation(row);
      return {
        slug: row.slug,
        name: row.name,
        iso2: row.iso2,
        capital: row.capital,
        statusType: status.type,
        statusLabel: status.label,
      };
    })
    .sort((a, b) =>
      a.name < b.name
        ? -1
        : a.name > b.name
          ? 1
          : a.slug < b.slug
            ? -1
            : a.slug > b.slug
              ? 1
              : 0,
    );
}
