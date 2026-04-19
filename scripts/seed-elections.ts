import { db } from "../src/lib/db/index";
import { elections, electionResults, jurisdictions } from "../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";

const ELECTION_DATA = [
  {
    country: "germany", date: "2025-02-23", type: "Legislative", name: "2025 Federal Election",
    system: "Mixed-member proportional", turnout: 82.5,
    results: [
      { party: "CDU/CSU", color: "#000000", pct: 28.5, seats: 196, winner: true },
      { party: "AfD", color: "#009EE0", pct: 20.8, seats: 152, winner: false },
      { party: "SPD", color: "#E3000F", pct: 20.5, seats: 120, winner: false },
      { party: "Greens", color: "#64A12D", pct: 11.6, seats: 85, winner: false },
      { party: "BSW", color: "#732345", pct: 4.9, seats: 0, winner: false },
    ],
  },
  {
    country: "canada", date: "2025-04-28", type: "Legislative", name: "2025 Federal Election",
    system: "First-past-the-post", turnout: null,
    results: [],
  },
  {
    country: "australia", date: "2025-05-03", type: "Legislative", name: "2025 Federal Election",
    system: "Preferential voting", turnout: null,
    results: [],
  },
  {
    country: "united-states", date: "2024-11-05", type: "Presidential", name: "2024 Presidential Election",
    system: "Electoral college", turnout: 65.5,
    results: [
      { party: "Republican", color: "#E81B23", pct: 49.9, seats: 312, winner: true },
      { party: "Democratic", color: "#3333FF", pct: 48.3, seats: 226, winner: false },
    ],
  },
  {
    country: "united-kingdom", date: "2024-07-04", type: "Legislative", name: "2024 General Election",
    system: "First-past-the-post", turnout: 59.9,
    results: [
      { party: "Labour", color: "#E4003B", pct: 33.7, seats: 411, winner: true },
      { party: "Conservative", color: "#0087DC", pct: 23.7, seats: 121, winner: false },
      { party: "Reform UK", color: "#12B6CF", pct: 14.3, seats: 5, winner: false },
      { party: "Liberal Democrats", color: "#FAA61A", pct: 12.2, seats: 72, winner: false },
    ],
  },
  {
    country: "france", date: "2024-06-30", type: "Legislative", name: "2024 Legislative Election",
    system: "Two-round system", turnout: 66.7,
    results: [
      { party: "NFP", color: "#BB1840", pct: 26.0, seats: 182, winner: false },
      { party: "Ensemble", color: "#FFD700", pct: 24.5, seats: 168, winner: false },
      { party: "RN", color: "#0D378A", pct: 33.2, seats: 143, winner: false },
    ],
  },
  {
    country: "india", date: "2024-04-19", type: "Legislative", name: "2024 General Election",
    system: "First-past-the-post", turnout: 65.8,
    results: [
      { party: "BJP", color: "#FF9933", pct: 36.6, seats: 240, winner: true },
      { party: "INC", color: "#19AAED", pct: 21.2, seats: 99, winner: false },
      { party: "SP", color: "#FF0000", pct: 4.5, seats: 37, winner: false },
    ],
  },
  {
    country: "south-africa", date: "2024-05-29", type: "Legislative", name: "2024 National Election",
    system: "Party-list proportional", turnout: 58.6,
    results: [
      { party: "ANC", color: "#009A44", pct: 40.2, seats: 159, winner: true },
      { party: "DA", color: "#005BA6", pct: 21.8, seats: 87, winner: false },
      { party: "MK", color: "#FFD700", pct: 14.6, seats: 58, winner: false },
      { party: "EFF", color: "#FF0000", pct: 9.5, seats: 39, winner: false },
    ],
  },
  {
    country: "mexico", date: "2024-06-02", type: "Presidential", name: "2024 Presidential Election",
    system: "First-past-the-post", turnout: 61.0,
    results: [
      { party: "Morena", color: "#691C32", pct: 59.8, seats: 0, winner: true },
      { party: "PAN-PRI-PRD", color: "#003DA5", pct: 27.5, seats: 0, winner: false },
      { party: "MC", color: "#FF8300", pct: 10.3, seats: 0, winner: false },
    ],
  },
  {
    country: "japan", date: "2024-10-27", type: "Legislative", name: "2024 House of Representatives Election",
    system: "Mixed-member proportional", turnout: 53.9,
    results: [
      { party: "LDP", color: "#FF0000", pct: 26.7, seats: 191, winner: true },
      { party: "CDP", color: "#1E90FF", pct: 24.9, seats: 148, winner: false },
      { party: "Ishin", color: "#A0D468", pct: 13.5, seats: 38, winner: false },
    ],
  },
  {
    country: "south-korea", date: "2025-06-03", type: "Presidential", name: "2025 Presidential Election",
    system: "First-past-the-post", turnout: null,
    results: [],
  },
  {
    country: "brazil", date: "2026-10-04", type: "Presidential", name: "2026 Presidential Election",
    system: "Two-round system", turnout: null,
    results: [],
  },
];

async function seed() {
  console.log("Seeding elections...");

  for (const e of ELECTION_DATA) {
    const [j] = await db.select().from(jurisdictions).where(eq(jurisdictions.slug, e.country)).limit(1);
    if (!j) { console.log(`  Skip: ${e.country} not found`); continue; }

    const existing = await db.select({ id: elections.id }).from(elections)
      .where(sql`${elections.jurisdictionId} = ${j.id} AND ${elections.electionDate} = ${e.date}`)
      .limit(1);
    if (existing.length > 0) { console.log(`  Skip: ${e.name} already exists`); continue; }

    const [inserted] = await db.insert(elections).values({
      jurisdictionId: j.id,
      electionDate: e.date,
      electionType: e.type,
      electionName: e.name,
      electoralSystem: e.system,
      turnoutPercent: e.turnout,
    }).returning({ id: elections.id });

    for (const r of e.results) {
      await db.insert(electionResults).values({
        electionId: inserted.id,
        partyName: r.party,
        partyColor: r.color,
        votesPercent: r.pct,
        seatsWon: r.seats,
        isWinner: r.winner,
      });
    }

    console.log(`  ✓ ${e.name}`);
  }

  console.log("Done!");
  process.exit(0);
}

seed().catch(console.error);
