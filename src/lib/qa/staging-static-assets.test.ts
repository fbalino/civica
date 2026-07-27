import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  buildStagingStaticAssetManifest,
  stagingStaticAssetManifestErrors,
  stagingStaticAssetManifestSha256,
} from "./staging-static-assets";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "civica-staging-assets-"));
  mkdirSync(join(root, "_next", "static"), { recursive: true });
  writeFileSync(join(root, "favicon.ico"), "icon");
  writeFileSync(join(root, "_next", "static", "app.js"), "console.log('ok');\n");
  return root;
}

test("staging asset manifest is deterministic and path sorted", (context) => {
  const root = fixture();
  context.after(() => rmSync(root, { recursive: true }));
  const first = buildStagingStaticAssetManifest(root);
  const second = buildStagingStaticAssetManifest(root);
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.files.map((file) => file.path),
    ["_next/static/app.js", "favicon.ico"],
  );
  assert.match(stagingStaticAssetManifestSha256(first), /^[a-f0-9]{64}$/);
});

test("staging asset manifest detects changed and added build output", (context) => {
  const root = fixture();
  context.after(() => rmSync(root, { recursive: true }));
  const manifest = buildStagingStaticAssetManifest(root);
  writeFileSync(join(root, "favicon.ico"), "changed");
  assert.deepEqual(stagingStaticAssetManifestErrors(root, manifest), [
    "static build output differs from the checked manifest",
  ]);
  writeFileSync(join(root, "new.txt"), "new");
  assert.deepEqual(stagingStaticAssetManifestErrors(root, manifest), [
    "static build output differs from the checked manifest",
  ]);
});
