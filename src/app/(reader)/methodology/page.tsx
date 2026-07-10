import type { Metadata } from "next";
import Link from "next/link";
import { EditorialPage } from "@/components/editorial/EditorialPage";
import {
  ReaderSidebar,
  type ReaderSidebarItem,
} from "@/components/editorial/ReaderSidebar";
import { SmartBreadcrumbs } from "@/components/editorial/SmartBreadcrumbs";
import { CiteAccordion } from "@/components/cite/CiteAccordion";
import { MarkdownContent } from "@/components/content/MarkdownContent";
import { Reveal } from "@/components/motion/Reveal";
import { civicaIndex, pulse } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Methodology — How Civica Builds Its Data",
  description:
    "Index of Civica Atlas methodology documents covering reconciliation, composite scoring, event classification, peer grouping, current limitations, and review status.",
  alternates: { canonical: "https://civicaatlas.org/methodology" },
};

interface MethodologyEntry {
  href: string;
  title: string;
  blurb: string;
  beta?: boolean;
}

interface MethodologySection {
  id: string;
  heading: string;
  intro: string;
  entries: MethodologyEntry[];
}

const SECTIONS: MethodologySection[] = [
  {
    id: "start-here",
    heading: "Start here",
    intro:
      "If you're new to how Civica handles country data and want a plain-English walkthrough before the deep specifications, start here. Every methodology page below assumes the reader has read this one or its equivalent.",
    entries: [
      {
        href: "/methodology/approach",
        title: "How we approach data",
        blurb:
          "Plain-English walkthrough of multi-source reconciliation, what the resolver does, what you see on reader pages, and what 'BETA' means here.",
      },
    ],
  },
  {
    id: "reconciliation",
    heading: "Data reconciliation",
    intro:
      "How Civica integrates and reconciles data from multiple official and established publishers, what the resolver does when sources disagree, and what provenance signals mean on reader pages.",
    entries: [
      {
        href: "/country/methodology/reconciliation",
        title: "Reconciliation",
        blurb:
          "The full specification of how the resolver works. Source taxonomy, the canonical-fact layer, freshness rules, editorial assertions, the dispute system, forecast vs measurement, multi-canonical with scope predicate.",
        beta: true,
      },
    ],
  },
  {
    id: "scoring",
    heading: "Composite scoring — the Civica Index",
    intro:
      `The Civica Index is a secondary research-beta 0–100 composite across ${civicaIndex.dimensionCount} governance dimensions. It has not completed independent review; its construction, weights, and interpretation remain subject to validation.`,
    entries: [
      {
        href: "/civica-index/methodology",
        title: "Civica Index methodology",
        blurb:
          `The research-beta composite specification — ${civicaIndex.dimensionCount} governance dimensions, indicator basket, sources, frozen reference periods, weighting approach, and Monte Carlo input-variation ranges.`,
        beta: true,
      },
      {
        href: "/civica-index/methodology/pca-appendix",
        title: "PCA appendix",
        blurb:
          "The mathematical derivation of the Index weights from principal component analysis on the indicator basket.",
        beta: true,
      },
    ],
  },
  {
    id: "pulse",
    heading: "Experimental event classification — the Civica Pulse",
    intro:
      "The Pulse is an experimental event ledger with public experimental per-dimension effects and no merged score or ranking. Its pipeline is scheduled daily, but published values reflect stored results rather than a live or continuous governance measure.",
    entries: [
      {
        href: "/civica-index/methodology/pulse",
        title: "Pulse methodology",
        blurb:
          "The current runtime contract — operating feeds, classifier roles, review gates, heuristic weighting, decay, public outputs, and known limitations.",
        beta: true,
      },
      {
        href: "/civica-index/methodology/pulse/backtest",
        title: "Pulse backtest",
        blurb:
          `Archived smoke-test results for ${pulse.backtest.cases.length} hand-curated historical scenarios. The displayed run predates the current production ensemble and is not representative validation.`,
        beta: true,
      },
    ],
  },
  {
    id: "peer-grouping",
    heading: "Classification and peer grouping",
    intro:
      "Civica's approach to comparing countries is domain-specific: material outcomes use World Bank region × income, governance outcomes use V-Dem Regimes of the World, with Bjørnskov-Rode / CGV available as an alternate regime lens. Constitutional form is preserved as descriptive metadata, not as an analytical taxonomy.",
    entries: [
      {
        href: "/civica-index/methodology/peer-grouping",
        title: "Peer grouping",
        blurb:
          "The peer-lens architecture, why government type is not a peer-grouping primitive, how the n ≥ 8 minimum-n rule works, the documented fallback chain.",
      },
    ],
  },
  {
    id: "policies",
    heading: "Policies",
    intro:
      "One correction, retraction, versioning, and known-limitations policy governs every research artifact above.",
    entries: [
      {
        href: "/policies",
        title: "Policies",
        blurb:
          "Severity classes and response targets, how retraction differs from correction and supersession, version-increment rules, historical preservation, API/data correction behavior, and notification posture.",
      },
    ],
  },
  // Entry-less sections (BETA meaning, Not yet published) and the
  // Get-in-touch / page-lead prose moved to content/methodology-overview.md
  // and rendered via <MarkdownContent slice> below. The five sections
  // above keep their inline intros because each owns a list of entry
  // cards (rich React: link + beta pill + blurb) that don't translate
  // cleanly to markdown. Per content-templating audit v1.0 §3.2.
];

const SIDEBAR_ITEMS: ReaderSidebarItem[] = [
  { id: "start-here", label: "Start here" },
  { id: "reconciliation", label: "Reconciliation" },
  { id: "scoring", label: "Civica Index" },
  { id: "pulse", label: "Civica Pulse" },
  { id: "peer-grouping", label: "Peer grouping" },
  { id: "policies", label: "Policies" },
  { id: "beta-meaning", label: "BETA meaning" },
  { id: "not-yet-published", label: "Not yet published" },
  { id: "cite", label: "Cite this page" },
];

export default function MethodologyHubPage() {
  return (
    <EditorialPage className="methodology-layout">
      <ReaderSidebar items={SIDEBAR_ITEMS} className="methodology-sidebar" />

      <article className="methodology-content">
        <SmartBreadcrumbs />
        <h1 className="editorial-page-title">Methodology</h1>
        {/* PUBLIC_CLAIM: methodology.decision-coverage */}
        <p className="editorial-page-subtitle">
          Load-bearing research and reconciliation decisions are documented as
          versioned records alongside the implementation they describe. This
          page indexes the methodology documents currently published on the site.
        </p>

        {SECTIONS.map((section) => (
          <Reveal
            as="section"
            key={section.id}
            id={section.id}
            className="editorial-section"
            aria-labelledby={`${section.id}-heading`}
            amount={0.15}
          >
            <h2 id={`${section.id}-heading`}>{section.heading}</h2>
            <p>{section.intro}</p>
            {section.entries.length > 0 && (
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "var(--space-4) 0 0 0",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                {section.entries.map((entry) => (
                  <li key={entry.href}>
                    <Link
                      href={entry.href}
                      className="methodology-hub-entry"
                      style={{
                        display: "block",
                        padding: "var(--space-4) var(--space-5)",
                        border: "1px solid var(--color-border-default)",
                        borderRadius: "var(--radius-sm)",
                        textDecoration: "none",
                        color: "inherit",
                        transition: "border-color 0.15s ease",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: "var(--space-2)",
                          marginBottom: "var(--space-2)",
                          flexWrap: "wrap",
                        }}
                      >
                        <h3
                          style={{
                            fontFamily: "var(--font-heading)",
                            fontSize: "var(--text-20)",
                            fontWeight: 400,
                            margin: 0,
                            color: "var(--color-text-primary)",
                          }}
                        >
                          {entry.title}
                        </h3>
                        {entry.beta && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              fontFamily: "var(--font-body)",
                              fontSize: "var(--text-12)",
                              fontWeight: 500,
                              letterSpacing: 0,
                              textTransform: "none",
                              padding: "3px 9px",
                              background:
                                "color-mix(in oklab, var(--color-status-warning) 16%, var(--color-page-bg))",
                              border:
                                "1px solid color-mix(in oklab, var(--color-status-warning) 32%, transparent)",
                              color:
                                "color-mix(in oklab, var(--color-status-warning), black 32%)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            Beta
                          </span>
                        )}
                      </div>
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "var(--text-15)",
                          color: "var(--color-text-50)",
                          lineHeight: "var(--leading-normal)",
                          margin: 0,
                        }}
                      >
                        {entry.blurb}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Reveal>
        ))}

        {/* "BETA meaning" + "Not yet published" prose-only sections —
            sourced from content/methodology-overview.md per
            content-templating audit v1.0 §3.2. The markdown's per-
            section anchors ({#beta-meaning}, {#not-yet-published}) are
            mirrored in SIDEBAR_ITEMS so the left rail keeps working. */}
        <Reveal as="section" className="editorial-section" amount={0.15}>
          <MarkdownContent
            file="content/methodology-overview.md"
            stats={null}
            slice={{ from: "beta-meaning", to: "get-in-touch" }}
          />
        </Reveal>

        {/* Get in touch prose — markdown source of truth. The TSX
            shell keeps the per-section <section> wrapper for layout
            consistency with the rest of the methodology hub. */}
        <Reveal as="section" className="editorial-section" amount={0.15}>
          <MarkdownContent
            file="content/methodology-overview.md"
            stats={null}
            slice={{ from: "get-in-touch" }}
          />
        </Reveal>

        <Reveal
          as="section"
          id="cite"
          className="editorial-section"
          aria-labelledby="cite-heading"
          amount={0.15}
        >
          <h2 id="cite-heading">Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — Methodology hub"
            pageTitle="Methodology hub"
            url="https://civicaatlas.org/methodology"
            dataVintage={civicaIndex.lastRevisionIso}
          />
        </Reveal>
      </article>
    </EditorialPage>
  );
}
