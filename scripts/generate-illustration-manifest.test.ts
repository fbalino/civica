import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUniqueIllustrationManifestIds,
  illustrationManifestAssetId,
  identity,
  manifestKeyForAsset,
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
