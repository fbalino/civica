/**
 * ATL-013 — audit bills/legislative-activity coverage and narrow claims to
 * supported jurisdictions.
 *
 * Findings this suite locks (full writeup:
 * `plan/evidence/ATL-013/README.md`):
 *
 *   1. JURISDICTION COVERAGE — `src/lib/bills/coverage.ts`'s
 *      `BILLS_SUPPORTED_JURISDICTIONS` is derived from, and here verified
 *      against, the six ACTUAL deployed cron routes
 *      (`src/app/api/cron/bills/{us,uk,ca,de,fr,br}/route.ts`) and their
 *      source adapters' real `SOURCE_ID` constants — not a guess that could
 *      drift from what the crons actually sync.
 *   2. SOURCE / STATUS TAXONOMY / DATE SEMANTICS / CHAMBER / PAGINATION —
 *      `FactbookBills.tsx` (the live Civica Data → Bills renderer) and the
 *      public `/api/countries/[slug]/bills` route both publish: per-row
 *      source label + `SourceDot` freshness, the 0–4 stage taxonomy AND the
 *      publisher's raw status text, BOTH `introducedDate` and
 *      `lastActionDate` (distinct semantics), a resolved chamber name where
 *      `bodyId` is populated (DE/FR/BR/CA), and a shown-vs-total count.
 *   3. UNSUPPORTED-COUNTRY EXPLANATION — the public API route now returns
 *      an explicit `coverage` object (naming the six supported
 *      jurisdictions) instead of a bare empty `bills: []` for a jurisdiction
 *      outside the coverage set.
 *   4. A genuine, DEFERRED gap: on the Civica Data tab itself, the whole
 *      numbered "Bills" section (sidebar entry + content block) is computed
 *      by `hasBills`/`isVisible("bills")` in
 *      `src/app/(reader)/country/[slug]/civica-data/page.tsx`, which is an
 *      Index-change-control-protected file (`src/lib/ci/index-change-control.ts`).
 *      That gate excludes the section entirely — not misleadingly-empty,
 *      but silently absent — whenever `getBillsForJurisdiction` (also
 *      protected, in `src/lib/db/queries.ts`) returns zero rows, which is
 *      every unsupported country. Neither protected file was edited here
 *      (out of scope per the task brief); this suite locks that the gate
 *      still has this exact shape so the gap stays visible and traceable to
 *      the two protected files that block an in-tab fix.
 *
 * Pure + source-backed: no DB, no network. Runs under `npm test`.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getTableColumns } from "drizzle-orm";

import {
  BILLS_SOURCE_LABELS,
  BILLS_STAGE_LABELS,
  BILLS_SUPPORTED_JURISDICTIONS,
  BILLS_SUPPORTED_JURISDICTION_NAMES,
  billsCoverageMessage,
  billsSupportedCoverageNote,
  isBillsSupportedSlug,
} from "@/lib/bills/coverage";
import { bills, governmentBodies } from "@/lib/db/schema";
import { INDEX_PROTECTED_FILES } from "@/lib/ci/index-change-control";

const read = (path: string) => readFileSync(path, "utf8");

const CRON_ROUTES: Record<string, string> = {
  us: "src/app/api/cron/bills/us/route.ts",
  uk: "src/app/api/cron/bills/uk/route.ts",
  ca: "src/app/api/cron/bills/ca/route.ts",
  de: "src/app/api/cron/bills/de/route.ts",
  fr: "src/app/api/cron/bills/fr/route.ts",
  br: "src/app/api/cron/bills/br/route.ts",
};

const FACTBOOK_BILLS = "src/components/factbook/FactbookBills.tsx";
const BILLS_API_ROUTE = "src/app/api/countries/[slug]/bills/route.ts";
const CIVICA_DATA_PAGE = "src/app/(reader)/country/[slug]/civica-data/page.tsx";

test("BILLS_SUPPORTED_JURISDICTIONS has exactly six entries — one per deployed cron", () => {
  assert.equal(Object.keys(CRON_ROUTES).length, 6);
  assert.equal(BILLS_SUPPORTED_JURISDICTIONS.length, 6);
});

test("each cron route's real jurisdictionSlug/iso2 matches coverage.ts exactly (no drift)", () => {
  for (const routePath of Object.values(CRON_ROUTES)) {
    const source = read(routePath);
    const slugMatch = source.match(/jurisdictionSlug:\s*"([^"]+)"/);
    const iso2Match = source.match(/iso2:\s*"([^"]+)"/);
    assert.ok(slugMatch, `${routePath} must declare jurisdictionSlug`);
    assert.ok(iso2Match, `${routePath} must declare iso2`);
    const declared = BILLS_SUPPORTED_JURISDICTIONS.find(
      (j) => j.slug === slugMatch![1],
    );
    assert.ok(
      declared,
      `coverage.ts is missing the jurisdiction "${slugMatch![1]}" synced by ${routePath}`,
    );
    assert.equal(
      declared!.iso2,
      iso2Match![1],
      `coverage.ts iso2 for ${declared!.slug} must match ${routePath}`,
    );
  }
  // And the reverse: coverage.ts must not claim a jurisdiction no cron syncs.
  const cronSlugs = Object.values(CRON_ROUTES).map(
    (p) => read(p).match(/jurisdictionSlug:\s*"([^"]+)"/)![1],
  );
  for (const j of BILLS_SUPPORTED_JURISDICTIONS) {
    assert.ok(
      cronSlugs.includes(j.slug),
      `coverage.ts claims "${j.slug}" is supported but no cron route syncs it`,
    );
  }
});

test("each declared sourceId is the adapter's real SOURCE_ID constant, not an invented label", () => {
  const adapterFiles: Record<string, string> = {
    congress_gov: "src/lib/bills/sources/us-congress.ts",
    uk_parliament: "src/lib/bills/sources/uk-parliament.ts",
    legisinfo_ca: "src/lib/bills/sources/legisinfo-ca.ts",
    bundestag_dip: "src/lib/bills/sources/bundestag-dip.ts",
    data_assemblee_fr: "src/lib/bills/sources/an-senat-fr.ts",
    senat_fr: "src/lib/bills/sources/an-senat-fr.ts",
    camara_br: "src/lib/bills/sources/camara-senado-br.ts",
    senado_br: "src/lib/bills/sources/camara-senado-br.ts",
  };
  const allDeclaredSourceIds = BILLS_SUPPORTED_JURISDICTIONS.flatMap(
    (j) => j.sourceIds,
  );
  assert.deepEqual(
    new Set(allDeclaredSourceIds),
    new Set(Object.keys(adapterFiles)),
    "coverage.ts sourceIds must exactly match the known adapter source ids",
  );
  for (const [sourceId, filePath] of Object.entries(adapterFiles)) {
    const source = read(filePath);
    assert.ok(
      new RegExp(`SOURCE_ID\\s*=\\s*"${sourceId}"`).test(source) ||
        source.includes(`"${sourceId}"`),
      `${filePath} must actually define/use source id "${sourceId}"`,
    );
  }
  // BILLS_SOURCE_LABELS (rendered per-row on the Bills UI + API) must have a
  // real, non-placeholder label for every declared source id.
  for (const sourceId of allDeclaredSourceIds) {
    const label = BILLS_SOURCE_LABELS[sourceId];
    assert.ok(label && label.length > 0, `missing display label for ${sourceId}`);
    assert.notEqual(label, sourceId, `${sourceId} label must not be a raw id echo`);
  }
});

test("isBillsSupportedSlug is true for the six covered countries and false for uncovered ones", () => {
  for (const j of BILLS_SUPPORTED_JURISDICTIONS) {
    assert.equal(isBillsSupportedSlug(j.slug), true, j.slug);
  }
  for (const slug of ["japan", "nigeria", "india", "south-africa"]) {
    assert.equal(isBillsSupportedSlug(slug), false, slug);
  }
});

test("billsCoverageMessage (unsupported-country copy) names all six jurisdictions and the subject country", () => {
  const msg = billsCoverageMessage("Japan");
  for (const name of BILLS_SUPPORTED_JURISDICTION_NAMES) {
    assert.ok(msg.includes(name), `message must name ${name}`);
  }
  assert.ok(msg.includes("Japan"));
  assert.match(msg, /not yet in that set/);
});

test("billsSupportedCoverageNote (supported-country copy) names all six jurisdictions but never claims non-coverage", () => {
  const note = billsSupportedCoverageNote();
  for (const name of BILLS_SUPPORTED_JURISDICTION_NAMES) {
    assert.ok(note.includes(name), `note must name ${name}`);
  }
  // Regression lock: an earlier draft of this fix reused billsCoverageMessage
  // inside FactbookBills.tsx, which only ever renders for a SUPPORTED
  // country — that produced the self-contradictory "United States ... is not
  // yet in that set" on a live United States page, caught by browser QA.
  assert.doesNotMatch(note, /not yet in that set/);
  assert.doesNotMatch(note, /is not/);
});

test("the public bills API route returns an explicit coverage object, not a bare empty array, for unsupported countries", () => {
  const source = read(BILLS_API_ROUTE);
  assert.match(
    source,
    /isBillsSupportedSlug/,
    "route must decide supported/unsupported using the shared coverage contract",
  );
  assert.match(
    source,
    /coverage\s*[:=]/,
    "route must attach a `coverage` field to the response",
  );
  assert.match(
    source,
    /supportedJurisdictions/,
    "the coverage object must name which jurisdictions are covered",
  );
  assert.match(
    source,
    /not yet in that set/,
    "unsupported jurisdictions must get an explanatory message, not silence",
  );
});

test("FactbookBills publishes source, chamber, status taxonomy, and both date fields for supported countries", () => {
  const source = read(FACTBOOK_BILLS);
  // Source + freshness (already honest before this task — locked here too).
  assert.match(source, /SourceDot/);
  assert.match(source, /sources\.lastSyncAt/);
  // Chamber — resolves government_bodies.name for bills with a bodyId.
  assert.match(source, /governmentBodies/);
  assert.match(source, /chamberType/);
  // Status taxonomy — the 0-4 stage timeline AND the publisher's raw text.
  assert.match(source, /STAGE_LABELS/);
  assert.match(source, /b\.rawStatus/);
  // Date semantics — introduced vs last-action are shown as distinct facts.
  assert.match(source, /b\.introducedDate/);
  assert.match(source, /Introduced/);
  assert.match(source, /b\.lastActionDate/);
  assert.match(source, /Last action/);
  // Pagination — a visible shown-vs-total count, not a silent top-20 cut.
  assert.match(source, /totalCount/);
  // Jurisdiction coverage — named in-context, linking to the domain report,
  // using the SUPPORTED-country note (not the unsupported-country message,
  // which would wrongly say a supported country "is not yet in that set" —
  // this exact bug shipped once in development and was caught by browser QA).
  assert.match(source, /billsSupportedCoverageNote/);
  assert.doesNotMatch(
    source,
    /not yet in that set/,
    "FactbookBills only ever renders for a SUPPORTED country; it must never use the unsupported-country message",
  );
  assert.match(source, /methodology\/source-coverage/);
});

test("the 0-4 stage taxonomy has exactly five labels, matching the schema's documented scale", () => {
  assert.equal(BILLS_STAGE_LABELS.length, 5);
  const schemaSource = read("src/lib/db/schema.ts");
  assert.match(
    schemaSource,
    /0=draft,\s*1=committee,\s*2=floor,\s*3=passed,\s*4=enacted/,
    "coverage.ts stage labels must stay aligned with the schema's documented 0-4 scale",
  );
});

test("bills / government_bodies columns backing chamber and date semantics actually exist in the schema", () => {
  const billColumns = getTableColumns(bills);
  assert.ok(billColumns.bodyId, "bills.body_id (chamber FK) must exist");
  assert.ok(billColumns.introducedDate, "bills.introduced_date must exist");
  assert.ok(billColumns.lastActionDate, "bills.last_action_date must exist");
  assert.ok(billColumns.rawStatus, "bills.raw_status must exist");
  const bodyColumns = getTableColumns(governmentBodies);
  assert.ok(bodyColumns.name, "government_bodies.name must exist");
  assert.ok(bodyColumns.chamberType, "government_bodies.chamber_type must exist");
});

test(
  "DEFERRED: the Civica Data tab's whole-section visibility gate for Bills " +
    "lives in two Index-change-control-protected files, which is why the " +
    "unsupported-country explanation could not be wired into that tab here",
  () => {
    const protectedPaths = new Set(INDEX_PROTECTED_FILES.map((f) => f.path));
    assert.ok(
      protectedPaths.has(CIVICA_DATA_PAGE),
      "civica-data/page.tsx must still be protected (confirms why it was not edited)",
    );
    assert.ok(
      protectedPaths.has("src/lib/db/queries.ts"),
      "queries.ts (getBillsForJurisdiction) must still be protected",
    );
    const pageSource = read(CIVICA_DATA_PAGE);
    assert.match(
      pageSource,
      /hasBills\s*=\s*!!billsResult\s*&&\s*billsResult\.rows\.length\s*>\s*0/,
      "locks the exact current gate shape: zero rows hides the whole section",
    );
    assert.match(
      pageSource,
      /case "bills":\s*\n\s*return hasBills;/,
      "locks that section visibility (sidebar + content) is driven by that same zero-rows gate",
    );
  },
);
