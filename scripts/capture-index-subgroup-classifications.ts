import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const url = "https://api.worldbank.org/v2/country?format=json&per_page=400";

async function main() {
  const directory = "data/releases/index-subgroup-classifications-2026-07-11-v1";
  const target = `${directory}/classifications.v1.json`;
  if (existsSync(target)) throw new Error(`${target} is immutable; create a new release id`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`World Bank country metadata returned ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const parsed = JSON.parse(bytes.toString("utf8"));
  const countries = parsed[1]
    .filter((row: { id?: string; region?: { id?: string }; incomeLevel?: { id?: string } }) =>
      /^[A-Z]{3}$/.test(row.id ?? "") && row.region?.id !== "NA",
    )
    .map((row: { id: string; name: string; region: { id: string; value: string }; incomeLevel: { id: string; value: string } }) => ({
      iso3: row.id,
      name: row.name,
      regionId: row.region.id,
      region: row.region.value,
      incomeId: row.incomeLevel.id,
      income: row.incomeLevel.value,
    }))
    .sort((a: { iso3: string }, b: { iso3: string }) => a.iso3.localeCompare(b.iso3));
  const payload = {
    schemaVersion: "civica-index-subgroup-classifications/v1",
    releaseId: "index-subgroup-classifications-2026-07-11-v1",
    sourceUrl: url,
    retrievedAt: "2026-07-11T00:00:00.000Z",
    rawSha256: createHash("sha256").update(bytes).digest("hex"),
    countries,
  };
  mkdirSync(directory, { recursive: true });
  writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`Wrote ${countries.length} World Bank classifications; raw ${payload.rawSha256}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
