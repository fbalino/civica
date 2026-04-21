import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
import {
  organizations,
  organizationMemberships,
  jurisdictions,
} from "../src/lib/db/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

type OrgType = "security" | "regional" | "trade" | "un" | "cultural";

interface OrgSeed {
  slug: string;
  name: string;
  fullName: string;
  type: OrgType;
  foundedYear: number | null;
  hqCountry: string | null;
  wikidataQid: string | null;
  extra?: Record<string, unknown> | null;
  /** Explicit member list by jurisdiction slug. Use "__un_all__" to seed all jurisdictions. */
  members: Array<{ slug: string; joinYear?: number; role?: string }> | "__un_all__";
}

const ORGS: OrgSeed[] = [
  // --- Security ---
  {
    slug: "nato",
    name: "NATO",
    fullName: "North Atlantic Treaty Organization",
    type: "security",
    foundedYear: 1949,
    hqCountry: "belgium",
    wikidataQid: "Q7184",
    extra: { gdpTargetPercent: 2.0 },
    members: [
      { slug: "united-states", joinYear: 1949, role: "founding" },
      { slug: "united-kingdom", joinYear: 1949, role: "founding" },
      { slug: "france", joinYear: 1949, role: "founding" },
      { slug: "italy", joinYear: 1949, role: "founding" },
      { slug: "canada", joinYear: 1949, role: "founding" },
      { slug: "netherlands", joinYear: 1949, role: "founding" },
      { slug: "belgium", joinYear: 1949, role: "founding" },
      { slug: "luxembourg", joinYear: 1949, role: "founding" },
      { slug: "portugal", joinYear: 1949, role: "founding" },
      { slug: "norway", joinYear: 1949, role: "founding" },
      { slug: "denmark", joinYear: 1949, role: "founding" },
      { slug: "iceland", joinYear: 1949, role: "founding" },
      { slug: "greece", joinYear: 1952 },
      { slug: "turkey", joinYear: 1952 },
      { slug: "germany", joinYear: 1955 },
      { slug: "spain", joinYear: 1982 },
      { slug: "czechia", joinYear: 1999 },
      { slug: "hungary", joinYear: 1999 },
      { slug: "poland", joinYear: 1999 },
      { slug: "bulgaria", joinYear: 2004 },
      { slug: "estonia", joinYear: 2004 },
      { slug: "latvia", joinYear: 2004 },
      { slug: "lithuania", joinYear: 2004 },
      { slug: "romania", joinYear: 2004 },
      { slug: "slovakia", joinYear: 2004 },
      { slug: "slovenia", joinYear: 2004 },
      { slug: "albania", joinYear: 2009 },
      { slug: "croatia", joinYear: 2009 },
      { slug: "montenegro", joinYear: 2017 },
      { slug: "north-macedonia", joinYear: 2020 },
      { slug: "finland", joinYear: 2023 },
      { slug: "sweden", joinYear: 2024 },
    ],
  },

  // --- Regional blocs ---
  {
    slug: "european-union",
    name: "EU",
    fullName: "European Union",
    type: "regional",
    foundedYear: 1993,
    hqCountry: "belgium",
    wikidataQid: "Q458",
    members: [
      { slug: "france", joinYear: 1958, role: "founding" },
      { slug: "germany", joinYear: 1958, role: "founding" },
      { slug: "italy", joinYear: 1958, role: "founding" },
      { slug: "netherlands", joinYear: 1958, role: "founding" },
      { slug: "belgium", joinYear: 1958, role: "founding" },
      { slug: "luxembourg", joinYear: 1958, role: "founding" },
      { slug: "ireland", joinYear: 1973 },
      { slug: "denmark", joinYear: 1973 },
      { slug: "greece", joinYear: 1981 },
      { slug: "spain", joinYear: 1986 },
      { slug: "portugal", joinYear: 1986 },
      { slug: "austria", joinYear: 1995 },
      { slug: "finland", joinYear: 1995 },
      { slug: "sweden", joinYear: 1995 },
      { slug: "czechia", joinYear: 2004 },
      { slug: "estonia", joinYear: 2004 },
      { slug: "hungary", joinYear: 2004 },
      { slug: "latvia", joinYear: 2004 },
      { slug: "lithuania", joinYear: 2004 },
      { slug: "poland", joinYear: 2004 },
      { slug: "slovakia", joinYear: 2004 },
      { slug: "slovenia", joinYear: 2004 },
      { slug: "bulgaria", joinYear: 2007 },
      { slug: "romania", joinYear: 2007 },
      { slug: "croatia", joinYear: 2013 },
      // Cyprus and Malta not in current dataset — ok to skip
    ],
  },
  {
    slug: "eurozone",
    name: "Eurozone",
    fullName: "Eurozone (Euro area)",
    type: "regional",
    foundedYear: 1999,
    hqCountry: "germany",
    wikidataQid: "Q8892",
    members: [
      { slug: "france", joinYear: 1999 },
      { slug: "germany", joinYear: 1999 },
      { slug: "italy", joinYear: 1999 },
      { slug: "netherlands", joinYear: 1999 },
      { slug: "belgium", joinYear: 1999 },
      { slug: "luxembourg", joinYear: 1999 },
      { slug: "ireland", joinYear: 1999 },
      { slug: "spain", joinYear: 1999 },
      { slug: "portugal", joinYear: 1999 },
      { slug: "austria", joinYear: 1999 },
      { slug: "finland", joinYear: 1999 },
      { slug: "greece", joinYear: 2001 },
      { slug: "slovenia", joinYear: 2007 },
      { slug: "slovakia", joinYear: 2009 },
      { slug: "estonia", joinYear: 2011 },
      { slug: "latvia", joinYear: 2014 },
      { slug: "lithuania", joinYear: 2015 },
      { slug: "croatia", joinYear: 2023 },
    ],
  },
  {
    slug: "council-of-europe",
    name: "Council of Europe",
    fullName: "Council of Europe",
    type: "regional",
    foundedYear: 1949,
    hqCountry: "france",
    wikidataQid: "Q8908",
    members: [
      { slug: "france", joinYear: 1949, role: "founding" },
      { slug: "united-kingdom", joinYear: 1949, role: "founding" },
      { slug: "italy", joinYear: 1949, role: "founding" },
      { slug: "belgium", joinYear: 1949, role: "founding" },
      { slug: "netherlands", joinYear: 1949, role: "founding" },
      { slug: "luxembourg", joinYear: 1949, role: "founding" },
      { slug: "ireland", joinYear: 1949, role: "founding" },
      { slug: "denmark", joinYear: 1949, role: "founding" },
      { slug: "norway", joinYear: 1949, role: "founding" },
      { slug: "sweden", joinYear: 1949, role: "founding" },
      { slug: "greece", joinYear: 1949 },
      { slug: "turkey", joinYear: 1950 },
      { slug: "iceland", joinYear: 1950 },
      { slug: "germany", joinYear: 1950 },
      { slug: "austria", joinYear: 1956 },
      { slug: "spain", joinYear: 1977 },
      { slug: "portugal", joinYear: 1976 },
      { slug: "finland", joinYear: 1989 },
      { slug: "hungary", joinYear: 1990 },
      { slug: "poland", joinYear: 1991 },
      { slug: "bulgaria", joinYear: 1992 },
      { slug: "estonia", joinYear: 1993 },
      { slug: "lithuania", joinYear: 1993 },
      { slug: "romania", joinYear: 1993 },
      { slug: "slovakia", joinYear: 1993 },
      { slug: "slovenia", joinYear: 1993 },
      { slug: "czechia", joinYear: 1993 },
      { slug: "latvia", joinYear: 1995 },
      { slug: "albania", joinYear: 1995 },
      { slug: "north-macedonia", joinYear: 1995 },
      { slug: "ukraine", joinYear: 1995 },
      { slug: "moldova", joinYear: 1995 },
      { slug: "croatia", joinYear: 1996 },
      { slug: "georgia", joinYear: 1999 },
      { slug: "armenia", joinYear: 2001 },
      { slug: "montenegro", joinYear: 2007 },
      // Russia expelled 2022; skip.
    ],
  },
  {
    slug: "asean",
    name: "ASEAN",
    fullName: "Association of Southeast Asian Nations",
    type: "regional",
    foundedYear: 1967,
    hqCountry: "indonesia",
    wikidataQid: "Q7352",
    members: [
      { slug: "indonesia", joinYear: 1967, role: "founding" },
      { slug: "malaysia", joinYear: 1967, role: "founding" },
      { slug: "philippines", joinYear: 1967, role: "founding" },
      { slug: "singapore", joinYear: 1967, role: "founding" },
      { slug: "thailand", joinYear: 1967, role: "founding" },
      { slug: "burma", joinYear: 1997 }, // Myanmar
      { slug: "vietnam", joinYear: 1995 },
      { slug: "laos", joinYear: 1997 },
      { slug: "cambodia", joinYear: 1999 },
      // Brunei not in dataset
    ],
  },
  {
    slug: "african-union",
    name: "AU",
    fullName: "African Union",
    type: "regional",
    foundedYear: 2002,
    hqCountry: "ethiopia",
    wikidataQid: "Q7159",
    members: [
      { slug: "nigeria", joinYear: 2002 },
      { slug: "south-africa", joinYear: 2002 },
      { slug: "egypt", joinYear: 2002 },
      { slug: "ethiopia", joinYear: 2002, role: "founding" },
      { slug: "kenya", joinYear: 2002 },
      { slug: "ghana", joinYear: 2002 },
      { slug: "senegal", joinYear: 2002 },
      { slug: "c-te-d-ivoire", joinYear: 2002 },
      { slug: "algeria", joinYear: 2002 },
      { slug: "morocco", joinYear: 2017 },
      { slug: "tunisia", joinYear: 2002 },
    ],
  },
  {
    slug: "ecowas",
    name: "ECOWAS",
    fullName: "Economic Community of West African States",
    type: "regional",
    foundedYear: 1975,
    hqCountry: "nigeria",
    wikidataQid: "Q192830",
    members: [
      { slug: "nigeria", joinYear: 1975, role: "founding" },
      { slug: "ghana", joinYear: 1975, role: "founding" },
      { slug: "senegal", joinYear: 1975, role: "founding" },
      { slug: "c-te-d-ivoire", joinYear: 1975, role: "founding" },
    ],
  },
  {
    slug: "gcc",
    name: "GCC",
    fullName: "Gulf Cooperation Council",
    type: "regional",
    foundedYear: 1981,
    hqCountry: "saudi-arabia",
    wikidataQid: "Q208047",
    members: [
      { slug: "saudi-arabia", joinYear: 1981, role: "founding" },
      { slug: "kuwait", joinYear: 1981, role: "founding" },
      { slug: "bahrain", joinYear: 1981, role: "founding" },
      { slug: "qatar", joinYear: 1981, role: "founding" },
      { slug: "oman", joinYear: 1981, role: "founding" },
      { slug: "united-arab-emirates", joinYear: 1981, role: "founding" },
    ],
  },

  // --- Trade & Finance ---
  {
    slug: "g7",
    name: "G7",
    fullName: "Group of Seven",
    type: "trade",
    foundedYear: 1975,
    hqCountry: null,
    wikidataQid: "Q160016",
    members: [
      { slug: "united-states", joinYear: 1975, role: "founding" },
      { slug: "united-kingdom", joinYear: 1975, role: "founding" },
      { slug: "france", joinYear: 1975, role: "founding" },
      { slug: "germany", joinYear: 1975, role: "founding" },
      { slug: "italy", joinYear: 1975, role: "founding" },
      { slug: "japan", joinYear: 1975, role: "founding" },
      { slug: "canada", joinYear: 1976 },
    ],
  },
  {
    slug: "g20",
    name: "G20",
    fullName: "Group of Twenty",
    type: "trade",
    foundedYear: 1999,
    hqCountry: null,
    wikidataQid: "Q171240",
    members: [
      { slug: "united-states", joinYear: 1999 },
      { slug: "united-kingdom", joinYear: 1999 },
      { slug: "france", joinYear: 1999 },
      { slug: "germany", joinYear: 1999 },
      { slug: "italy", joinYear: 1999 },
      { slug: "japan", joinYear: 1999 },
      { slug: "canada", joinYear: 1999 },
      { slug: "china", joinYear: 1999 },
      { slug: "india", joinYear: 1999 },
      { slug: "brazil", joinYear: 1999 },
      { slug: "russia", joinYear: 1999 },
      { slug: "mexico", joinYear: 1999 },
      { slug: "australia", joinYear: 1999 },
      { slug: "argentina", joinYear: 1999 },
      { slug: "indonesia", joinYear: 1999 },
      { slug: "saudi-arabia", joinYear: 1999 },
      { slug: "south-africa", joinYear: 1999 },
      { slug: "south-korea", joinYear: 1999 },
      { slug: "turkey", joinYear: 1999 },
    ],
  },
  {
    slug: "oecd",
    name: "OECD",
    fullName: "Organisation for Economic Co-operation and Development",
    type: "trade",
    foundedYear: 1961,
    hqCountry: "france",
    wikidataQid: "Q7809",
    members: [
      { slug: "united-states", joinYear: 1961, role: "founding" },
      { slug: "united-kingdom", joinYear: 1961, role: "founding" },
      { slug: "france", joinYear: 1961, role: "founding" },
      { slug: "germany", joinYear: 1961, role: "founding" },
      { slug: "italy", joinYear: 1961, role: "founding" },
      { slug: "canada", joinYear: 1961, role: "founding" },
      { slug: "netherlands", joinYear: 1961, role: "founding" },
      { slug: "belgium", joinYear: 1961, role: "founding" },
      { slug: "luxembourg", joinYear: 1961, role: "founding" },
      { slug: "portugal", joinYear: 1961, role: "founding" },
      { slug: "norway", joinYear: 1961, role: "founding" },
      { slug: "denmark", joinYear: 1961, role: "founding" },
      { slug: "iceland", joinYear: 1961, role: "founding" },
      { slug: "greece", joinYear: 1961, role: "founding" },
      { slug: "turkey", joinYear: 1961, role: "founding" },
      { slug: "spain", joinYear: 1961, role: "founding" },
      { slug: "ireland", joinYear: 1961, role: "founding" },
      { slug: "austria", joinYear: 1961, role: "founding" },
      { slug: "sweden", joinYear: 1961, role: "founding" },
      { slug: "japan", joinYear: 1964 },
      { slug: "finland", joinYear: 1969 },
      { slug: "australia", joinYear: 1971 },
      { slug: "new-zealand", joinYear: 1973 },
      { slug: "mexico", joinYear: 1994 },
      { slug: "czechia", joinYear: 1995 },
      { slug: "hungary", joinYear: 1996 },
      { slug: "poland", joinYear: 1996 },
      { slug: "south-korea", joinYear: 1996 },
      { slug: "slovakia", joinYear: 2000 },
      { slug: "chile", joinYear: 2010 },
      { slug: "slovenia", joinYear: 2010 },
      { slug: "estonia", joinYear: 2010 },
      { slug: "israel", joinYear: 2010 },
      { slug: "latvia", joinYear: 2016 },
      { slug: "lithuania", joinYear: 2018 },
      { slug: "colombia", joinYear: 2020 },
      { slug: "costa-rica", joinYear: 2021 },
    ],
  },
  {
    slug: "wto",
    name: "WTO",
    fullName: "World Trade Organization",
    type: "trade",
    foundedYear: 1995,
    hqCountry: "switzerland",
    wikidataQid: "Q7825",
    // Broad — use __un_all__ proxy but keep a select member list for this seed.
    members: "__un_all__",
  },
  {
    slug: "imf",
    name: "IMF",
    fullName: "International Monetary Fund",
    type: "trade",
    foundedYear: 1945,
    hqCountry: "united-states",
    wikidataQid: "Q7804",
    members: "__un_all__",
  },

  // --- UN system ---
  {
    slug: "united-nations",
    name: "UN",
    fullName: "United Nations",
    type: "un",
    foundedYear: 1945,
    hqCountry: "united-states",
    wikidataQid: "Q1065",
    members: "__un_all__",
  },
  {
    slug: "un-security-council",
    name: "UNSC",
    fullName: "UN Security Council",
    type: "un",
    foundedYear: 1945,
    hqCountry: "united-states",
    wikidataQid: "Q37470",
    members: [
      { slug: "united-states", joinYear: 1945, role: "permanent" },
      { slug: "united-kingdom", joinYear: 1945, role: "permanent" },
      { slug: "france", joinYear: 1945, role: "permanent" },
      { slug: "russia", joinYear: 1945, role: "permanent" },
      { slug: "china", joinYear: 1945, role: "permanent" },
    ],
  },
  {
    slug: "who",
    name: "WHO",
    fullName: "World Health Organization",
    type: "un",
    foundedYear: 1948,
    hqCountry: "switzerland",
    wikidataQid: "Q7817",
    members: "__un_all__",
  },
  {
    slug: "unesco",
    name: "UNESCO",
    fullName: "UN Educational, Scientific and Cultural Organization",
    type: "un",
    foundedYear: 1946,
    hqCountry: "france",
    wikidataQid: "Q7809",
    members: "__un_all__",
  },
  {
    slug: "iaea",
    name: "IAEA",
    fullName: "International Atomic Energy Agency",
    type: "un",
    foundedYear: 1957,
    hqCountry: "austria",
    wikidataQid: "Q81396",
    members: "__un_all__",
  },

  // --- Cultural & Language ---
  {
    slug: "la-francophonie",
    name: "OIF",
    fullName: "Organisation internationale de la Francophonie",
    type: "cultural",
    foundedYear: 1970,
    hqCountry: "france",
    wikidataQid: "Q194097",
    members: [
      { slug: "france", joinYear: 1970, role: "founding" },
      { slug: "belgium", joinYear: 1970, role: "founding" },
      { slug: "canada", joinYear: 1970, role: "founding" },
      { slug: "senegal", joinYear: 1970, role: "founding" },
      { slug: "c-te-d-ivoire", joinYear: 1970, role: "founding" },
      { slug: "luxembourg", joinYear: 1970, role: "founding" },
      { slug: "tunisia", joinYear: 1970, role: "founding" },
      { slug: "morocco", joinYear: 1981 },
      { slug: "romania", joinYear: 1993 },
      { slug: "moldova", joinYear: 1996 },
      { slug: "greece", joinYear: 2004, role: "observer" },
    ],
  },
];

async function main() {
  console.log("Seeding organizations...");

  // Build slug → jurisdiction id map
  const juris = await db.select().from(jurisdictions);
  const slugToId = new Map(juris.map((j) => [j.slug, j.id]));
  const allSlugs = juris.map((j) => j.slug);

  let orgCount = 0;
  let membershipCount = 0;

  for (const org of ORGS) {
    // Upsert org
    const [row] = await db
      .insert(organizations)
      .values({
        slug: org.slug,
        name: org.name,
        fullName: org.fullName,
        type: org.type,
        foundedYear: org.foundedYear,
        hqCountry: org.hqCountry,
        wikidataQid: org.wikidataQid,
        extra: org.extra ?? null,
        memberCount: null,
      })
      .onConflictDoUpdate({
        target: organizations.slug,
        set: {
          name: org.name,
          fullName: org.fullName,
          type: org.type,
          foundedYear: org.foundedYear,
          hqCountry: org.hqCountry,
          wikidataQid: org.wikidataQid,
          extra: org.extra ?? null,
          updatedAt: new Date(),
        },
      })
      .returning({ id: organizations.id });

    const orgId = row.id;

    // Clear previous memberships for a clean re-seed
    await db
      .delete(organizationMemberships)
      .where(eq(organizationMemberships.orgId, orgId));

    const memberSlugs: Array<{ slug: string; joinYear?: number; role?: string }> =
      org.members === "__un_all__"
        ? allSlugs.map((s) => ({ slug: s, joinYear: org.foundedYear ?? undefined }))
        : org.members;

    const values = memberSlugs
      .map((m) => {
        const jid = slugToId.get(m.slug);
        if (!jid) {
          console.warn(`  ! ${org.slug}: missing jurisdiction ${m.slug}`);
          return null;
        }
        return {
          orgId,
          jurisdictionId: jid,
          joinDate: m.joinYear ? `${m.joinYear}-01-01` : null,
          role: m.role ?? null,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (values.length > 0) {
      await db.insert(organizationMemberships).values(values);
    }

    // Update memberCount on the org row to match
    await db
      .update(organizations)
      .set({ memberCount: values.length })
      .where(eq(organizations.id, orgId));

    orgCount += 1;
    membershipCount += values.length;
    console.log(`  ✓ ${org.slug} (${values.length} members)`);
  }

  console.log(
    `\nDone. Seeded ${orgCount} organizations, ${membershipCount} memberships.`
  );
}

main().catch((err) => {
  console.error("Failed to seed organizations:", err);
  process.exit(1);
});
