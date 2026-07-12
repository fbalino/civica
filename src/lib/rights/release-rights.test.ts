import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { SOURCE_RIGHTS } from "./manifest";

/**
 * BRD-008 — data rights are published release-specific (per source/field), not
 * as one blanket dataset license.
 */

test("every source carries release-specific reuse terms and attribution", () => {
  assert.ok(SOURCE_RIGHTS.length > 0);
  for (const r of SOURCE_RIGHTS) {
    assert.ok(r.sourceId, "source missing id");
    // Each source has an explicit export decision, attribution flag, and a
    // (possibly empty) restrictions list — not a single blanket grant.
    assert.ok(
      ["allowed", "non-commercial-only", "blocked", "pending-review"].includes(
        r.publicExport,
      ),
      `${r.sourceId}: bad publicExport`,
    );
    assert.ok(
      r.attributionRequired === true ||
        r.attributionRequired === false ||
        r.attributionRequired === null,
      `${r.sourceId}: attributionRequired must be explicit`,
    );
    assert.ok(Array.isArray(r.restrictions), `${r.sourceId}: restrictions list`);
  }
});

test("the atlas export embeds per-source rights and names exclusions", () => {
  const src = readFileSync("src/lib/exports/atlas-release.ts", "utf8");
  assert.match(src, /SOURCE_RIGHTS/);
  assert.match(src, /attributionRequired/);
  // Restricted/experimental inputs are explicitly named as excluded.
  assert.match(src, /excluded/i);
  assert.match(src, /restricted source/i);
});

test("dataset metadata binds to the rights registry, not a blanket license", () => {
  const contract = readFileSync("src/lib/seo/metadata-contract.ts", "utf8");
  // license must equal the canonical rights registry URL, and access must be
  // disclosed as not a reuse license.
  assert.match(contract, /\/licensing#reuse/);
  assert.match(contract, /must equal the canonical rights registry URL/);
  assert.match(contract, /not a reuse license/i);
});
