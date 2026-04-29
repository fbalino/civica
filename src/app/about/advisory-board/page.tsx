import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { advisoryBoardMembers } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Advisory board — Civica Index",
  description:
    "Independent academic review for the Civica Index methodology. 3–5 scholars in governance measurement, political methodology, and comparative politics.",
  alternates: { canonical: "https://civicaatlas.org/about/advisory-board" },
};

interface Member {
  id: string;
  name: string;
  affiliation: string;
  expertise: string;
  bioMd: string | null;
  photoUrl: string | null;
  displayOrder: number;
}

export default async function AdvisoryBoardPage() {
  let members: Member[] = [];
  try {
    members = await db
      .select()
      .from(advisoryBoardMembers)
      .where(eq(advisoryBoardMembers.isActive, true))
      .orderBy(asc(advisoryBoardMembers.displayOrder), asc(advisoryBoardMembers.name));
  } catch {
    // DB unavailable
  }

  return (
    <div className="ab-layout">
      <style>{`
        .ab-layout {
          max-width: 760px;
          margin: 0 auto;
          padding: 60px 24px 80px;
        }
        .ab-breadcrumb {
          font-family: var(--font-mono);
          font-weight: var(--font-weight-mono, 500);
          font-size: 12px;
          letter-spacing: 0.03em;
          color: var(--color-text-30);
          margin-bottom: 16px;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .ab-breadcrumb a {
          color: var(--color-text-30);
          text-decoration: none;
        }
        .ab-breadcrumb a:hover { color: var(--color-text-primary); }

        .ab-eyebrow {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
        }
        .ab-beta-pill {
          font-family: var(--font-mono);
          font-size: 10px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #7a5c00;
          background: color-mix(in oklch, var(--color-warn) 18%, var(--color-page-bg) 82%);
          border: 1px solid var(--color-warn);
          border-radius: 3px;
          padding: 2px 7px;
          white-space: nowrap;
        }

        .ab-title {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 48px;
          font-weight: 400;
          letter-spacing: -0.04em;
          line-height: 1.02;
          margin: 0 0 12px;
          color: var(--color-text-primary);
        }
        .ab-subtitle {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 20px;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: var(--color-text-60);
          margin: 0 0 32px;
          line-height: 1.4;
        }
        .ab-lede {
          font-family: var(--font-sans);
          font-size: 15px;
          line-height: 1.7;
          color: var(--color-text-60);
          margin: 0 0 32px;
          max-width: 640px;
        }

        .ab-status-box {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: color-mix(in oklch, var(--color-warn) 10%, var(--color-page-bg) 90%);
          border: 1px solid var(--color-warn);
          border-radius: 4px;
          padding: 12px 18px;
          margin-bottom: 48px;
          font-family: var(--font-mono);
          font-size: 12px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.04em;
          color: var(--color-text-primary);
        }
        .ab-status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--color-warn);
          flex-shrink: 0;
        }

        .ab-role-explainer {
          background: var(--color-grid-cell);
          border: 1px solid var(--color-card-border);
          border-left: 4px solid var(--color-accent);
          border-radius: 4px;
          padding: 20px 24px;
          margin-bottom: 40px;
          font-family: var(--font-sans);
          font-size: 14px;
          line-height: 1.65;
          color: var(--color-text-60);
        }
        .ab-role-explainer strong { color: var(--color-text-primary); font-weight: 500; }
        .ab-role-explainer ul { margin: 10px 0 0 20px; padding: 0; }
        .ab-role-explainer li { margin-bottom: 6px; }

        .ab-members-empty {
          font-family: var(--font-sans);
          font-size: 14px;
          color: var(--color-text-40);
          padding: 32px 0;
          border-top: 1px solid var(--color-card-border);
          border-bottom: 1px solid var(--color-card-border);
        }

        .ab-member-row {
          border-top: 1px solid var(--color-card-border);
          padding: 24px 0;
        }
        .ab-member-row:last-child { border-bottom: 1px solid var(--color-card-border); }
        .ab-member-name {
          font-family: var(--font-heading, var(--font-serif));
          font-size: 22px;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: var(--color-text-primary);
          margin: 0 0 4px;
        }
        .ab-member-affiliation {
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: var(--font-weight-mono, 500);
          letter-spacing: 0.04em;
          color: var(--color-text-40);
          margin: 0 0 10px;
        }
        .ab-member-expertise {
          font-family: var(--font-sans);
          font-size: 14px;
          line-height: 1.6;
          color: var(--color-text-60);
        }

        .ab-divider {
          border: none;
          border-top: 1px solid var(--color-card-border);
          margin: 40px 0;
        }
        .ab-footer-links {
          font-family: var(--font-sans);
          font-size: 14px;
          color: var(--color-text-60);
        }
        .ab-footer-links a {
          color: var(--color-accent);
          text-decoration: none;
        }
        .ab-footer-links a:hover { text-decoration: underline; }

        @media (max-width: 480px) {
          .ab-title { font-size: 36px; }
        }
      `}</style>

      <nav className="ab-breadcrumb">
        <Link href="/about">← About</Link>
        <span>/</span>
        Advisory board
      </nav>

      <div className="ab-eyebrow">
        <span className="ab-beta-pill">Coming soon</span>
      </div>

      <h1 className="ab-title">Advisory board.</h1>
      <p className="ab-subtitle">
        Independent review for the Civica Index methodology.
      </p>

      <p className="ab-lede">
        Per the v2 methodology specification, the Civica Index will be reviewed
        by an independent academic advisory board of 3–5 scholars with
        expertise in governance measurement, political methodology, or
        comparative politics. The board reviews the methodology quarterly
        and has named authority to request changes. Their role is credibility
        infrastructure, not marketing.
      </p>

      <div className="ab-status-box">
        <span className="ab-status-dot" />
        Coming soon — recruitment opens after methodology v2 cut-over (target Q3 2026)
      </div>

      <div className="ab-role-explainer">
        <strong>Board criteria (per methodology spec §3.1):</strong>
        <ul>
          <li>Recognized scholars in governance measurement, political methodology, or comparative politics.</li>
          <li>At least one member with direct experience on an established governance index (V-Dem associate, Freedom House methodologist, or similar).</li>
          <li>Geographic and disciplinary diversity across the full board.</li>
          <li>Public listing on this page with affiliations and areas of expertise.</li>
        </ul>
      </div>

      {/* Members list */}
      {members.length === 0 ? (
        <div className="ab-members-empty">Members to be announced.</div>
      ) : (
        members.map((m) => (
          <div key={m.id} className="ab-member-row">
            <h2 className="ab-member-name">{m.name}</h2>
            <div className="ab-member-affiliation">{m.affiliation}</div>
            <div className="ab-member-expertise">{m.expertise}</div>
          </div>
        ))
      )}

      <hr className="ab-divider" />

      <div className="ab-footer-links">
        <Link href="/civica-index/methodology">← Civica Index methodology</Link>
      </div>
    </div>
  );
}
