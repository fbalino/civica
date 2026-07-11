import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import { MethodologyLayout } from "@/components/editorial/MethodologyLayout";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { BetaChip } from "@/components/editorial/BetaChip";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { Reveal } from "@/components/motion/Reveal";
import { pulse, disputeSla } from "@/lib/content/site-state";
import { CURRENT_PULSE_RUNTIME_METHOD } from "@/lib/pulse/v2/runtime-contract";
import { CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY } from "@/lib/pulse/v2/public-numeric-policy";
import { PULSE_EVENT_ONTOLOGY } from "@/lib/pulse/v2/event-ontology";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Civica Pulse Methodology — Experimental Event Ledger",
  // PUBLIC_CLAIM: metadata.pulse-methodology
  description:
    "How Civica's experimental, daily-scheduled Pulse ledger ingests, classifies, reviews, and scores governance-relevant events without claiming a live or continuous governance measure.",
  alternates: {
    canonical: "https://civicaatlas.org/civica-index/methodology/pulse",
  },
  other: {
    "civica:pulse-numeric-policy": CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.id,
    "civica:methodology-version":
      CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.methodVersion,
    "civica:numeric-standing":
      CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.publicStatus,
  },
};

const SECTIONS = [
  { id: "what-pulse-is", label: "What the Pulse is" },
  { id: "research-charter", label: "Research charter" },
  { id: "what-pulse-is-not", label: "What the Pulse is not" },
  { id: "sources", label: "Sources" },
  { id: "daily-pipeline", label: "Scheduled pipeline" },
  { id: "clustering-coverage", label: "Clustering coverage" },
  { id: "version-identity", label: "Version identity" },
  { id: "evidence-identity", label: "Evidence identity" },
  { id: "event-categories", label: "Event ontology" },
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

const SOURCE_LABELS: Record<string, string> = {
  amnesty: "Amnesty International",
  civicus_monitor: "CIVICUS Monitor",
  gdelt: "GDELT",
  hrw: "Human Rights Watch",
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Anthropic",
  deepseek: "DeepSeek",
  glm: "Zhipu GLM",
  openai: "OpenAI",
};

const REVIEW_TIER_LABELS: Record<string, string> = {
  high_pos: "high-positive classifications",
  severe_neg: "severe-negative classifications",
  catastrophic_neg: "catastrophic-negative classifications",
};

function proseList(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function engineProse(engine: { provider: string; model: string }): string {
  return `${PROVIDER_LABELS[engine.provider] ?? engine.provider} \`${engine.model}\``;
}

function cronTime(cron: string): string {
  const [minute, hour] = cron.split(/\s+/).map(Number);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export default function PulseMethodologyPage() {
  const method = CURRENT_PULSE_RUNTIME_METHOD;
  // Pre-computed helpers materialised at the call site (Phase 5
  // §3.2). Keys must match the validator's per-file allowlist in
  // scripts/validate-content-templates.ts.
  const ctx = {
    methodologyVersion: method.version,
    ontologyVersion: PULSE_EVENT_ONTOLOGY.id,
    ontologyCategoryCount: PULSE_EVENT_ONTOLOGY.categories.length,
    observedThrough: method.feeds.activeProduction.observedThrough,
    activeFeedsProse: proseList(
      method.feeds.activeProduction.sourceIds.map(
        (id) => SOURCE_LABELS[id] ?? id,
      ),
    ),
    classifyVotersProse: proseList(
      method.providers.classify.engines.map(engineProse),
    ),
    verifierProse: engineProse(method.providers.verify.engine),
    subjectAttributorProse: engineProse(method.providers.subject.engine),
    reviewTiersProse: proseList(
      method.publicationPolicy.reviewGates.absoluteSeverityTiers.map(
        (tier) => REVIEW_TIER_LABELS[tier] ?? tier,
      ),
    ),
    weakConfidenceThreshold:
      method.publicationPolicy.reviewGates.verifierObjectionWithWeakConsensus
        .selfConfidenceBelow,
    scheduleProse: proseList(
      method.cadence.stages.map((stage) => {
        const operation = stage.operations.join("/").replaceAll("_", " ");
        return `${operation} at ${cronTime(stage.cron)}`;
      }),
    ),
    clusterIdentityVersion: method.clustering.identityNormalization.version,
    clusterEmbeddingModel: method.clustering.semantic.model,
    clusterWindowHours: method.clustering.dateWindowHours,
    clusterSemanticThreshold: method.clustering.semantic.threshold,
    clusterLexicalThreshold: method.clustering.lexicalFallback.threshold,
    scoreWindowDays: method.numericDeltas.trailingWindowDays,
    deltaLowerBound: method.numericDeltas.boundsPerDimension.lower,
    deltaUpperBound: `+${method.numericDeltas.boundsPerDimension.upper}`,
  };

  const state = { pulse, disputeSla };

  return (
    <MethodologyLayout items={SECTIONS}>
      <EditorialPage>
        <SmartBreadcrumbs />

        <h1 className="editorial-page-title">
          Pulse methodology
          {pulse.status === "beta" ? <BetaChip inHeading /> : null}
        </h1>
        <p className="editorial-page-subtitle">
          An experimental ledger of governance-relevant events, model-assisted
          classifications, source links, and review state. API-only
          per-dimension effects use method{" "}
          <code>{CURRENT_PULSE_NUMERIC_PUBLICATION_POLICY.methodVersion}</code>{" "}
          and are published only as experimental heuristics. The pipeline is
          scheduled daily; published values reflect the most recent completed
          run rather than a live or continuous governance measure.
        </p>

        <div className="editorial-warning">
          <strong>This is an experimental system.</strong> Pulse classifications
          and numeric effects have not completed independent review and should
          not be treated as established measurements. The current production
          ensemble has not completed representative evaluation or independent
          review. The published historical smoke test predates the current
          classifier and is not a graduation result.
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

        <Reveal
          as="section"
          className="editorial-section"
          id="cite"
          amount={0.15}
        >
          <h2>Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — Pulse methodology (Beta)"
            pageTitle="Pulse methodology"
            url="https://civicaatlas.org/civica-index/methodology/pulse"
            dataVintage={method.feeds.activeProduction.observedThrough}
          />
        </Reveal>

        <nav
          className="editorial-footer-nav"
          aria-label="Methodology navigation"
        >
          <Link href="/civica-index/methodology">
            ← Civica Index methodology
          </Link>
          <Link href="/civica-index/methodology/pulse/backtest">
            Backtest report →
          </Link>
          <Link href="/civica-index/pulse-changelog">Pulse changelog</Link>
          <Link href="/civica-index/corrections">Corrections form</Link>
        </nav>
      </EditorialPage>
    </MethodologyLayout>
  );
}
