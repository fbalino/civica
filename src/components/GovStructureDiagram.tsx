"use client";

import { useState, useRef, useEffect, useCallback } from "react";

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
    let left = rect.left + rect.width / 2 - card.width / 2;
    if (left < 8) left = 8;
    if (left + card.width > window.innerWidth - 8) left = window.innerWidth - card.width - 8;
    if (top + card.height > window.innerHeight - 8) top = rect.top - card.height - 6;
    setPos({ top, left });
  }, [anchorRef]);

  const holder = office.holder;

  return (
    <div
      ref={cardRef}
      role="tooltip"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        zIndex: 1000,
        background: "var(--color-card-bg)",
        border: `1px solid var(--color-card-border)`,
        borderTop: `2px solid ${branchColor}`,
        padding: "14px 16px",
        minWidth: 220,
        maxWidth: 320,
        boxShadow: "var(--shadow-dropdown)",
        opacity: pos ? 1 : 0,
        transition: "opacity 0.12s",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-10)",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: branchColor,
          marginBottom: 6,
        }}
      >
        {office.officeType.replace(/_/g, " ")}
      </div>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-16)",
          color: "var(--color-text-primary)",
          marginBottom: holder ? 8 : 0,
        }}
      >
        {office.name}
      </div>
      {holder && (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {holder.person.photoUrl && (
            <img
              src={holder.person.photoUrl}
              alt=""
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                objectFit: "cover",
                border: `2px solid ${branchColor}33`,
                flexShrink: 0,
              }}
            />
          )}
          <div>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "var(--text-14)",
                color: "var(--color-text-85)",
              }}
            >
              {holder.person.name}
            </div>
            {holder.term.partyName && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-11)",
                  color: "var(--color-text-40)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 2,
                }}
              >
                {holder.term.partyColor && (
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: holder.term.partyColor,
                      flexShrink: 0,
                    }}
                  />
                )}
                {holder.term.partyName}
              </div>
            )}
            {holder.term.startDate && (
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-10)",
                  color: "var(--color-text-25)",
                  marginTop: 2,
                }}
              >
                {holder.term.startDate}
                {holder.term.endDate ? ` – ${holder.term.endDate}` : " – present"}
              </div>
            )}
          </div>
        </div>
      )}
      {holder?.person.wikidataQid && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-10)",
            color: "var(--color-text-20)",
            marginTop: 8,
            borderTop: "1px solid var(--color-card-border)",
            paddingTop: 6,
          }}
        >
          Source: Wikidata {holder.person.wikidataQid}
        </div>
      )}
    </div>
  );
}

function PartyBar({ parties, totalSeats }: { parties: PartyData[]; totalSeats: number }) {
  if (parties.length === 0 || totalSeats === 0) return null;
  const total = totalSeats || parties.reduce((s, p) => s + p.seatCount, 0);
  const majority = Math.floor(total / 2) + 1;
  const rulingSeats = parties.filter((p) => p.isRulingCoalition).reduce((s, p) => s + p.seatCount, 0);

  return (
    <div style={{ marginTop: 6 }}>
      <div
        style={{
          display: "flex",
          height: 6,
          borderRadius: 3,
          overflow: "hidden",
          background: "var(--color-text-20)",
        }}
      >
        {parties.map((p, i) => (
          <div
            key={i}
            title={`${p.partyName}: ${p.seatCount} seats`}
            style={{
              width: `${(p.seatCount / total) * 100}%`,
              background: p.partyColor ?? "var(--color-text-30)",
              minWidth: 1,
            }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-10)",
          color: "var(--color-text-30)",
          marginTop: 3,
        }}
      >
        <span>{total} seats</span>
        {rulingSeats > 0 && (
          <span>
            {rulingSeats >= majority ? "majority" : "minority"} · {rulingSeats}/{total}
          </span>
        )}
      </div>
    </div>
  );
}

function OfficeNodeItem({
  office,
  branchColor,
  depth,
  isLast,
}: {
  office: OfficeNode;
  branchColor: string;
  depth: number;
  isLast: boolean;
}) {
  const [hoverAnchor, setHoverAnchor] = useState<HTMLElement | null>(null);
  const nodeRef = useRef<HTMLLIElement>(null);
  const hasChildren = office.children.length > 0;
  const [expanded, setExpanded] = useState(depth < 2);

  return (
    <li
      ref={nodeRef}
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      className="gov-tree-node"
      style={{ "--branch-color": branchColor } as React.CSSProperties}
    >
      <div
        className="gov-tree-node-content"
        tabIndex={0}
        onMouseEnter={(e) => setHoverAnchor(e.currentTarget as HTMLElement)}
        onMouseLeave={() => setHoverAnchor(null)}
        onFocus={(e) => setHoverAnchor(e.currentTarget as HTMLElement)}
        onBlur={() => setHoverAnchor(null)}
        onClick={() => hasChildren && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (hasChildren) setExpanded(!expanded);
          }
        }}
        style={{ cursor: hasChildren ? "pointer" : "default" }}
      >
        {hasChildren && (
          <span className="gov-tree-toggle">{expanded ? "▾" : "▸"}</span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="gov-tree-office-label">{office.name}</div>
          {office.holder && (
            <div className="gov-tree-holder-name">
              {office.holder.person.photoUrl && (
                <img
                  src={office.holder.person.photoUrl}
                  alt=""
                  className="gov-tree-avatar"
                  style={{ borderColor: `${branchColor}33` }}
                />
              )}
              {office.holder.person.name}
              {office.holder.term.partyColor && (
                <span
                  className="gov-tree-party-dot"
                  style={{ background: office.holder.term.partyColor }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {hoverAnchor && (
        <HoverCard office={office} branchColor={branchColor} anchorRef={hoverAnchor} />
      )}

      {hasChildren && expanded && (
        <ul role="group" className="gov-tree-children">
          {office.children.map((child, i) => (
            <OfficeNodeItem
              key={child.id}
              office={child}
              branchColor={branchColor}
              depth={depth + 1}
              isLast={i === office.children.length - 1}
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
      className="gov-tree-body"
      style={{ "--branch-color": branchColor } as React.CSSProperties}
    >
      <div
        className="gov-tree-body-header"
        onClick={() => hasContent && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (hasContent) setExpanded(!expanded);
          }
        }}
        tabIndex={0}
        style={{ cursor: hasContent ? "pointer" : "default" }}
      >
        {hasContent && (
          <span className="gov-tree-toggle">{expanded ? "▾" : "▸"}</span>
        )}
        <span className="gov-tree-body-name">{node.body.name}</span>
        {node.body.totalSeats && node.body.totalSeats > 0 && (
          <span className="gov-tree-seat-badge">{node.body.totalSeats} seats</span>
        )}
      </div>

      {isChamber && expanded && node.parties.length > 0 && (
        <PartyBar parties={node.parties} totalSeats={node.body.totalSeats ?? 0} />
      )}

      {expanded && hasContent && (
        <ul role="group" className="gov-tree-children">
          {node.offices.map((office, i) => (
            <OfficeNodeItem
              key={office.id}
              office={office}
              branchColor={branchColor}
              depth={depth + 1}
              isLast={i === node.offices.length - 1 && node.children.length === 0}
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
        (b) => branch === "other"
          ? b.branch && !BRANCH_ORDER.includes(b.branch)
          : b.branch === branch
      );
      const tree = buildBodyTree(branchBodies, offices, currentTerms, parties, isQid);
      if (tree.length === 0) return null;

      return {
        branch,
        color: BRANCH_COLORS[branch] ?? "var(--color-text-40)",
        label: BRANCH_LABELS[branch] ?? branch,
        tree,
      };
    })
    .filter(Boolean) as Array<{
    branch: string;
    color: string;
    label: string;
    tree: BodyNode[];
  }>;

  if (branchTrees.length === 0) return null;

  return (
    <div
      className="gov-hierarchy-chart"
      role="tree"
      aria-label={`Government structure of ${countryName}`}
    >
      {branchTrees.map(({ branch, color, label, tree }) => (
        <div key={branch} className="gov-branch-column">
          <div className="gov-branch-header" style={{ borderTopColor: color }}>
            <div
              className="gov-branch-eyebrow"
              style={{ background: `color-mix(in srgb, ${color} 12%, transparent)` }}
            >
              <span style={{ color }}>{label}</span>
            </div>
          </div>

          <ul role="group" className="gov-tree-root">
            {tree.map((node) => (
              <BodyNodeItem
                key={node.body.id}
                node={node}
                branchColor={color}
                depth={0}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
