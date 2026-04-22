import { config } from "dotenv";
config({ path: ".env.local" });

import { and, eq, sql } from "drizzle-orm";
import { db } from "../src/lib/db";
import { elections, electionResults, jurisdictions } from "../src/lib/db/schema";

type PartyResult = {
  party: string;
  color: string;
  votesCount?: number | null;
  votesPercent: number | null;
  seatsWon?: number | null;
  isWinner: boolean;
};

type BackfillEntry = {
  country: string;
  date: string;
  // Expected type in DB; if DB has a different type, we fix it.
  expectedType: string;
  // If a correction is needed, set to the new election_name as well.
  correctName?: string;
  system?: string;
  turnoutPercent?: number | null;
  registeredVoters?: number | null;
  totalValidVotes?: number | null;
  results: PartyResult[];
};

const BACKFILL: BackfillEntry[] = [
  {
    country: "romania",
    date: "2025-05-18",
    expectedType: "presidential",
    correctName: "2025 Presidential Election (Runoff)",
    system: "Two-round system",
    turnoutPercent: 64.72,
    totalValidVotes: 11641544,
    results: [
      {
        party: "Save Romania Union / Independent",
        color: "#00a4e4",
        votesCount: 6168642,
        votesPercent: 53.6,
        isWinner: true,
      },
      {
        party: "Alliance for the Union of Romanians (AUR)",
        color: "#0d378a",
        votesCount: 5049488,
        votesPercent: 46.4,
        isWinner: false,
      },
    ],
  },
  {
    country: "philippines",
    date: "2025-05-12",
    expectedType: "legislative",
    correctName: "2025 Senate Election",
    system: "Plurality-at-large (12 of 24 seats)",
    turnoutPercent: 82.2,
    results: [
      {
        party: "Alyansa para sa Bagong Pilipinas (Marcos coalition)",
        color: "#ffd700",
        seatsWon: 6,
        votesPercent: null,
        isWinner: true,
      },
      {
        party: "DuterTen / PDP-Laban (Duterte bloc)",
        color: "#c41e3a",
        seatsWon: 4,
        votesPercent: null,
        isWinner: false,
      },
      {
        party: "KiBam / Liberal (Aquino-Pangilinan)",
        color: "#f5cb10",
        seatsWon: 2,
        votesPercent: null,
        isWinner: false,
      },
    ],
  },
  {
    country: "singapore",
    date: "2025-05-03",
    // DB currently has this as "presidential" — this was actually a legislative GE.
    expectedType: "legislative",
    correctName: "2025 General Election",
    system: "Group Representation + single-seat FPTP",
    turnoutPercent: 92.5,
    results: [
      {
        party: "People's Action Party (PAP)",
        color: "#ff3b3b",
        votesPercent: 65.57,
        seatsWon: 87,
        isWinner: true,
      },
      {
        party: "Workers' Party (WP)",
        color: "#e81a3b",
        votesPercent: 11.2,
        // 10 elected + 2 NCMP; schema stores elected seats, note via party label
        seatsWon: 10,
        isWinner: false,
      },
      {
        party: "Other opposition (PSP, SDP, PPP, RDU, SDA, SUP, NSP, independents)",
        color: "#888888",
        votesPercent: 23.23,
        seatsWon: 0,
        isWinner: false,
      },
    ],
  },
];

async function backfillOne(entry: BackfillEntry) {
  const [country] = await db
    .select({ id: jurisdictions.id, name: jurisdictions.name })
    .from(jurisdictions)
    .where(eq(jurisdictions.slug, entry.country))
    .limit(1);
  if (!country) {
    console.log(`  ✗ jurisdiction not found: ${entry.country}`);
    return;
  }

  const electionRow = await db
    .select()
    .from(elections)
    .where(
      and(
        eq(elections.jurisdictionId, country.id),
        eq(elections.electionDate, entry.date)
      )
    )
    .limit(1);
  if (electionRow.length === 0) {
    console.log(`  ✗ no election row for ${country.name} ${entry.date}`);
    return;
  }
  const election = electionRow[0];

  // Fix incorrect type / missing fields
  const needsTypeFix = election.electionType !== entry.expectedType;
  if (needsTypeFix || entry.correctName || entry.system || entry.turnoutPercent != null) {
    await db
      .update(elections)
      .set({
        electionType: entry.expectedType,
        ...(entry.correctName ? { electionName: entry.correctName } : {}),
        ...(entry.system ? { electoralSystem: entry.system } : {}),
        ...(entry.turnoutPercent != null ? { turnoutPercent: String(entry.turnoutPercent) as unknown as never } : {}),
        ...(entry.registeredVoters != null ? { registeredVoters: entry.registeredVoters } : {}),
        ...(entry.totalValidVotes != null ? { totalValidVotes: entry.totalValidVotes } : {}),
      })
      .where(eq(elections.id, election.id));
    if (needsTypeFix) {
      console.log(
        `    fixed election type: ${election.electionType} → ${entry.expectedType}`
      );
    }
  }

  const existing = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(electionResults)
    .where(eq(electionResults.electionId, election.id));
  if ((existing[0]?.count ?? 0) > 0) {
    console.log(`  ↷ ${country.name} ${entry.date} already has results; skipping`);
    return;
  }

  for (const result of entry.results) {
    await db.insert(electionResults).values({
      electionId: election.id,
      partyName: result.party,
      partyColor: result.color,
      votesCount: result.votesCount ?? null,
      votesPercent: result.votesPercent != null ? String(result.votesPercent) as unknown as never : null,
      seatsWon: result.seatsWon ?? null,
      isWinner: result.isWinner,
    });
  }

  console.log(
    `  ✓ ${country.name} ${entry.date} — inserted ${entry.results.length} result rows`
  );
}

async function main() {
  console.log(`Backfilling election results for ${BACKFILL.length} elections...`);
  for (const entry of BACKFILL) {
    await backfillOne(entry);
  }
  console.log("Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
