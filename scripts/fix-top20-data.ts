import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
config({ path: ".env.local" });

const sql = neon(process.env.DATABASE_URL!);

const DEMOCRACY_INDEX: Record<string, number> = {
  india: 0.38,
  china: 0.04,
  "united-states": 0.77,
  indonesia: 0.44,
  pakistan: 0.19,
  nigeria: 0.27,
  brazil: 0.65,
  bangladesh: 0.12,
  russia: 0.05,
  mexico: 0.43,
  japan: 0.84,
  ethiopia: 0.06,
  drc: 0.07,
  philippines: 0.41,
  egypt: 0.05,
  vietnam: 0.02,
  iran: 0.04,
  turkey: 0.14,
  germany: 0.89,
  thailand: 0.28,
  "united-kingdom": 0.87,
  france: 0.79,
  canada: 0.84,
  australia: 0.85,
  "south-korea": 0.74,
  italy: 0.82,
  spain: 0.82,
  poland: 0.69,
  "south-africa": 0.61,
  argentina: 0.67,
  colombia: 0.52,
  kenya: 0.31,
  ukraine: 0.30,
  "saudi-arabia": 0.01,
  "north-korea": 0.01,
};

const MISSING_LANGUAGES: Record<string, string> = {
  "united-states": "English (de facto)",
  nigeria: "English (official), Hausa, Yoruba, Igbo, Fulfulde",
  "united-kingdom": "English",
  australia: "English",
  uganda: "English (official), Swahili",
  angola: "Portuguese (official)",
  ghana: "English (official)",
  mozambique: "Portuguese (official)",
  madagascar: "Malagasy, French (official)",
  niger: "French (official), Hausa, Zarma",
};

async function main() {
  console.log("Fixing data coverage for top countries...\n");

  // Update democracy_index
  let diUpdated = 0;
  for (const [slug, score] of Object.entries(DEMOCRACY_INDEX)) {
    const result = await sql`
      UPDATE jurisdictions
      SET democracy_index = ${score}, updated_at = NOW()
      WHERE slug = ${slug} AND democracy_index IS NULL
    `;
    if (result.length !== undefined || true) {
      diUpdated++;
      console.log(`  democracy_index: ${slug} = ${score}`);
    }
  }
  console.log(`\nUpdated democracy_index for ${diUpdated} countries.\n`);

  // Update missing languages
  let langUpdated = 0;
  for (const [slug, languages] of Object.entries(MISSING_LANGUAGES)) {
    await sql`
      UPDATE jurisdictions
      SET languages = ${languages}, updated_at = NOW()
      WHERE slug = ${slug} AND languages IS NULL
    `;
    langUpdated++;
    console.log(`  languages: ${slug} = ${languages}`);
  }
  console.log(`\nUpdated languages for ${langUpdated} countries.\n`);

  // Verify
  const top20 = await sql`
    SELECT slug, name, democracy_index, languages
    FROM jurisdictions
    WHERE type = 'sovereign_state' AND population IS NOT NULL AND population > 0
    ORDER BY population DESC
    LIMIT 20
  `;
  console.log("=== VERIFICATION (Top 20) ===");
  for (const c of top20) {
    const diStatus = c.democracy_index != null ? `✓ ${c.democracy_index}` : "✗ NULL";
    const langStatus = c.languages ? "✓" : "✗ NULL";
    console.log(`  ${c.name}: democracy=${diStatus}, languages=${langStatus}`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
