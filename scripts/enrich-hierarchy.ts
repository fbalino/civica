import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import {
  jurisdictions,
  governmentBodies,
  offices,
  persons,
  terms,
} from "../src/lib/db/schema";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: neonSql });

interface OfficeDef {
  name: string;
  officeType: string;
  branch: string;
  reportsToType?: string; // office_type of parent (e.g., "head_of_state")
  bodyName?: string;
  bodyType?: string;
  holder?: {
    name: string;
    wikidataQid: string;
    partyName?: string;
    partyColor?: string;
    startDate?: string;
  };
}

const COUNTRY_OFFICES: Record<string, OfficeDef[]> = {
  "united-states": [
    {
      name: "Vice President",
      officeType: "deputy_head",
      branch: "executive",
      reportsToType: "head_of_state",
      holder: { name: "JD Vance", wikidataQid: "Q22250985", partyName: "Republican", partyColor: "#E91D0E", startDate: "2025-01-20" },
    },
    {
      name: "Secretary of State",
      officeType: "cabinet",
      branch: "executive",
      reportsToType: "head_of_state",
      holder: { name: "Marco Rubio", wikidataQid: "Q324546", partyName: "Republican", partyColor: "#E91D0E", startDate: "2025-01-20" },
    },
    {
      name: "Secretary of the Treasury",
      officeType: "cabinet",
      branch: "executive",
      reportsToType: "head_of_state",
      holder: { name: "Scott Bessent", wikidataQid: "Q130258582", partyName: "Republican", partyColor: "#E91D0E", startDate: "2025-01-27" },
    },
    {
      name: "Secretary of Defense",
      officeType: "cabinet",
      branch: "executive",
      reportsToType: "head_of_state",
      holder: { name: "Pete Hegseth", wikidataQid: "Q7171827", partyName: "Republican", partyColor: "#E91D0E", startDate: "2025-01-25" },
    },
    {
      name: "Attorney General",
      officeType: "cabinet",
      branch: "executive",
      reportsToType: "head_of_state",
      holder: { name: "Pam Bondi", wikidataQid: "Q7128576", partyName: "Republican", partyColor: "#E91D0E", startDate: "2025-02-05" },
    },
    {
      name: "Speaker of the House",
      officeType: "legislative_leader",
      branch: "legislative",
      holder: { name: "Mike Johnson", wikidataQid: "Q16733373", partyName: "Republican", partyColor: "#E91D0E", startDate: "2023-10-25" },
    },
    {
      name: "Senate Majority Leader",
      officeType: "legislative_leader",
      branch: "legislative",
      holder: { name: "John Thune", wikidataQid: "Q432463", partyName: "Republican", partyColor: "#E91D0E", startDate: "2025-01-03" },
    },
    {
      name: "President pro tempore",
      officeType: "legislative_leader",
      branch: "legislative",
      holder: { name: "Chuck Grassley", wikidataQid: "Q381880", partyName: "Republican", partyColor: "#E91D0E", startDate: "2025-01-03" },
    },
    {
      name: "Chief Justice",
      officeType: "judicial_leader",
      branch: "judicial",
      bodyName: "Supreme Court",
      bodyType: "judiciary",
      holder: { name: "John Roberts", wikidataQid: "Q185002", startDate: "2005-09-29" },
    },
  ],
  "united-kingdom": [
    {
      name: "Chancellor of the Exchequer",
      officeType: "cabinet",
      branch: "executive",
      reportsToType: "head_of_government",
      holder: { name: "Rachel Reeves", wikidataQid: "Q5045258", partyName: "Labour", partyColor: "#E4003B", startDate: "2024-07-05" },
    },
    {
      name: "Foreign Secretary",
      officeType: "cabinet",
      branch: "executive",
      reportsToType: "head_of_government",
      holder: { name: "David Lammy", wikidataQid: "Q333136", partyName: "Labour", partyColor: "#E4003B", startDate: "2024-07-05" },
    },
    {
      name: "Home Secretary",
      officeType: "cabinet",
      branch: "executive",
      reportsToType: "head_of_government",
      holder: { name: "Yvette Cooper", wikidataQid: "Q264199", partyName: "Labour", partyColor: "#E4003B", startDate: "2024-07-05" },
    },
    {
      name: "Speaker of the House of Commons",
      officeType: "legislative_leader",
      branch: "legislative",
      holder: { name: "Lindsay Hoyle", wikidataQid: "Q333122", startDate: "2019-11-04" },
    },
    {
      name: "President of the Supreme Court",
      officeType: "judicial_leader",
      branch: "judicial",
      bodyName: "Supreme Court of the United Kingdom",
      bodyType: "judiciary",
      holder: { name: "Robert Reed", wikidataQid: "Q7345854", startDate: "2020-01-13" },
    },
  ],
};

async function upsertPerson(name: string, qid: string): Promise<string> {
  const existing = await db
    .select({ id: persons.id })
    .from(persons)
    .where(eq(persons.wikidataQid, qid))
    .limit(1);
  if (existing.length > 0) return existing[0].id;

  const inserted = await db
    .insert(persons)
    .values({ name, wikidataQid: qid })
    .returning({ id: persons.id });
  return inserted[0].id;
}

async function enrichCountry(slug: string) {
  const officeDefs = COUNTRY_OFFICES[slug];
  if (!officeDefs) {
    console.log(`No data for ${slug}`);
    return;
  }

  const [jurisdiction] = await db
    .select()
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, slug))
    .limit(1);
  if (!jurisdiction) {
    console.log(`Jurisdiction not found: ${slug}`);
    return;
  }

  console.log(`\n--- ${jurisdiction.name} (${slug}) ---`);

  const bodies = await db
    .select()
    .from(governmentBodies)
    .where(eq(governmentBodies.jurisdictionId, jurisdiction.id));

  const allOffices = await db
    .select()
    .from(offices)
    .where(
      bodies.length > 0
        ? sql`${offices.bodyId} IN ${bodies.map((b) => b.id)}`
        : sql`false`
    );

  for (const def of officeDefs) {
    const existing = allOffices.find(
      (o) => o.name === def.name && o.officeType === def.officeType
    );
    if (existing) {
      // Office exists — check if it needs a holder
      if (def.holder) {
        const existingTerms = await db
          .select({ id: terms.id })
          .from(terms)
          .where(sql`${terms.officeId} = ${existing.id} AND ${terms.isCurrent} = true`)
          .limit(1);
        if (existingTerms.length === 0) {
          const personId = await upsertPerson(def.holder.name, def.holder.wikidataQid);
          await db.insert(terms).values({
            officeId: existing.id,
            personId,
            startDate: def.holder.startDate ?? null,
            partyName: def.holder.partyName ?? null,
            partyColor: def.holder.partyColor ?? null,
            isCurrent: true,
          });
          console.log(`  ✓ ${def.name} → ${def.holder.name} (holder added to existing office)`);
        } else {
          console.log(`  ○ ${def.name}: already exists with holder`);
        }
      } else {
        console.log(`  ○ ${def.name}: already exists`);
      }
      continue;
    }

    // Find or create body for this branch
    let body = bodies.find((b) => b.branch === def.branch);
    if (!body) {
      const [created] = await db
        .insert(governmentBodies)
        .values({
          jurisdictionId: jurisdiction.id,
          name: def.bodyName ?? `${def.branch} branch`,
          bodyType: def.bodyType ?? def.branch,
          branch: def.branch,
          hierarchyLevel: 0,
        })
        .returning();
      body = created;
      bodies.push(created);
      console.log(`  + Created body: ${created.name}`);
    }

    // Find target body for legislative leaders
    let targetBodyId = body.id;
    if (def.branch === "legislative") {
      const legBodies = bodies.filter((b) => b.branch === "legislative");
      const label = def.name.toLowerCase();
      if (label.includes("speaker") || label.includes("house")) {
        const house = legBodies.find((b) => b.chamberType === "lower" || b.name.toLowerCase().includes("house"));
        if (house) targetBodyId = house.id;
      } else if (label.includes("senate") || label.includes("pro tempore") || label.includes("majority leader")) {
        const senate = legBodies.find((b) => b.chamberType === "upper" || b.name.toLowerCase().includes("senate"));
        if (senate) targetBodyId = senate.id;
      }
    }

    // Resolve reportsTo
    let reportsToId: string | null = null;
    if (def.reportsToType) {
      const parent = allOffices.find((o) => o.officeType === def.reportsToType);
      if (parent) reportsToId = parent.id;
    }

    // Create office
    const [office] = await db
      .insert(offices)
      .values({
        bodyId: targetBodyId,
        name: def.name,
        officeType: def.officeType,
        isElected: true,
        reportsToOfficeId: reportsToId,
      })
      .returning();
    allOffices.push(office);

    // Create holder
    if (def.holder) {
      const personId = await upsertPerson(def.holder.name, def.holder.wikidataQid);

      await db
        .update(terms)
        .set({ isCurrent: false })
        .where(sql`${terms.officeId} = ${office.id} AND ${terms.isCurrent} = true`);

      await db.insert(terms).values({
        officeId: office.id,
        personId,
        startDate: def.holder.startDate ?? null,
        partyName: def.holder.partyName ?? null,
        partyColor: def.holder.partyColor ?? null,
        isCurrent: true,
      });

      console.log(`  ✓ ${def.name} → ${def.holder.name}${def.holder.partyName ? ` (${def.holder.partyName})` : ""}`);
    } else {
      console.log(`  + ${def.name} (vacant)`);
    }
  }
}

async function main() {
  console.log("=== Government Hierarchy Enrichment ===\n");

  const targetSlug = process.argv[2];
  const slugs = targetSlug ? [targetSlug] : Object.keys(COUNTRY_OFFICES);

  for (const slug of slugs) {
    await enrichCountry(slug);
  }

  console.log("\n=== Enrichment Complete ===");
}

main().catch((err) => {
  console.error("Enrichment failed:", err);
  process.exit(1);
});
