"use client";

import { useState, useRef, useEffect } from "react";

interface GovBody {
  id: string;
  name: string;
  branch: string | null;
  bodyType?: string;
  chamberType?: string | null;
  totalSeats?: number | null;
  parentBodyId?: string | null;
  hierarchyLevel?: number | null;
}

interface GovOffice {
  id: string;
  bodyId: string;
  name: string;
  officeType: string;
  reportsToOfficeId?: string | null;
}

interface GovTerm {
  term: {
    officeId: string;
    partyName?: string | null;
    partyColor?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  person: {
    name: string;
    photoUrl?: string | null;
    wikidataQid?: string | null;
  };
}

interface PartyData {
  bodyId: string;
  partyName: string;
  partyColor: string | null;
  seatCount: number;
  isRulingCoalition: boolean | null;
}

const BRANCH_COLORS: Record<string, string> = {
  executive: "var(--color-branch-executive)",
  legislative: "var(--color-branch-legislative)",
  judicial: "var(--color-branch-judicial)",
  monarchy: "var(--color-branch-monarchy)",
};

const BRANCH_LABELS: Record<string, string> = {
  executive: "Executive",
  legislative: "Legislative",
  judicial: "Judicial",
  monarchy: "Crown",
};

const BRANCH_ORDER = ["monarchy", "executive", "legislative", "judicial"];

type OfficeNode = GovOffice & {
  holder: GovTerm | null;
  children: OfficeNode[];
};

type BodyNode = {
  body: GovBody;
  offices: OfficeNode[];
  children: BodyNode[];
  parties: PartyData[];
};

function buildBodyTree(
  bodies: GovBody[],
  allOffices: GovOffice[],
  currentTerms: GovTerm[],
  parties: PartyData[],
  isQid: (name: string) => boolean
): BodyNode[] {
  const bodyMap = new Map<string, BodyNode>();

  for (const body of bodies) {
    const bodyOffices = allOffices
      .filter((o) => o.bodyId === body.id)
      .map((o) => {
        const holder = currentTerms.find(
          (t) => t.term.officeId === o.id && !isQid(t.person.name)
        );
        return { ...o, holder: holder ?? null, children: [] as OfficeNode[] };
      });

    const officeMap = new Map<string, OfficeNode>();
    for (const o of bodyOffices) officeMap.set(o.id, o);

    const rootOffices: OfficeNode[] = [];
    for (const o of bodyOffices) {
      if (o.reportsToOfficeId && officeMap.has(o.reportsToOfficeId)) {
        officeMap.get(o.reportsToOfficeId)!.children.push(o);
      } else {
        rootOffices.push(o);
      }
    }

    bodyMap.set(body.id, {
      body,
      offices: rootOffices,
      children: [],
      parties: parties.filter((p) => p.bodyId === body.id),
    });
  }

  const roots: BodyNode[] = [];
  for (const node of bodyMap.values()) {
    if (node.body.parentBodyId && bodyMap.has(node.body.parentBodyId)) {
      bodyMap.get(node.body.parentBodyId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function HoverCard({
  office,
  branchColor,
  anchorRef,
}: {
  office: OfficeNode;
  branchColor: string;
  anchorRef: HTMLElement | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!anchorRef || !cardRef.current) return;
    const rect = anchorRef.getBoundingClientRect();
    const card = cardRef.current.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left;
    if (left + card.width > window.innerWidth - 8) left = window.innerWidth - card.width - 8;
    if (left < 8) left = 8;
    if (top + card.height > window.innerHeight - 8) top = rect.top - card.height - 6;
    setPos({ top, left });
  }, [anchorRef]);

  const holder = office.holder;
  const initials = holder
    ? holder.person.name
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
    : "";

  return (
    <div
      ref={cardRef}
      className="ghc-hover-card"
      role="tooltip"
      style={{
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        opacity: pos ? 1 : 0,
        borderTopColor: branchColor,
      }}
    >
      {holder && (
        <div className="ghc-hover-head">
          <div className="ghc-hover-avatar">{initials}</div>
          <div>
            <div className="ghc-hover-name">{holder.person.name}</div>
            <div className="ghc-hover-role">{office.name}</div>
          </div>
        </div>
      )}
      {!holder && <div className="ghc-hover-name" style={{ marginBottom: 8 }}>{office.name}</div>}
      <dl className="ghc-hover-facts">
        {holder?.term.partyName && (
          <>
            <dt>Party</dt>
            <dd>
              {holder.term.partyColor && (
                <span className="ghc-party-dot" style={{ background: holder.term.partyColor }} />
              )}
              {holder.term.partyName}
            </dd>
          </>
        )}
        {holder?.term.startDate && (
          <>
            <dt>Term</dt>
            <dd>
              {holder.term.startDate}
              {holder.term.endDate ? ` — ${holder.term.endDate}` : " — present"}
            </dd>
          </>
        )}
        {holder?.person.wikidataQid && (
          <>
            <dt>Source</dt>
            <dd>Wikidata · {holder.person.wikidataQid}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function PartyBar({ parties, totalSeats }: { parties: PartyData[]; totalSeats: number }) {
  if (parties.length === 0 || totalSeats === 0) return null;
  const total = totalSeats || parties.reduce((s, p) => s + p.seatCount, 0);
  const ruling = parties.filter((p) => p.isRulingCoalition);
  const opposition = parties.filter((p) => !p.isRulingCoalition);
  const rulingSeats = ruling.reduce((s, p) => s + p.seatCount, 0);
  const oppositionSeats = opposition.reduce((s, p) => s + p.seatCount, 0);
  const majority = Math.floor(total / 2) + 1;

  return (
    <>
      <div className="ghc-party-bar">
        {parties.map((p, i) => (
          <span
            key={i}
            title={`${p.partyName}: ${p.seatCount} seats`}
            style={{
              width: `${(p.seatCount / total) * 100}%`,
              background: p.partyColor ?? "var(--color-text-30)",
            }}
          />
        ))}
      </div>
      <div className="ghc-chamber-meta">
        {rulingSeats > 0 && (
          <>
            <strong>{rulingSeats >= majority ? "Majority" : "Largest"}</strong>
            <span>
              {ruling[0]?.partyName} ({rulingSeats})
            </span>
          </>
        )}
        {oppositionSeats > 0 && (
          <>
            <strong>{rulingSeats > 0 ? "Minority" : "Opposition"}</strong>
            <span>
              {opposition[0]?.partyName} ({oppositionSeats})
            </span>
          </>
        )}
      </div>
    </>
  );
}

function OfficeNodeItem({
  office,
  branchColor,
  depth,
}: {
  office: OfficeNode;
  branchColor: string;
  depth: number;
}) {
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);
  const hasChildren = office.children.length > 0;
  const [expanded, setExpanded] = useState(depth < 2);
  const hasHolder = !!office.holder;

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      className={!expanded && hasChildren ? "collapsed" : undefined}
    >
      <div
        className={`ghc-node${hasHolder ? " has-holder" : ""}`}
        tabIndex={0}
        onMouseEnter={(e) => setHoverAnchor(e.currentTarget as HTMLElement)}
        onMouseLeave={() => setHoverAnchor(null)}
        onFocus={(e) => setHoverAnchor(e.currentTarget as HTMLElement)}
        onBlur={() => setHoverAnchor(null)}
      >
        <div className="ghc-node-accent" style={{ background: branchColor }} />
        <div className="ghc-node-main">
          <div className="ghc-node-office">{office.name}</div>
          {office.holder && (
            <div className="ghc-node-holder">
              {office.holder.person.name}
              {office.holder.term.partyName && (
                <span className="ghc-node-party" style={{ color: office.holder.term.partyColor ?? "var(--color-text-30)" }}>
                  <span className="ghc-party-dot" />
                  {office.holder.term.partyName}
                </span>
              )}
            </div>
          )}
        </div>
        <button
          className={`ghc-node-toggle${!hasChildren ? " is-empty" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) setExpanded(!expanded);
          }}
          aria-label={expanded ? "Collapse" : "Expand"}
          tabIndex={-1}
        >
          ▾
        </button>
      </div>

      {hoverAnchor && (
        <HoverCard office={office} branchColor={branchColor} anchorRef={hoverAnchor} />
      )}

      {hasChildren && expanded && (
        <ul role="group">
          {office.children.map((child) => (
            <OfficeNodeItem
              key={child.id}
              office={child}
              branchColor={branchColor}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function BodyNodeItem({
  node,
  branchColor,
  depth,
}: {
  node: BodyNode;
  branchColor: string;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const hasContent = node.offices.length > 0 || node.children.length > 0;
  const isChamber = node.body.chamberType || (node.body.totalSeats && node.body.totalSeats > 0);

  return (
    <li
      role="treeitem"
      aria-expanded={hasContent ? expanded : undefined}
      className={!expanded && hasContent ? "collapsed" : undefined}
    >
      <div className={`ghc-node${isChamber ? " chamber" : ""}`}>
        <div className="ghc-node-accent" style={{ background: branchColor }} />
        <div className="ghc-node-main">
          <div className="ghc-node-office">{node.body.name}</div>
          {isChamber ? (
            <>
              <div className="ghc-node-holder">
                {node.body.chamberType === "upper" ? "Upper" : node.body.chamberType === "lower" ? "Lower" : ""} chamber · {node.body.totalSeats} seats
              </div>
              {expanded && node.parties.length > 0 && (
                <PartyBar parties={node.parties} totalSeats={node.body.totalSeats ?? 0} />
              )}
            </>
          ) : (
            <div className="ghc-node-holder" style={{ fontSize: 13, color: "var(--color-text-40)" }}>
              {node.body.bodyType}
            </div>
          )}
        </div>
        <button
          className={`ghc-node-toggle${!hasContent ? " is-empty" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasContent) setExpanded(!expanded);
          }}
          aria-label={expanded ? "Collapse" : "Expand"}
          tabIndex={-1}
        >
          ▾
        </button>
      </div>

      {expanded && hasContent && (
        <ul role="group">
          {node.offices.map((office) => (
            <OfficeNodeItem
              key={office.id}
              office={office}
              branchColor={branchColor}
              depth={depth + 1}
            />
          ))}
          {node.children.map((child) => (
            <BodyNodeItem
              key={child.body.id}
              node={child}
              branchColor={branchColor}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function countOffices(tree: BodyNode[]): number {
  let count = 0;
  for (const node of tree) {
    count += node.offices.length;
    for (const o of node.offices) count += countOfficeChildren(o);
    count += countOffices(node.children);
  }
  return count;
}

function countOfficeChildren(office: OfficeNode): number {
  let count = office.children.length;
  for (const c of office.children) count += countOfficeChildren(c);
  return count;
}

export function GovStructureDiagram({
  bodies,
  offices,
  currentTerms,
  countryName,
  parties = [],
}: {
  bodies: GovBody[];
  offices: GovOffice[];
  currentTerms: GovTerm[];
  countryName: string;
  parties?: PartyData[];
}) {
  const isQid = (name: string) => /^Q\d+$/.test(name);

  const allBranches = BRANCH_ORDER.filter((branch) =>
    bodies.some((b) => b.branch === branch)
  );
  const otherBranch = bodies.filter(
    (b) => b.branch && !BRANCH_ORDER.includes(b.branch)
  );
  if (otherBranch.length > 0) allBranches.push("other");

  const branchTrees = allBranches
    .map((branch) => {
      const branchBodies = bodies.filter(
        (b) =>
          branch === "other"
            ? b.branch && !BRANCH_ORDER.includes(b.branch)
            : b.branch === branch
      );
      const tree = buildBodyTree(branchBodies, offices, currentTerms, parties, isQid);
      if (tree.length === 0) return null;

      const officeCount = countOffices(tree);
      const totalSeats = branchBodies.reduce((s, b) => s + (b.totalSeats ?? 0), 0);
      let subtitle = `${officeCount} office${officeCount !== 1 ? "s" : ""}`;
      if (branch === "legislative" && totalSeats > 0) {
        const chambers = branchBodies.filter((b) => b.chamberType);
        subtitle = `${chambers.length > 1 ? "Bicameral" : "Unicameral"} · ${totalSeats} seats`;
      }

      return {
        branch,
        color: BRANCH_COLORS[branch] ?? "var(--color-text-40)",
        label: BRANCH_LABELS[branch] ?? branch,
        subtitle,
        tree,
      };
    })
    .filter(Boolean) as Array<{
    branch: string;
    color: string;
    label: string;
    subtitle: string;
    tree: BodyNode[];
  }>;

  if (branchTrees.length === 0) return null;

  const expandAllRef = useRef<(() => void) | null>(null);
  const [expandKey, setExpandKey] = useState(0);
  const [collapseKey, setCollapseKey] = useState(0);

  return (
    <div className="ghc-root" role="tree" aria-label={`Government structure of ${countryName}`}>
      <div className="ghc-toolbar">
        <span>Full government structure</span>
        <div className="ghc-toolbar-controls">
          <button className="ghc-ctrl" onClick={() => setExpandKey((k) => k + 1)}>Expand all</button>
          <button className="ghc-ctrl" onClick={() => setCollapseKey((k) => k + 1)}>Collapse all</button>
        </div>
      </div>

      <div className="ghc-canvas">
        <div
          className="ghc-branches"
          style={{ "--ghc-cols": branchTrees.length } as React.CSSProperties}
        >
          {branchTrees.map(({ branch, color, label, subtitle, tree }) => (
            <div key={branch} className="ghc-branch" data-branch={branch}>
              <div className="ghc-branch-head">
                <div className="ghc-branch-title">{label}</div>
                <div className="ghc-branch-count">{subtitle}</div>
              </div>
              <div className="ghc-branch-body ghc-tree">
                <ul role="group">
                  {tree.length === 1 && tree[0].offices.length > 0 ? (
                    <>
                      {tree[0].offices.map((office) => (
                        <OfficeNodeItem
                          key={office.id}
                          office={office}
                          branchColor={color}
                          depth={0}
                        />
                      ))}
                      {tree[0].children.map((child) => (
                        <BodyNodeItem
                          key={child.body.id}
                          node={child}
                          branchColor={color}
                          depth={0}
                        />
                      ))}
                    </>
                  ) : (
                    tree.map((node) => (
                      <BodyNodeItem
                        key={node.body.id}
                        node={node}
                        branchColor={color}
                        depth={0}
                      />
                    ))
                  )}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ghc-legend">
        {branchTrees.map(({ branch, color, label }) => (
          <div key={branch} className="ghc-legend-item">
            <span className="ghc-legend-swatch" style={{ background: color }} />
            {label}
          </div>
        ))}
        <div className="ghc-legend-item">· Hover a node for details · Click ▾ to collapse</div>
      </div>
    </div>
  );
}
