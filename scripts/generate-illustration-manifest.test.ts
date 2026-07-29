import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueIllustrationManifestIds,
  illustrationManifestAssetId,
  identity,
  manifestKeyForAsset,
  resolveGitIntroduction,
} from "./generate-illustration-manifest";

test("navigation spot assets receive path-qualified manifest IDs", () => {
  const lightPath = "public/engravings/navigation/spot-column.webp";
  const darkPath = "public/engravings/navigation/spot-column-dark.webp";
  const light = identity(lightPath);
  const dark = identity(darkPath);
  const lightManifestKey = manifestKeyForAsset(lightPath, light.key);
  const darkManifestKey = manifestKeyForAsset(darkPath, dark.key);

  assert.equal(light.key, "spot-column");
  assert.equal(dark.key, "spot-column");
  assert.equal(lightManifestKey, "navigation/spot-column");
  assert.equal(darkManifestKey, "navigation/spot-column");
  assert.equal(
    illustrationManifestAssetId(light.category, lightManifestKey, light.theme),
    "shared:navigation/spot-column:light",
  );
  assert.equal(
    illustrationManifestAssetId(dark.category, darkManifestKey, dark.theme),
    "shared:navigation/spot-column:dark",
  );
});

test("only navigation spot assets receive path-qualified manifest keys", () => {
  const rootSpotPath = "public/engravings/spot-column.webp";
  const navigationNonSpotPath =
    "public/engravings/navigation/explore-countries.webp";

  assert.equal(
    manifestKeyForAsset(rootSpotPath, identity(rootSpotPath).key),
    "spot-column",
  );
  assert.equal(
    manifestKeyForAsset(
      navigationNonSpotPath,
      identity(navigationNonSpotPath).key,
    ),
    "explore-countries",
  );
});

test("duplicate manifest IDs fail closed with both source paths", () => {
  assert.throws(
    () =>
      assertUniqueIllustrationManifestIds([
        {
          id: "shared:spot-column:light",
          path: "public/engravings/spot-column.webp",
        },
        {
          id: "shared:spot-column:light",
          path: "public/engravings/navigation/spot-column.webp",
        },
      ]),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /duplicate illustration manifest asset id/);
      assert.match(error.message, /public\/engravings\/spot-column\.webp/);
      assert.match(
        error.message,
        /public\/engravings\/navigation\/spot-column\.webp/,
      );
      return true;
    },
  );
});

test("unique manifest IDs pass the assertion", () => {
  assert.doesNotThrow(() =>
    assertUniqueIllustrationManifestIds([
      {
        id: "shared:spot-column:light",
        path: "public/engravings/spot-column.webp",
      },
      {
        id: "shared:navigation/spot-column:light",
        path: "public/engravings/navigation/spot-column.webp",
      },
    ]),
  );
});

test("full-history repositories retain Git-derived introduction provenance", () => {
  const introduction = {
    commit: "full-history-commit",
    committedAt: "2026-07-01T00:00:00Z",
  };
  assert.deepEqual(
    resolveGitIntroduction({
      relative: "public/engravings/atlas.webp",
      sha256: "current-hash",
      gitIntroduction: introduction,
      shallow: false,
    }),
    introduction,
  );
});

test("shallow repositories reproduce checked provenance after a hash match", () => {
  assert.deepEqual(
    resolveGitIntroduction({
      relative: "public/engravings/atlas.webp",
      sha256: "checked-hash",
      gitIntroduction: {
        commit: "synthetic-shallow-boundary",
        committedAt: "2026-07-29T00:00:00Z",
      },
      shallow: true,
      checkedAsset: {
        path: "public/engravings/atlas.webp",
        file: { sha256: "checked-hash" },
        origin: {
          firstTrackedCommit: "a".repeat(40),
          firstTrackedAt: "2026-07-01T00:00:00Z",
        },
      },
    }),
    {
      commit: "a".repeat(40),
      committedAt: "2026-07-01T00:00:00Z",
    },
  );
});

test("shallow repositories reject changed known assets before reusing provenance", () => {
  assert.throws(
    () =>
      resolveGitIntroduction({
        relative: "public/engravings/atlas.webp",
        sha256: "changed-hash",
        gitIntroduction: {
          commit: "synthetic-shallow-boundary",
          committedAt: "2026-07-29T00:00:00Z",
        },
        shallow: true,
        checkedAsset: {
          path: "public/engravings/atlas.webp",
          file: { sha256: "checked-hash" },
          origin: {
            firstTrackedCommit: "a".repeat(40),
            firstTrackedAt: "2026-07-01T00:00:00Z",
          },
        },
      }),
    /shallow clone cannot verify checked illustration provenance because the asset hash drifted/,
  );
});

test("shallow repositories do not treat boundary additions as recorded provenance", () => {
  assert.equal(
    resolveGitIntroduction({
      relative: "public/engravings/new-unrecorded.webp",
      sha256: "new-hash",
      gitIntroduction: {
        commit: "synthetic-shallow-boundary",
        committedAt: "2026-07-29T00:00:00Z",
      },
      shallow: true,
    }),
    undefined,
  );
});

test("shallow repositories fail on incomplete checked provenance", () => {
  assert.throws(
    () =>
      resolveGitIntroduction({
        relative: "public/engravings/atlas.webp",
        sha256: "checked-hash",
        shallow: true,
        checkedAsset: {
          path: "public/engravings/atlas.webp",
          file: { sha256: "checked-hash" },
          origin: {
            firstTrackedCommit: "a".repeat(40),
            firstTrackedAt: null,
          },
        },
      }),
    /checked illustration manifest has incomplete Git introduction provenance/,
  );
});

test("shallow repositories reject malformed checked provenance", () => {
  for (const [firstTrackedCommit, firstTrackedAt] of [
    ["not-a-commit", "2026-07-01T00:00:00Z"],
    ["a".repeat(40), "not-a-timestamp"],
  ]) {
    assert.throws(
      () =>
        resolveGitIntroduction({
          relative: "public/engravings/atlas.webp",
          sha256: "checked-hash",
          shallow: true,
          checkedAsset: {
            path: "public/engravings/atlas.webp",
            file: { sha256: "checked-hash" },
            origin: { firstTrackedCommit, firstTrackedAt },
          },
        }),
      /checked illustration manifest has incomplete Git introduction provenance/,
    );
  }
});
