import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { advisoryBoardMembers } from "@/lib/db/schema";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { Banner } from "@/components/editorial/Banner";
import { Button } from "@/components/editorial/Button";
import { Chip } from "@/components/editorial/Pill";
import { advisoryBoard } from "@/lib/content/site-state";
import { ADVISORY_BOARD_CHARTER } from "@/lib/research/advisory-board-charter";

export const revalidate = 3600;

const STATUS_LABEL: Record<string, string> = {
  "coming-soon": "Planned — no members appointed",
  recruiting: "Recruiting",
  active: "Active",
};

export const metadata: Metadata = {
  title: "Advisory Board Charter and Recruitment",
  description:
    "The Civica Atlas advisory-board charter: remit, independence, workload, conflicts, compensation, publication terms, and current recruitment status.",
  alternates: { canonical: "https://civicaatlas.org/about/advisory-board" },
};

const SECTIONS = [
  { id: "purpose", label: "Purpose and expertise" },
  { id: "authority", label: "Advisory status" },
  { id: "terms", label: "Terms and workload" },
  { id: "conflicts", label: "Conflicts" },
  { id: "confidentiality", label: "Confidentiality" },
  { id: "compensation", label: "Compensation" },
  { id: "departure", label: "Resignation and removal" },
  { id: "publication", label: "Names and reviews" },
  { id: "roster", label: "Current roster" },
] as const;

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
    // The public charter remains readable when the roster database is unavailable.
  }

  const charter = ADVISORY_BOARD_CHARTER;
  const status = STATUS_LABEL[advisoryBoard.status] ?? advisoryBoard.status;

  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
        <SmartBreadcrumbs />

        <h1 className="editorial-page-title">Advisory board charter</h1>
        <p className="editorial-page-subtitle">
          Independent advice with a narrow remit, disclosed conflicts, and no implied endorsement.
        </p>
        <div className="editorial-page-meta">
          <Chip variant="sand">{status}</Chip>
          <span>{charter.schemaVersion}</span>
          <span>Effective {charter.effectiveOn}</span>
        </div>

        {/* PUBLIC_CLAIM: advisory.independent-review-plan */}
        <Banner variant="warn">
          <strong>{status}.</strong> An application or invitation is not membership. Recruitment does not mean a board exists, a review has occurred, or any scholar endorses Civica.
        </Banner>

        <section className="editorial-section" id="purpose">
          <h2>Purpose and expertise sought</h2>
          <p>{charter.purpose}</p>
          <ul>
            {charter.expertiseSought.map((expertise) => <li key={expertise}>{expertise}</li>)}
          </ul>
        </section>

        <section className="editorial-section" id="authority">
          <h2>Advisory, not an endorsement</h2>
          <p>
            The board gives advice and may recommend correction, redesign, suspension, or retirement. It has no publication veto and does not replace Fernando Baliño as the accountable decision-maker. Material disagreement and Civica&apos;s response remain in the review record when publication consent permits.
          </p>
          <p><strong>{charter.publication.nonEndorsement}</strong></p>
        </section>

        <section className="editorial-section" id="terms">
          <h2>Terms and workload</h2>
          <p>Appointments last {charter.appointment.termMonths} months. {charter.appointment.renewal}</p>
          <p>{charter.workload.expectedAnnualHours} {charter.workload.ordinaryWork}</p>
          <p>{charter.workload.extraReview}</p>
        </section>

        <section className="editorial-section" id="conflicts">
          <h2>Conflicts and independence</h2>
          <p>{charter.conflicts.disclosure}</p>
          <ul>{charter.conflicts.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
          <p>{charter.conflicts.sourceRule}</p>
        </section>

        <section className="editorial-section" id="confidentiality">
          <h2>Confidentiality and publication</h2>
          <p>{charter.confidentialityAndPublicity.default}</p>
          <p>{charter.confidentialityAndPublicity.confidential}</p>
          <p>{charter.confidentialityAndPublicity.publicity}</p>
        </section>

        <section className="editorial-section" id="compensation">
          <h2>Compensation</h2>
          <p>{charter.compensation.boardService}</p>
          <p>{charter.compensation.scopedReviews}</p>
          <p>{charter.compensation.independence}</p>
        </section>

        <section className="editorial-section" id="departure">
          <h2>Resignation and removal</h2>
          <p>{charter.resignationAndRemoval.resignation}</p>
          <p>Removal may follow:</p>
          <ul>{charter.resignationAndRemoval.removalGrounds.map((ground) => <li key={ground}>{ground}</li>)}</ul>
          <p>{charter.resignationAndRemoval.process}</p>
        </section>

        <section className="editorial-section" id="publication">
          <h2>Names, reviews, and responses</h2>
          <p>{charter.publication.names}</p>
          <p>{charter.publication.reviews}</p>
          <p>{charter.publication.authorResponse}</p>
        </section>

        <section className="editorial-section" id="roster">
          <h2>Current roster</h2>
          {members.length === 0 ? (
            <div className="editorial-empty">
              <p><strong>No members have been appointed.</strong></p>
              <p>Applications are expressions of interest and are not published.</p>
            </div>
          ) : (
            members.map((member) => (
              <article className="editorial-card" key={member.id}>
                <div className="editorial-card-head">
                  <h3 className="editorial-card-headline">{member.name}</h3>
                  <Chip variant="neutral">{member.affiliation}</Chip>
                </div>
                <p className="editorial-card-desc">{member.expertise}</p>
              </article>
            ))
          )}
        </section>

        <section className="editorial-section">
          <h2>Apply</h2>
          <p>{charter.appointment.selection}</p>
          <Button href="/about/advisory-board/apply" variant="primary" arrow>Submit an expression of interest</Button>
        </section>

        <footer className="editorial-footer-nav">
          <Link href="/about">← About Civica Atlas</Link>
          <Link href="/policies">Research publication policies →</Link>
        </footer>
      </EditorialPage>
    </MethodologyLayout>
  );
}
