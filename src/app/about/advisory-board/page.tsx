import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { advisoryBoardMembers } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { Banner } from "@/components/editorial/Banner";
import { advisoryBoard, civicaIndex } from "@/lib/content/site-state";

const ADVISORY_BOARD_STATUS_LABEL: Record<string, string> = {
  "coming-soon": "Coming soon",
  recruiting: "Recruiting",
  active: "Active",
};

export const metadata: Metadata = {
  title: "Advisory board — Civica Index",
  description: `Independent academic review for the Civica Index methodology. ${advisoryBoard.targetSize.min}–${advisoryBoard.targetSize.max} scholars in governance measurement, political methodology, and comparative politics.`,
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
    <EditorialPage>
      <nav className="editorial-breadcrumbs">
        <Link href="/about">← About</Link>
        <span>/</span>
        Advisory board
      </nav>

      <header>
        <h1 className="editorial-page-title">
          Advisory board
          <span className="editorial-beta-tag">
            {ADVISORY_BOARD_STATUS_LABEL[advisoryBoard.status] ?? advisoryBoard.status}
          </span>
        </h1>
        <p className="editorial-page-subtitle">
          Independent review for the Civica Index methodology.
        </p>
      </header>

      <p style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-14)", lineHeight: 1.7, color: "var(--color-text-60)", margin: "0 0 32px", maxWidth: "640px" }}>
        Per the v2 methodology specification, the Civica Index will be reviewed
        by an independent academic advisory board of{" "}
        {advisoryBoard.targetSize.min}–{advisoryBoard.targetSize.max} scholars
        with expertise in governance measurement, political methodology, or
        comparative politics. The board reviews the methodology{" "}
        {advisoryBoard.reviewCadence} and has named authority to request
        changes. Their role is credibility infrastructure, not marketing.
      </p>

      <Banner variant="warn">
        <div style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "12px 18px", fontFamily: "var(--font-mono)", fontSize: "var(--text-12)", fontWeight: "var(--font-weight-mono, 500)", letterSpacing: "0.04em" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--color-status-warning)", flexShrink: 0, display: "inline-block" }} />
          {ADVISORY_BOARD_STATUS_LABEL[advisoryBoard.status] ?? advisoryBoard.status}{" "}
          — recruitment opens {advisoryBoard.recruitmentTrigger} (target{" "}
          {civicaIndex.cutoverTarget})
        </div>
      </Banner>

      <section className="editorial-section" style={{ marginTop: "48px" }}>
        <h2>Board criteria</h2>
        <p>
          <strong>Per methodology spec §3.1:</strong>
        </p>
        <ul>
          <li>Recognized scholars in governance measurement, political methodology, or comparative politics.</li>
          <li>At least one member with direct experience on an established governance index (V-Dem associate, Freedom House methodologist, or similar).</li>
          <li>Geographic and disciplinary diversity across the full board.</li>
          <li>Public listing on this page with affiliations and areas of expertise.</li>
        </ul>
      </section>

      {/* Members list */}
      <section className="editorial-section">
        {members.length === 0 ? (
          <p style={{ color: "var(--color-text-40)", paddingTop: "32px", paddingBottom: "32px", borderTop: "1px solid var(--color-card-border)", borderBottom: "1px solid var(--color-card-border)" }}>
            Members to be announced.
          </p>
        ) : (
          members.map((m) => (
            <div key={m.id} style={{ borderTop: "1px solid var(--color-card-border)", padding: "24px 0" }}>
              <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "var(--text-22)", fontWeight: 400, letterSpacing: "-0.01em", color: "var(--color-text-primary)", margin: "0 0 4px" }}>{m.name}</h2>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-11)", fontWeight: "var(--font-weight-mono, 500)", letterSpacing: "0.04em", color: "var(--color-text-40)", margin: "0 0 10px" }}>{m.affiliation}</div>
              <div style={{ fontFamily: "var(--font-body)", fontSize: "var(--text-14)", lineHeight: 1.6, color: "var(--color-text-60)" }}>{m.expertise}</div>
            </div>
          ))
        )}
      </section>

      <hr style={{ border: "none", borderTop: "1px solid var(--color-card-border)", margin: "40px 0" }} />

      <footer className="editorial-footer-nav">
        <Link href="/civica-index/methodology">← Civica Index methodology</Link>
      </footer>
    </EditorialPage>
  );
}
