import type { OrgChart, OrgNode, OrgEdge } from "@/lib/factbook/gov-org-chart";

/**
 * Top-down SVG org chart for the factbook Government section.
 *
 * Replaces the side-by-side Executive/Legislative card layout. Renders
 * tiers as horizontal rows, each node as a small box, edges as bezier
 * lines connecting the bottom of "from" to the top of "to". Branch
 * colour drives the box accent.
 *
 * Conservative: renders only edges that are EXPLICITLY in the data
 * (body→sub-body, office→office reports-to, body→office containment).
 * No inferred cross-branch relationships. If we can't draw a meaningful
 * chart from the given data, the component shows a small note instead
 * of inventing structure.
 *
 * Server component — no interactivity. Hover/expand can come later.
 */

interface Props {
  chart: OrgChart;
  countryName: string;
}

// Layout constants (in viewBox units)
const NODE_W = 180;
const NODE_W_BODY = 220;
const NODE_H = 56;
const TIER_GAP = 80; // vertical spacing between tier rows
const NODE_GAP = 16; // horizontal spacing between siblings
const SUB_ROW_GAP = 18; // vertical spacing between wrapped sub-rows of a single tier
// Max chart width before tiers wrap into multiple sub-rows. Picked to
// match the editorial main-column width on desktop — wider charts get
// horizontal scroll, narrower ones wrap.
const MAX_CHART_WIDTH = 1100;

const BRANCH_COLOR: Record<NonNullable<OrgNode["branch"]>, string> = {
  monarchy: "var(--color-branch-monarchy, var(--color-warn))",
  executive: "var(--color-branch-executive, var(--color-accent))",
  legislative: "var(--color-branch-legislative, var(--color-source-frozen))",
  judicial: "var(--color-branch-judicial, var(--color-text-60))",
  religious: "var(--color-branch-religious, var(--color-warn))",
  party: "var(--color-branch-party, var(--color-danger))",
  other: "var(--color-text-40)",
};

interface PlacedNode {
  node: OrgNode;
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export function FactbookGovOrgChart({ chart, countryName }: Props) {
  // Empty / very-thin data gets a notice rather than a misleading chart.
  if (chart.nodeCount < 2 || chart.tiers.length === 0) {
    return (
      <div className="factbook-org-chart factbook-org-chart--empty">
        <p className="factbook-org-chart-note">
          Limited structural data available for {countryName}. See the CIA
          reference below for the textual government summary.
        </p>
      </div>
    );
  }

  // Wrap each tier into one or more sub-rows so very wide tiers (e.g. a
  // 9-member cabinet on tier 2) don't force horizontal scrolling on
  // every viewport. Each sub-row is at most MAX_CHART_WIDTH wide.
  interface SubRow {
    nodes: OrgNode[];
    width: number;
  }
  const tierSubRows: SubRow[][] = chart.tiers.map((tier) => {
    const subRows: SubRow[] = [{ nodes: [], width: 0 }];
    for (const node of tier) {
      const w = node.kind === "body" ? NODE_W_BODY : NODE_W;
      const cur = subRows[subRows.length - 1];
      const projected =
        cur.width + (cur.nodes.length > 0 ? NODE_GAP : 0) + w;
      if (projected > MAX_CHART_WIDTH && cur.nodes.length > 0) {
        subRows.push({ nodes: [node], width: w });
      } else {
        cur.nodes.push(node);
        cur.width += (cur.nodes.length > 1 ? NODE_GAP : 0) + w;
      }
    }
    return subRows;
  });

  // Total chart width = widest sub-row across all tiers.
  const chartWidth = Math.max(
    ...tierSubRows.flat().map((sr) => sr.width),
    NODE_W * 2
  );

  // Place each node. Track tier-top y for edge endpoint computation.
  const placements: PlacedNode[] = [];
  const tierTopY: number[] = [];
  let cy = NODE_H / 2;
  for (let ti = 0; ti < tierSubRows.length; ti++) {
    tierTopY[ti] = cy - NODE_H / 2;
    const subRows = tierSubRows[ti];
    for (let si = 0; si < subRows.length; si++) {
      const subRow = subRows[si];
      const startX = (chartWidth - subRow.width) / 2;
      let x = startX;
      for (const node of subRow.nodes) {
        const w = node.kind === "body" ? NODE_W_BODY : NODE_W;
        placements.push({ node, cx: x + w / 2, cy, w, h: NODE_H });
        x += w + NODE_GAP;
      }
      // Advance cy: full NODE_H + small gap if there are more sub-rows
      // in THIS tier; full NODE_H + TIER_GAP between tiers.
      const isLastSubRowInTier = si === subRows.length - 1;
      cy += NODE_H + (isLastSubRowInTier ? TIER_GAP : SUB_ROW_GAP);
    }
  }
  // Subtract the last trailing TIER_GAP (no row below it).
  const chartHeight = cy - TIER_GAP - NODE_H / 2 + NODE_H / 2;

  // Edge lookup
  const placementById = new Map<string, PlacedNode>();
  for (const p of placements) placementById.set(p.node.id, p);

  return (
    <div className="factbook-org-chart">
      <div
        className="factbook-org-chart-scroll"
        style={{ overflowX: "auto", overflowY: "hidden" }}
      >
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="xMidYMin meet"
        width={chartWidth}
        height={chartHeight}
        style={{ minWidth: chartWidth, maxWidth: "none" }}
        role="img"
        aria-label={`Government organisation chart for ${countryName}`}
        className="factbook-org-chart-svg"
      >
        {/* Edges first so nodes paint over them */}
        <g className="factbook-org-chart-edges">
          {chart.edges.map((edge, i) => {
            const from = placementById.get(edge.from);
            const to = placementById.get(edge.to);
            if (!from || !to) return null;
            return <EdgePath key={i} edge={edge} from={from} to={to} />;
          })}
        </g>

        {/* Nodes */}
        <g className="factbook-org-chart-nodes">
          {placements.map((p) => (
            <NodeBox key={p.node.id} placement={p} />
          ))}
        </g>
      </svg>
      </div>

      <div className="factbook-org-chart-legend">
        {Array.from(
          new Set(
            placements
              .map((p) => p.node.branch)
              .filter((b): b is NonNullable<OrgNode["branch"]> => !!b)
          )
        ).map((b) => (
          <span key={b} className="factbook-org-chart-legend-item">
            <span
              className="factbook-org-chart-legend-swatch"
              style={{ background: BRANCH_COLOR[b] }}
              aria-hidden
            />
            {b.charAt(0).toUpperCase() + b.slice(1)}
          </span>
        ))}
      </div>
    </div>
  );
}

function NodeBox({ placement }: { placement: PlacedNode }) {
  const { node, cx, cy, w, h } = placement;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const accent = node.branch ? BRANCH_COLOR[node.branch] : BRANCH_COLOR.other;

  return (
    <g
      className={`factbook-org-chart-node factbook-org-chart-node--${node.kind}${
        node.isCeremonial ? " factbook-org-chart-node--ceremonial" : ""
      }`}
    >
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        ry={2}
        className="factbook-org-chart-node-bg"
      />
      {/* Top accent bar in the branch colour */}
      <rect
        x={x}
        y={y}
        width={w}
        height={3}
        fill={accent}
        className="factbook-org-chart-node-accent"
      />
      <text
        x={cx}
        y={y + 22}
        textAnchor="middle"
        className="factbook-org-chart-node-label"
      >
        {node.label}
      </text>
      {(node.holderName || node.sublabel) && (
        <text
          x={cx}
          y={y + 40}
          textAnchor="middle"
          className="factbook-org-chart-node-sublabel"
        >
          {node.holderName ?? node.sublabel}
        </text>
      )}
    </g>
  );
}

function EdgePath({
  edge,
  from,
  to,
}: {
  edge: OrgEdge;
  from: PlacedNode;
  to: PlacedNode;
}) {
  // Bezier from bottom of "from" to top of "to".
  const x1 = from.cx;
  const y1 = from.cy + from.h / 2;
  const x2 = to.cx;
  const y2 = to.cy - to.h / 2;
  const dy = y2 - y1;
  const cp1y = y1 + dy * 0.5;
  const cp2y = y2 - dy * 0.5;
  const d = `M ${x1} ${y1} C ${x1} ${cp1y}, ${x2} ${cp2y}, ${x2} ${y2}`;

  // Edge style by type
  const dashArray =
    edge.type === "appoints"
      ? "4 4"
      : edge.type === "confidence"
      ? "2 4"
      : edge.type === "elects"
      ? "1 3"
      : undefined;

  return (
    <path
      d={d}
      className={`factbook-org-chart-edge factbook-org-chart-edge--${edge.type}`}
      strokeDasharray={dashArray}
      fill="none"
    />
  );
}
