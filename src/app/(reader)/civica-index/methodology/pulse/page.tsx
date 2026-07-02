import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { Reveal } from "@/components/motion/Reveal";
import { pulse, disputeSla } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Pulse methodology (Beta) — Civica Index",
  description:
    "How the Civica Pulse Beta detects, classifies, and scores governance events between quarterly index updates. Source taxonomy, classify-and-verify confidence, asymmetric scoring, decay model, and known limitations.",
  alternates: {
    canonical: "https://civicaatlas.org/civica-index/methodology/pulse",
  },
};

const SECTIONS = [
  { id: "what-pulse-is", label: "What the Pulse is" },
  { id: "what-pulse-is-not", label: "What the Pulse is not" },
  { id: "sources", label: "Sources" },
  { id: "daily-pipeline", label: "Daily pipeline" },
  { id: "event-categories", label: "Event categories" },
  { id: "disambiguation", label: "Disambiguation" },
  { id: "cascade-model", label: "Cascade model" },
  { id: "classification-confidence", label: "Classification confidence" },
  { id: "asymmetric-scoring", label: "Asymmetric scoring" },
  { id: "press-freedom-rule", label: "Press-freedom rule" },
  { id: "decay", label: "Decay" },
  { id: "bounds", label: "Bounds" },
  { id: "coverage-limitations", label: "Coverage limitations" },
  { id: "known-limitations", label: "Known limitations" },
  { id: "corrections", label: "Corrections" },
  { id: "cite", label: "Cite this page" },
];

export default function PulseMethodologyPage() {
  const taxonomy = pulse.taxonomy;
  const backtestCount = pulse.backtest.cases.length;
  const graduationRatio = pulse.backtest.graduationThresholdRatio;
  const graduationPct = Math.round(graduationRatio * 100);
  const graduationCount = Math.ceil(backtestCount * graduationRatio);

  // Pre-computed helpers materialised at the call site (Phase 5
  // §3.2). Keys must match the validator's per-file allowlist in
  // scripts/validate-content-templates.ts.
  const ctx = {
    graduationPct,
    graduationCount,
  };

  const state = { pulse, disputeSla };

  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
        <SmartBreadcrumbs />

        <h1 className="editorial-page-title">
          Pulse methodology
          {pulse.status === "beta" ? (
            <span className="editorial-beta-tag">Beta</span>
          ) : null}
        </h1>
        <p className="editorial-page-subtitle">
          An event-sensitive governance shock monitor layered on top of the
          quarterly Civica Index. It refreshes on a daily cadence; because it
          runs as a scheduled job, published values reflect the most recent
          completed run rather than a live feed. Beta — methodology under active
          validation.
        </p>

        <div className="editorial-warning">
          <strong>This is an experimental system.</strong> Pulse values are not
          yet peer-reviewed and should not be cited as authoritative. The
          pipeline is under active validation; backtesting against historical
          governance shocks is in progress, with at least {graduationPct}% (
          {graduationCount} of {backtestCount}) of the named test cases
          required to match expert consensus before the Pulse graduates to
          publishable status.
        </div>

        {/* Markdown body — content/methodology-pulse.md is the prose
            source of truth for sections 1–15. Wrapped in
            .editorial-section so descendant h2/p/ul/table inherit
            editorial.css typography. Per content-templating audit
            v1.0 §3.5. */}
        <Reveal as="section" className="editorial-section" amount={0.15}>
          <MarkdownContent
            file="content/methodology-pulse.md"
            stats={null}
            state={state as unknown as Record<string, unknown>}
            ctx={ctx}
          />
        </Reveal>

        <Reveal as="section" className="editorial-section" id="cite" amount={0.15}>
          <h2>Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — Pulse methodology (Beta)"
            pageTitle="Pulse methodology"
            url="https://civicaatlas.org/civica-index/methodology/pulse"
            dataVintage={
              pulse.taxonomy.versionHistory.find(
                (v) => v.version === pulse.taxonomy.version,
              )?.ranAt
            }
          />
        </Reveal>

        <nav className="editorial-footer-nav" aria-label="Methodology navigation">
          <Link href="/civica-index/methodology">← Civica Index methodology</Link>
          <Link href="/civica-index/methodology/pulse/backtest">Backtest report →</Link>
          <Link href="/civica-index/pulse-changelog">Pulse changelog</Link>
          <Link href="/civica-index/corrections">Corrections form</Link>
        </nav>
      </EditorialPage>
    </MethodologyLayout>
  );
}
