/**
 * Regenerates the static Civica logo mask (public/brand/civica-logo-mask.svg)
 * from the master artwork (public/civica-logo.svg). Ink paths become white and
 * field paths black inside an SVG luminance mask, painted in source order with
 * their original opacities and exact coordinates (whitespace and trailing
 * zeros are removed; no value is rounded).
 * The resulting file is opaque exactly where the mark shows, and the
 * `.civica-logo` class in globals.css paints it in the `--logo-fg` token.
 *
 * Usage: node scripts/generate-civica-logo-mask.mjs
 */
import fs from "node:fs";

const [src = "public/civica-logo.svg", out = "public/brand/civica-logo-mask.svg"] =
  process.argv.slice(2);
const raw = fs.readFileSync(src, "utf8");
const pathPattern =
  /<path\s+fill="var\(--logo-(fg|bg)[^"]*"\s+opacity="([^"]*)"\s+d="([^"]*)"\s*(?:\/>|><\/path>)/g;

// Lossless number compaction only: trailing zeros and leading "0" are dropped,
// values are never rounded. Rounding even to 0.01 moves the anti-aliased seams
// between the trace's abutting shapes, which shows as stray pixels.
const compactNumber = (token) =>
  token
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "")
    .replace(/^(-?)0+(?=\.|\d)/, "$1")
    .replace(/^-?$/, "0")
    .replace(/^-0$/, "0");

const paths = [];
let match;
while ((match = pathPattern.exec(raw))) {
  const fill = match[1] === "fg" ? "#fff" : "#000";
  const d = match[3]
    .replace(/-?\d*\.?\d+/g, compactNumber)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/ ?([MCLZmclz]) ?/g, "$1")
    .replace(/ -/g, "-");
  const opacity = parseFloat(match[2]);
  paths.push(
    `<path fill="${fill}"${opacity === 1 ? "" : ` opacity="${+opacity.toFixed(4)}"`} d="${d}"/>`,
  );
}

const total = (raw.match(/<path/g) || []).length;
if (paths.length !== total) {
  throw new Error(`Parsed ${paths.length} of ${total} paths; update the pattern.`);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><!-- Civica mark as an alpha mask, derived from public/civica-logo.svg: ink paths white, field paths black, painted in source order; the result is opaque where the mark shows. --><mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">${paths.join("")}</mask><rect width="1024" height="1024" mask="url(#m)"/></svg>\n`;
fs.writeFileSync(out, svg);
console.log(`Wrote ${out}: ${paths.length} paths, ${svg.length} bytes`);
