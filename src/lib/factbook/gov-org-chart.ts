// Government structure model + builder for the Civica Data → Government
// section ("How power is organised").
//
// This replaces the abstract top-down SVG org chart. An audit of the
// underlying data showed the SVG read as 2–4 thin floating boxes for the
// ~95% of countries that carry only a head of state, a head of government,
// and one or two legislative chambers. The branch-grouped model below is
// legible at that thin tier AND scales up for the data-rich cases
// (United States: 4 bodies / 11 offices; United Kingdom: cabinet detail).
//
// Honest-data principle (unchanged from the prior implementation): we only
// surface relationships and facts that are EXPLICITLY in the schema. We do
// NOT infer cross-branch edges, monarch-vs-president distinctions, or any
// title the data does not give us. Sparse countries degrade to fewer cards,
// never fabricated structure.
//
// Data sources used (per the existing `getGovernmentStructure` query):
//   - government_bodies.branch        → which column (executive/legislative/judicial)
//   - government_bodies.bodyType      → cabinet vs legislature vs judiciary
//   - government_bodies.chamberType   → upper / lower chamber label
//   - government_bodies.totalSeats    → chamber seat count
//   - offices.officeType             → role grouping + ordering within a branch
//   - offices.reportsToOfficeId      → "reports to" relation (rare; 8 of 389)
//   - terms (current)                → current officeholder + start date
//   - terms.partyName / partyColor   → holder party affiliation (sparse; 11 of 389)

// ─── Public model (what the renderer consumes) ─────────────────────────────

export type GovBranchKind = "executive" | "legislative" | "judicial" | "other";

/** A single office card: a role + (optionally) who currently holds it. */
export interface GovRole {
  id: string;
  /** Role / office title, e.g. "Head of State", "Secretary of Defense". */
  title: string;
  /** Current officeholder name, when sourced. */
  holderName?: string;
  /** Year the current holder took office, when sourced (from term.startDate). */
  sinceYear?: number;
  /** Holder's party, when sourced (sparse). */
  party?: string;
  /** Party swatch colour, when sourced. Always a hex/string from the DB —
   *  rendered as an inline style on a small dot, never on text. */
  partyColor?: string;
  /** Tier within the branch column: 0 = principal (head), 1 = deputy /
   *  leadership, 2 = members (cabinet ministers, etc.). Drives indentation
   *  and emphasis, not a separate row. */
  rank: 0 | 1 | 2;
  /** True when this card has no current holder (role exists, seat data thin). */
  vacant: boolean;
}

/** A legislative chamber (or, generically, a named body within a branch). */
export interface GovChamber {
  id: string;
  /** Real body name, e.g. "House of Representatives", "National Assembly". */
  name: string;
  /** "Upper" / "Lower" when chamberType is set. */
  chamberLabel?: string;
  /** Seat count, when sourced. */
  totalSeats?: number;
  /** Leadership roles attached to this chamber (speakers, majority leaders). */
  roles: GovRole[];
}

export interface GovBranch {
  kind: GovBranchKind;
  /** Column heading, e.g. "Executive", "Legislative", "Judicial". */
  label: string;
  /** Principal / cabinet roles (executive & judicial branches). */
  roles: GovRole[];
  /** Named chambers/courts within the branch (legislative & judicial). */
  chambers: GovChamber[];
  /** One-line descriptor under the heading, e.g. "Bicameral · 535 seats". */
  summary?: string;
}

export interface GovStructure {
  branches: GovBranch[];
  /** Source attribution string for the SourceDot. */
  source: string;
  /** Total cards rendered — used by the caller's visibility gate. */
  nodeCount: number;
  /** True when both head-of-state and head-of-government resolve to the same
   *  person (presidential systems, absolute monarchies) and were merged. */
  headsMerged: boolean;
  /** Count of distinct named officeholders surfaced — drives the footer note. */
  officeholderCount: number;
}

// ─── Inputs from the existing data layer ───────────────────────────────────
// Shapes mirror what `getGovernmentStructure(jurisdictionId)` returns so the
// existing call site passes its rows straight through.

export interface GovBodyInput {
  id: string;
  name: string;
  branch: string | null;
  bodyType?: string | null;
  chamberType?: string | null;
  totalSeats?: number | null;
  parentBodyId?: string | null;
  hierarchyLevel?: number | null;
}

export interface GovOfficeInput {
  id: string;
  bodyId: string;
  name: string;
  officeType: string;
  reportsToOfficeId?: string | null;
}

export interface GovTermInput {
  term: {
    officeId: string;
    startDate?: string | Date | null;
    partyName?: string | null;
    partyColor?: string | null;
  };
  person: { name: string };
}

export interface BuildGovStructureInput {
  bodies: GovBodyInput[];
  offices: GovOfficeInput[];
  currentTerms: GovTermInput[];
  /** Wikidata persons sometimes leak QIDs into person.name; filter them. */
  isQid?: (name: string) => boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function normaliseBranch(raw: string | null | undefined): GovBranchKind {
  switch ((raw ?? "").toLowerCase()) {
    case "executive":
    case "monarchy":
      return "executive";
    case "legislative":
      return "legislative";
    case "judicial":
      return "judicial";
    default:
      return "other";
  }
}

const BRANCH_LABEL: Record<GovBranchKind, string> = {
  executive: "Executive",
  legislative: "Legislative",
  judicial: "Judicial",
  other: "Other bodies",
};

/** Display order of branches in the layout. */
const BRANCH_ORDER: GovBranchKind[] = [
  "executive",
  "legislative",
  "judicial",
  "other",
];

/** Office-type → rank within its branch column (0 highest). */
function rankOfOffice(officeType: string): 0 | 1 | 2 {
  switch (officeType) {
    case "head_of_state":
    case "head_of_government":
    case "judicial_leader":
      return 0;
    case "deputy_head":
      return 1;
    case "legislative_leader":
      return 1;
    case "cabinet":
    default:
      return 2;
  }
}

function yearOf(value: string | Date | null | undefined): number | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  const y = d.getUTCFullYear();
  return y > 1000 && y < 3000 ? y : undefined;
}

interface CurrentHolder {
  name: string;
  sinceYear?: number;
  party?: string;
  partyColor?: string;
}

// ─── Builder ─────────────────────────────────────────────────────────────────

/**
 * Pure transform: the same rows `getGovernmentStructure` returns →
 * a branch-grouped `GovStructure`. Returns `null` when there is no
 * meaningful structure (no offices and ≤1 body) so the caller can fall
 * back to the CIA reference prose.
 */
export function buildGovStructure(
  input: BuildGovStructureInput
): GovStructure | null {
  const { bodies, offices, currentTerms } = input;
  const isQid = input.isQid ?? ((s: string) => /^Q\d+$/.test(s));

  if (offices.length === 0 && bodies.length <= 1) return null;

  // Current holder per office (first non-QID term wins).
  const holderByOffice = new Map<string, CurrentHolder>();
  for (const t of currentTerms) {
    const name = t.person?.name;
    if (!name || isQid(name)) continue;
    if (holderByOffice.has(t.term.officeId)) continue;
    holderByOffice.set(t.term.officeId, {
      name,
      sinceYear: yearOf(t.term.startDate),
      party: t.term.partyName ?? undefined,
      partyColor: t.term.partyColor ?? undefined,
    });
  }

  const bodyById = new Map(bodies.map((b) => [b.id, b]));

  function roleFromOffice(o: GovOfficeInput, title?: string): GovRole {
    const holder = holderByOffice.get(o.id);
    return {
      id: `office:${o.id}`,
      title: title ?? o.name,
      holderName: holder?.name,
      sinceYear: holder?.sinceYear,
      party: holder?.party,
      partyColor: holder?.partyColor,
      rank: rankOfOffice(o.officeType),
      vacant: !holder,
    };
  }

  // ── Detect a shared head (HoS === HoG, same person) ──────────────────────
  // Presidential systems and absolute monarchies store two offices held by
  // one person. Merge them into a single principal card so the chart doesn't
  // show the same human twice.
  const hosOffice = offices.find((o) => o.officeType === "head_of_state");
  const hogOffice = offices.find((o) => o.officeType === "head_of_government");
  const hosHolder = hosOffice ? holderByOffice.get(hosOffice.id) : undefined;
  const hogHolder = hogOffice ? holderByOffice.get(hogOffice.id) : undefined;
  const headsMerged =
    !!hosOffice &&
    !!hogOffice &&
    !!hosHolder &&
    !!hogHolder &&
    hosHolder.name === hogHolder.name;

  const mergedOfficeIds = new Set<string>();
  const executiveRoles: GovRole[] = [];
  if (headsMerged && hosOffice && hogOffice) {
    mergedOfficeIds.add(hosOffice.id);
    mergedOfficeIds.add(hogOffice.id);
    const holder = hosHolder!;
    executiveRoles.push({
      id: `office:${hosOffice.id}`,
      title: "Head of State and Government",
      holderName: holder.name,
      sinceYear: holder.sinceYear,
      party: holder.party,
      partyColor: holder.partyColor,
      rank: 0,
      vacant: false,
    });
  }

  // ── Assign offices to branches via their parent body ─────────────────────
  // Group sub-offices (cabinet members, chamber leaders) by their target.
  const branchRoles: Record<GovBranchKind, GovRole[]> = {
    executive: [...executiveRoles],
    legislative: [],
    judicial: [],
    other: [],
  };
  // Leadership offices attached to a specific legislative/judicial body.
  const rolesByBody = new Map<string, GovRole[]>();

  for (const o of offices) {
    if (mergedOfficeIds.has(o.id)) continue;
    const body = bodyById.get(o.bodyId);
    const branchKind = normaliseBranch(body?.branch);

    // Chamber/court leadership lands on the body card, not the branch column.
    if (
      (branchKind === "legislative" || branchKind === "judicial") &&
      body &&
      body.bodyType !== "cabinet"
    ) {
      const arr = rolesByBody.get(body.id) ?? [];
      arr.push(roleFromOffice(o));
      rolesByBody.set(body.id, arr);
      continue;
    }
    branchRoles[branchKind].push(roleFromOffice(o));
  }

  // ── Build chambers (legislative & judicial named bodies) ─────────────────
  const branchChambers: Record<GovBranchKind, GovChamber[]> = {
    executive: [],
    legislative: [],
    judicial: [],
    other: [],
  };

  // A unicameral legislature carries no meaningful upper/lower distinction,
  // yet the source still tags its single chamber "lower". Suppress the
  // chamber label in that case so we don't imply a missing upper house.
  const legislativeBodyCount = bodies.filter(
    (b) => normaliseBranch(b.branch) === "legislative" && b.bodyType !== "cabinet"
  ).length;

  for (const b of bodies) {
    const branchKind = normaliseBranch(b.branch);
    // The executive "Executive of X" cabinet body is a container with a
    // generic name; we surface its offices, not the body itself.
    if (branchKind === "executive" || b.bodyType === "cabinet") continue;
    if (branchKind === "other") continue;

    const chamberLabel =
      branchKind === "legislative" && legislativeBodyCount < 2
        ? undefined
        : b.chamberType === "upper"
          ? "Upper chamber"
          : b.chamberType === "lower"
            ? "Lower chamber"
            : undefined;

    branchChambers[branchKind].push({
      id: `body:${b.id}`,
      name: b.name,
      chamberLabel,
      totalSeats: b.totalSeats ?? undefined,
      roles: sortRoles(rolesByBody.get(b.id) ?? []),
    });
  }

  // ── Assemble branches in canonical order, skipping empties ───────────────
  const branches: GovBranch[] = [];
  for (const kind of BRANCH_ORDER) {
    const roles = sortRoles(branchRoles[kind]);
    const chambers = sortChambers(branchChambers[kind], kind);
    if (roles.length === 0 && chambers.length === 0) continue;
    branches.push({
      kind,
      label: BRANCH_LABEL[kind],
      roles,
      chambers,
      summary: summarise(kind, chambers),
    });
  }

  if (branches.length === 0) return null;

  // ── Counts for the gate + footer note ────────────────────────────────────
  const named = new Set<string>();
  let nodeCount = 0;
  for (const br of branches) {
    for (const r of br.roles) {
      nodeCount += 1;
      if (r.holderName) named.add(r.holderName);
    }
    for (const ch of br.chambers) {
      nodeCount += 1;
      for (const r of ch.roles) {
        nodeCount += 1;
        if (r.holderName) named.add(r.holderName);
      }
    }
  }

  return {
    branches,
    source: "Civica · CIA World Factbook + Wikidata officeholders",
    nodeCount,
    headsMerged,
    officeholderCount: named.size,
  };
}

// ─── Ordering helpers ────────────────────────────────────────────────────────

function sortRoles(roles: GovRole[]): GovRole[] {
  // Stable sort by rank, holders before vacant within the same rank.
  return [...roles].sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.vacant !== b.vacant) return a.vacant ? 1 : -1;
    return 0;
  });
}

function sortChambers(
  chambers: GovChamber[],
  kind: GovBranchKind
): GovChamber[] {
  if (kind !== "legislative") return chambers;
  // Upper chamber above lower chamber for a consistent bicameral reading.
  const order = (c: GovChamber) =>
    c.chamberLabel === "Upper chamber"
      ? 0
      : c.chamberLabel === "Lower chamber"
        ? 1
        : 2;
  return [...chambers].sort((a, b) => order(a) - order(b));
}

function summarise(kind: GovBranchKind, chambers: GovChamber[]): string | undefined {
  if (kind !== "legislative" || chambers.length === 0) return undefined;
  const cameral = chambers.length >= 2 ? "Bicameral" : "Unicameral";
  const seatTotal = chambers.reduce((s, c) => s + (c.totalSeats ?? 0), 0);
  if (seatTotal > 0) {
    return `${cameral} · ${seatTotal.toLocaleString("en-US")} seats`;
  }
  return cameral;
}

// ─── DB-backed convenience (preserves the existing call-site contract) ───────

/**
 * Same inputs as `getGovernmentStructure(jurisdictionId)`; returns a
 * `GovStructure` ready for the renderer, or `null` when structure is too
 * thin. The name is retained for the existing call site in
 * `(reader)/country/[slug]/civica-data/page.tsx`.
 */
export function buildOrgChartFromGovernmentStructure(
  bodies: GovBodyInput[],
  offices: GovOfficeInput[],
  currentTerms: GovTermInput[]
): GovStructure | null {
  return buildGovStructure({ bodies, offices, currentTerms });
}
