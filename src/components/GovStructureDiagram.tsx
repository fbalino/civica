interface GovBody {
  id: string;
  name: string;
  branch: string | null;
}

interface GovOffice {
  id: string;
  bodyId: string;
  name: string;
  officeType: string;
}

interface GovTerm {
  term: { officeId: string };
  person: { name: string };
}

const BRANCH_COLORS: Record<string, string> = {
  executive: "#D4764E",
  legislative: "#4E8BD4",
  judicial: "#5CAA6E",
};

const BRANCH_ORDER = ["executive", "legislative", "judicial"];

export function GovStructureDiagram({
  bodies,
  offices,
  currentTerms,
  countryName,
}: {
  bodies: GovBody[];
  offices: GovOffice[];
  currentTerms: GovTerm[];
  countryName: string;
}) {
  const isQid = (name: string) => /^Q\d+$/.test(name);

  const branches = BRANCH_ORDER
    .map((branch) => {
      const branchBodies = bodies.filter((b) => b.branch === branch);
      const branchOffices = branchBodies.flatMap((body) =>
        offices
          .filter((o) => o.bodyId === body.id)
          .map((o) => {
            const holder = currentTerms.find(
              (t) => t.term.officeId === o.id && !isQid(t.person.name)
            );
            return { ...o, holder: holder?.person.name ?? null };
          })
      );
      if (branchOffices.length === 0) return null;
      return { branch, color: BRANCH_COLORS[branch] ?? "#8899AA", offices: branchOffices };
    })
    .filter(Boolean) as { branch: string; color: string; offices: (GovOffice & { holder: string | null })[] }[];

  if (branches.length === 0) return null;

  const colWidth = 240;
  const colGap = 24;
  const totalWidth = branches.length * colWidth + (branches.length - 1) * colGap;
  const headerHeight = 60;
  const nodeHeight = 52;
  const nodeGap = 8;
  const maxOffices = Math.max(...branches.map((b) => b.offices.length));
  const totalHeight = headerHeight + maxOffices * (nodeHeight + nodeGap) + 20;

  return (
    <div style={{ overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width="100%"
        style={{ maxWidth: totalWidth, display: "block", margin: "0 auto" }}
        role="img"
        aria-label={`Government structure of ${countryName}`}
      >
        {branches.map((branch, colIdx) => {
          const x = colIdx * (colWidth + colGap);
          return (
            <g key={branch.branch}>
              {/* Branch header bar */}
              <rect
                x={x}
                y={0}
                width={colWidth}
                height={36}
                rx={3}
                fill={branch.color}
                opacity={0.12}
              />
              <rect
                x={x}
                y={0}
                width={colWidth}
                height={3}
                rx={1.5}
                fill={branch.color}
              />
              <text
                x={x + colWidth / 2}
                y={23}
                textAnchor="middle"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  fill: branch.color,
                  fontWeight: 500,
                }}
              >
                {branch.branch}
              </text>

              {/* Connector line from header to first node */}
              <line
                x1={x + colWidth / 2}
                y1={36}
                x2={x + colWidth / 2}
                y2={headerHeight}
                stroke={branch.color}
                strokeWidth={1}
                opacity={0.2}
              />

              {/* Office nodes */}
              {branch.offices.map((office, offIdx) => {
                const nodeY = headerHeight + offIdx * (nodeHeight + nodeGap);
                return (
                  <g key={office.id}>
                    {/* Connector between nodes */}
                    {offIdx > 0 && (
                      <line
                        x1={x + colWidth / 2}
                        y1={nodeY - nodeGap}
                        x2={x + colWidth / 2}
                        y2={nodeY}
                        stroke={branch.color}
                        strokeWidth={1}
                        opacity={0.15}
                      />
                    )}
                    {/* Node background */}
                    <rect
                      x={x}
                      y={nodeY}
                      width={colWidth}
                      height={nodeHeight}
                      rx={3}
                      fill="var(--color-card-bg)"
                      stroke={`${branch.color}22`}
                      strokeWidth={1}
                    />
                    {/* Left border accent */}
                    <rect
                      x={x}
                      y={nodeY}
                      width={2}
                      height={nodeHeight}
                      rx={1}
                      fill={branch.color}
                      opacity={0.4}
                    />
                    {/* Office name */}
                    <text
                      x={x + 12}
                      y={nodeY + 20}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fill: "var(--color-text-60)",
                      }}
                    >
                      {office.name.length > 28 ? office.name.slice(0, 26) + "..." : office.name}
                    </text>
                    {/* Holder name */}
                    {office.holder && (
                      <text
                        x={x + 12}
                        y={nodeY + 38}
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: 13,
                          fill: "var(--color-text-85)",
                        }}
                      >
                        {office.holder.length > 26 ? office.holder.slice(0, 24) + "..." : office.holder}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
