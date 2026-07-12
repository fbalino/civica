import assert from "node:assert/strict";
import test from "node:test";
import { validateCountryEngravingInventory, type CountryEngravingAsset } from "./country-engraving-validation";

const light: CountryEngravingAsset = {
  path: "public/engravings/countries/jpn.webp",
  bytes: 120_000,
  width: 1500,
  height: 1000,
  caption: "Mount Fuji",
  manifestId: "country:jpn:light",
  colorContract: "not-applicable-or-not-yet-audited",
};
const dark: CountryEngravingAsset = {
  ...light,
  path: "public/engravings/countries/jpn-dark.webp",
  manifestId: "country:jpn:dark",
  colorContract: "strength-60-batch-pass",
};

function errors(assets: CountryEngravingAsset[], source = "WebP only") {
  return validateCountryEngravingInventory({ assets, captionKeys: ["jpn"], rawFallbackSource: source });
}

test("a complete bounded WebP pair passes", () => {
  assert.deepEqual(errors([light, dark]), []);
});

test("seeded pair, format, size, dimension, caption, manifest, color, duplicate, and fallback defects fail", () => {
  assert.match(errors([light]).join("\n"), /pair missing/);
  assert.match(errors([{ ...light, path: "public/engravings/countries/jpn.png" }, dark]).join("\n"), /WebP/);
  assert.match(errors([{ ...light, bytes: 2_000_000 }, dark]).join("\n"), /outside/);
  assert.match(errors([{ ...light, width: 1200 }, dark]).join("\n"), /unsupported dimensions/);
  assert.match(errors([{ ...light, caption: null }, dark]).join("\n"), /caption missing/);
  assert.match(errors([{ ...light, manifestId: null }, dark]).join("\n"), /manifest row missing/);
  assert.match(errors([light, { ...dark, colorContract: "not-audited" }]).join("\n"), /color-contract/);
  assert.match(errors([light, light, dark]).join("\n"), /duplicate/);
  assert.match(errors([light, dark], "return `/engravings/countries/${code}.png`").join("\n"), /raw PNG/);
});
