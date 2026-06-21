// Government org-chart data shape + builder.
//
// Phase G renders an actual top-down org chart for the Government
// section of /factbook/[slug], replacing the side-by-side
// Executive/Legislative/Judicial card layout the user correctly
// flagged as "horrible, no value."
//
// Conservative principle (post-Outcomes-methodology lesson): we only
// render relationships that are EXPLICITLY in the schema. We do NOT
// infer cross-branch edges (e.g. "monarch appoints PM") from the
// gov-type taxonomy. If we don't have the data, the chart shows fewer
// edges — readers get less, but everything they DO see is sourced.
//
// Data sources used:
//   - government_bodies.parentBodyId   → body→body edge
//   - government_bodies.branch         → tier inference (monarchy/exec/legislative/judicial)
//   - government_bodies.hierarchyLevel → tier ordering within branch
//   - offices.bodyId                   → office→body containment
//   - offices.reportsToOfficeId        → office→office edge
//   - offices.officeType               → tier inference (head_of_state at top)
//   - terms (current)                  → who currently occupies each office

// ─── Public data shape (what the renderer consumes) ─────────────────────────

export interface OrgNode {
  id: string;
  /** Display label, e.g. "Head of State", "House of Representatives" */
  label: string;
  /** Optional secondary line, e.g. "360 seats", "ceremonial" */
  sublabel?: string;
  /** Current officeholder name, when this is an office */
  holderName?: string;
  /** Branch — drives the accent colour (--color-branch-*) */
  branch?:
    | "monarchy"
    | "executive"
    | "legislative"
    | "judicial"
    | "religious"
    | "party"
    | "other";
  /** Visual hint — render with a smaller / dashed border */
  isCeremonial?: boolean;
  /** "office" boxes are smaller; "body" boxes are larger and may show seat counts */
  kind: "office" | "body";
  /** For body nodes — total seats, surfaces in the sublabel */
  totalSeats?: number | null;
}

export interface OrgEdge {
  from: string; // node id
  to: string; // node id
  /** Edge semantics — drives the line style + label.
   *  "contains" = body contains office (vertical, solid)
   *  "reports_to" = office reports to office (vertical, solid)
   *  "subordinates" = parent body contains sub-body (vertical, solid)
   *  "appoints" / "confidence" / "elects" / "advises" / "reviews" reserved for
   *  future curated cross-branch edges — NOT inferred. */
  type:
    | "contains"
    | "reports_to"
    | "subordinates"
    | "appoints"
    | "confidence"
    | "elects"
    | "advises"
    | "reviews";
  /** Optional label override; otherwise type-derived */
  label?: string;
}

export interface OrgChart {
  /** Tiers (rows) of nodes, top → bottom */
  tiers: OrgNode[][];
  edges: OrgEdge[];
  /** Source attribution string for the SourceDot */
  source: string;
  /** Provenance note shown below the chart */
  note?: string;
  /** Number of nodes — when very low, the renderer shows a "limited
   *  structural data" notice instead of the chart */
  nodeCount: number;
}

// ─── Inputs from the existing data layer ─────────────────────────────────────

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
  term: { officeId: string };
  person: { name: string };
}

export interface BuildOrgChartInput {
  bodies: GovBodyInput[];
  offices: GovOfficeInput[];
  currentTerms: GovTermInput[];
  /** Wikidata persons sometimes leak QIDs into person.name; filter them */
  isQid?: (name: string) => boolean;
}

// ─── Tier inference rules ────────────────────────────────────────────────────

/**
 * Tier number (lower = higher in the chart).
 *
 * 0  Head of state office (always at top)
 * 0  Monarchy bodies (when monarchy branch present and no head_of_state office)
 * 1  Head of government office
 * 1  Top-level executive/legislative/judicial bodies
 * 2  Sub-bodies (parented), deputy offices, individual chambers' speakers
 * 3+ further descendants
 */
function tierOfOffice(o: GovOfficeInput): number {
  switch (o.officeType) {
    case "head_of_state":
      return 0;
    case "head_of_government":
      return 1;
    case "deputy_head":
    case "cabinet":
    case "legislative_leader":
      return 2;
    case "judicial":
      return 1;
    default:
      return 2;
  }
}

function tierOfBody(b: GovBodyInput, allBodies: GovBodyInput[]): number {
  if (b.branch === "monarchy") return 0;
  if (b.parentBodyId && allBodies.some((p) => p.id === b.parentBodyId)) {
    return 2;
  }
  return 1;
}

const BRANCH_NORMALISE: Record<string, OrgNode["branch"]> = {
  monarchy: "monarchy",
  executive: "executive",
  legislative: "legislative",
  judicial: "judicial",
  religious: "religious",
  party: "party",
};

function normalisedBranch(raw: string | null): OrgNode["branch"] {
  if (!raw) return "other";
  const k = raw.toLowerCase();
  return BRANCH_NORMALISE[k] ?? "other";
}

// ─── Builder ────────────────────────────────────────────────────────────────

/**
 * Pure transform: takes the same inputs the legacy GovStructureDiagram
 * receives, returns a structured OrgChart.
 *
 * Returns `null` when there's effectively no structural data
 * (≤ 1 body AND ≤ 1 office) — caller should fall back to the CIA
 * reference data only.
 */
export function buildOrgChart(input: BuildOrgChartInput): OrgChart | null {
  const { bodies, offices, currentTerms } = input;
  const isQid = input.isQid ?? ((s: string) => /^Q\d+$/.test(s));

  if (bodies.length <= 1 && offices.length <= 1) return null;

  const holderByOffice = new Map<string, string>();
  for (const t of currentTerms) {
    if (isQid(t.person.name)) continue;
    if (!holderByOffice.has(t.term.officeId)) {
      holderByOffice.set(t.term.officeId, t.person.name);
    }
  }

  // Build node list. Each node is either an office or a body.
  const nodes: Array<{ node: OrgNode; tier: number }> = [];

  for (const b of bodies) {
    const tier = tierOfBody(b, bodies);
    const totalSeats = b.totalSeats ?? null;
    let sublabel: string | undefined;
    if (b.chamberType) {
      const chamberLabel = b.chamberType === "upper" ? "Upper" : b.chamberType === "lower" ? "Lower" : "";
      sublabel = totalSeats
        ? `${chamberLabel} chamber · ${totalSeats} seats`
        : `${chamberLabel} chamber`;
    } else if (totalSeats) {
      sublabel = `${totalSeats} seats`;
    } else if (b.bodyType) {
      sublabel = b.bodyType.replace(/_/g, " ");
    }
    nodes.push({
      node: {
        id: `body:${b.id}`,
        label: b.name,
        sublabel,
        branch: normalisedBranch(b.branch),
        kind: "body",
        totalSeats,
      },
      tier,
    });
  }

  for (const o of offices) {
    const tier = tierOfOffice(o);
    const parentBody = bodies.find((b) => b.id === o.bodyId);
    nodes.push({
      node: {
        id: `office:${o.id}`,
        label: o.name,
        holderName: holderByOffice.get(o.id),
        branch: normalisedBranch(parentBody?.branch ?? null),
        kind: "office",
      },
      tier,
    });
  }

  // Edges (only relationships explicitly in the schema).
  const edges: OrgEdge[] = [];

  // body → sub-body
  for (const b of bodies) {
    if (b.parentBodyId && bodies.some((p) => p.id === b.parentBodyId)) {
      edges.push({
        from: `body:${b.parentBodyId}`,
        to: `body:${b.id}`,
        type: "subordinates",
      });
    }
  }

  // office → office
  for (const o of offices) {
    if (o.reportsToOfficeId && offices.some((p) => p.id === o.reportsToOfficeId)) {
      edges.push({
        from: `office:${o.reportsToOfficeId}`,
        to: `office:${o.id}`,
        type: "reports_to",
      });
    }
  }

  // body → office (containment) — only when the office has no parent
  // office (otherwise the parent-office is a stronger relation).
  for (const o of offices) {
    if (!o.reportsToOfficeId && bodies.some((b) => b.id === o.bodyId)) {
      // Promote head_of_state and head_of_government offices ABOVE their
      // body in the tier — readers expect "Head of State" at the top
      // even if the body it nominally belongs to is the cabinet.
      // The tier is already set correctly via tierOfOffice; the edge
      // direction here just signals containment.
      edges.push({
        from: `body:${o.bodyId}`,
        to: `office:${o.id}`,
        type: "contains",
      });
    }
  }

  // Group nodes into tiers (sparse → packed). If a tier is empty, skip it.
  const maxTier = Math.max(...nodes.map((n) => n.tier), 0);
  const tiers: OrgNode[][] = [];
  for (let t = 0; t <= maxTier; t++) {
    const row = nodes.filter((n) => n.tier === t).map((n) => n.node);
    if (row.length > 0) tiers.push(row);
  }

  return {
    tiers,
    edges,
    source: "Civica internal · derived from CIA Factbook + Wikidata officeholders",
    nodeCount: nodes.length,
  };
}

// ─── DB-backed helper (avoids re-implementing in page.tsx) ──────────────────

/**
 * Convenience: same inputs as the existing
 * `getGovernmentStructure(jurisdictionId)` query, but returns an
 * `OrgChart` ready to hand to the renderer.
 *
 * Designed so the existing call site in `(reader)/factbook/[slug]/page.tsx`
 * can pass `govStructure.bodies`, `govStructure.offices`,
 * `govStructure.currentTerms` straight through.
 */
export function buildOrgChartFromGovernmentStructure(
  bodies: GovBodyInput[],
  offices: GovOfficeInput[],
  currentTerms: GovTermInput[]
): OrgChart | null {
  return buildOrgChart({ bodies, offices, currentTerms });
}
