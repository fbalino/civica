import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { AUTHORSHIP_RECORD, authorshipErrors } from "../src/lib/research/authorship";
import { buildAuthorshipArtifact } from "./generate-authorship-record";

assert.deepEqual(authorshipErrors(), []);
assert.deepEqual(
  JSON.parse(readFileSync("data/research/authorship-and-contributions-v1.json", "utf8")),
  buildAuthorshipArtifact(),
);

const citationFiles = [
  "CITATION.cff",
  "data/releases/atlas-2026-07-11/g2-rc1/CITATION.cff",
  "data/releases/governance-evidence-review-packet-2026-07-v2/CITATION.cff",
];
for (const path of citationFiles) {
  const citation = YAML.parse(readFileSync(path, "utf8"));
  const authors = citation.authors ?? [];
  assert.ok(authors.some((author: Record<string, unknown>) => author["given-names"] === "Fernando" && author["family-names"] === "Balino"), `${path}: named human author missing`);
  assert.equal(authors.some((author: Record<string, unknown>) => author.name === "Civica Atlas"), false, `${path}: organization-only author remains`);
  assert.equal(citation.publisher, "Civica Atlas", `${path}: organizational publisher missing`);
}

const pattern = `^author: Civica\\s+${"Team"}$`;
function findFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? findFiles(path) : entry.isFile() ? [path] : [];
  });
}
const bylinePattern = new RegExp(pattern, "m");
const matches = findFiles("content/blog")
  .filter((path) => bylinePattern.test(readFileSync(path, "utf8")))
  .join("\n");
assert.equal(matches, "", `anonymous blog bylines remain: ${matches}`);

assert.equal(AUTHORSHIP_RECORD.responsibleAuthor.orcid, null);
assert.ok(AUTHORSHIP_RECORD.responsibleAuthor.orcidStatus.includes("no_reliable_public_match"));
console.log(`PASS — named authorship is present in ${citationFiles.length} citation surfaces; contributor roles/history close; organization-only and anonymous bylines are absent.`);
