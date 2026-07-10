/**
 * generate-ci-normalization-table — regenerate the `normalization-table`
 * GEN marker block in `content/methodology-civica-index.md` from the
 * production fixed-bound descriptors in `src/lib/ci/normalize-v2.ts`
 * (via the pure `src/lib/ci/normalization-table.ts` derivation layer).
 *
 *   Run with:  npm run generate:ci-normalization-table
 *              npm run generate:ci-normalization-table -- --check
 *   Adopted via: CLM-009 (documentation-source registry)
 *
 * Deterministic and DB-free: the output depends only on
 * `normalizationDescriptors()` and the static display metadata in
 * `normalization-table.ts`, never on the clock, the database, or the
 * network. `--check` byte-compares the regenerated block against what
 * is currently checked in and exits 1 on drift, without writing.
 *
 * Marker syntax is the Markdown-native invisible-comment convention
 * from `src/lib/docs/gen-markers.ts` (an unused link reference
 * definition, `[//]: # "..."`) — NOT an HTML comment. `react-markdown`
 * without `rehype-raw` renders a raw `<!-- -->` comment as escaped
 * VISIBLE text (this is exactly what CLM-009 browser QA caught); the
 * link-reference-definition form is consumed during Markdown parsing
 * and never reaches the page. See `gen-markers.ts` for the verified
 * rendering proof and the mandatory blank-line framing rule.
 */

import { promises as fs } from "node:fs";
import path from "node:path";

import { renderNormalizationTableMarkdown } from "../src/lib/ci/normalization-table";
import { extractGenBlock, replaceGenBlock } from "../src/lib/docs/gen-markers";

const TARGET = path.resolve(
  process.cwd(),
  "content/methodology-civica-index.md",
);
const MARKER_NAME = "normalization-table";
const EXPECTED_START = `[//]: # "GEN:START ${MARKER_NAME} (source: scripts/generate-ci-normalization-table.ts)"`;
const EXPECTED_END = `[//]: # "GEN:END ${MARKER_NAME}"`;

interface CliArgs {
  check: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { check: false };
  for (const arg of argv) {
    if (arg === "--check") args.check = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "generate-ci-normalization-table — regenerate the CI normalization-table GEN block",
          "",
          "Usage:",
          "  npm run generate:ci-normalization-table",
          "  npm run generate:ci-normalization-table -- --check",
          "",
          "Flags:",
          "  --check   verify the checked-in block matches; exit 1 on drift without writing",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${arg}`);
      process.exit(2);
    }
  }
  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const raw = await fs.readFile(TARGET, "utf8");
  const block = extractGenBlock(raw, MARKER_NAME);
  if (!block) {
    console.error(
      `generate-ci-normalization-table: GEN markers not found in ${TARGET}\n` +
        `Expected a marker pair (each on its own line, framed by blank lines):\n  ${EXPECTED_START}\n  ${EXPECTED_END}`,
    );
    process.exit(1);
  }

  const generatedBody = renderNormalizationTableMarkdown();
  const next = replaceGenBlock(raw, MARKER_NAME, generatedBody);
  if (next === null) {
    // Unreachable — extractGenBlock already confirmed the markers
    // exist — but keep the check for type-safety and defense in depth.
    console.error(
      `generate-ci-normalization-table: GEN markers disappeared mid-run in ${TARGET}`,
    );
    process.exit(1);
  }

  if (args.check) {
    if (next !== raw) {
      console.error(
        "generate-ci-normalization-table --check: drift detected between " +
          `${TARGET} and the production fixed-bound descriptors.\n` +
          "Run `npm run generate:ci-normalization-table` to regenerate.",
      );
      process.exit(1);
    }
    console.log(
      "generate-ci-normalization-table --check: OK, no drift.",
    );
    return;
  }

  if (next === raw) {
    console.log(
      "generate-ci-normalization-table: already up to date, no changes written.",
    );
    return;
  }

  await fs.writeFile(TARGET, next, "utf8");
  console.log(`generate-ci-normalization-table: wrote ${TARGET}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
