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
import { civicaIndex, pulse } from "@/lib/content/site-state";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Methodology — Civica Atlas",
  description:
    "Index of Civica Atlas methodology documents. Reconciliation, composite scoring, event classification, peer grouping, and the academic disciplines behind every Civica methodology decision.",
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
      "How Civica integrates and reconciles data from multiple authoritative publishers, what the resolver does when sources disagree, and what provenance signals mean on reader pages.",
    entries: [
      {
        href: "/factbook/methodology/reconciliation",
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
      `The Civica Index is an original 0–100 composite governance score covering ${civicaIndex.dimensionCount} governance dimensions, computed quarterly. Its methodology covers indicator selection, weighting, reference periods, and uncertainty.`,
    entries: [
      {
        href: "/civica-index/methodology",
        title: "Civica Index methodology",
        blurb:
          `The composite specification — ${civicaIndex.dimensionCount} governance dimensions, indicator basket, sources, frozen reference periods, weighting approach, uncertainty intervals.`,
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
    heading: "Event-driven scoring — the Civica Pulse",
    intro:
      "The Pulse is an event-driven directional signal layered on the Index. It ingests governance-relevant events from multiple source feeds, classifies each via a multi-run LLM consensus, applies asymmetric corroboration rules, and decays impacts over time. Its automated daily refresh is currently paused, so published values reflect the most recent computation rather than a live feed.",
    entries: [
      {
        href: "/civica-index/methodology/pulse",
        title: "Pulse methodology",
        blurb:
          "The full pipeline — source taxonomy, multi-run classifier, severity tiers, corroboration rules, press-freedom modulation, decay function, double-counting prevention.",
        beta: true,
      },
      {
        href: "/civica-index/methodology/pulse/backtest",
        title: "Pulse backtest",
        blurb:
          `Backtest results against ${pulse.backtest.cases.length} named historical governance shocks (${pulse.backtest.cases.map((c) => c.label).join(", ")}).`,
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
      {
        href: "/civica-index/methodology/peer-grouping/migration",
        title: "Peer grouping — migration table",
        blurb:
          "The per-country migration table after the retirement of the legacy structural_family taxonomy.",
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
        <p className="editorial-page-subtitle">
          Every load-bearing methodology decision in Civica is documented as a
          citable resolution before the corresponding code ships. This page
          indexes every published methodology document on the site, organized
          by domain.
        </p>

        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="editorial-section"
            aria-labelledby={`${section.id}-heading`}
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
          </section>
        ))}

        {/* "BETA meaning" + "Not yet published" prose-only sections —
            sourced from content/methodology-overview.md per
            content-templating audit v1.0 §3.2. The markdown's per-
            section anchors ({#beta-meaning}, {#not-yet-published}) are
            mirrored in SIDEBAR_ITEMS so the left rail keeps working. */}
        <section className="editorial-section">
          <MarkdownContent
            file="content/methodology-overview.md"
            stats={null}
            slice={{ from: "beta-meaning", to: "get-in-touch" }}
          />
        </section>

        {/* Get in touch prose — markdown source of truth. The TSX
            shell keeps the per-section <section> wrapper for layout
            consistency with the rest of the methodology hub. */}
        <section className="editorial-section">
          <MarkdownContent
            file="content/methodology-overview.md"
            stats={null}
            slice={{ from: "get-in-touch" }}
          />
        </section>

        <section
          id="cite"
          className="editorial-section"
          aria-labelledby="cite-heading"
        >
          <h2 id="cite-heading">Cite this page</h2>
          <CiteAccordion
            subject="Civica Atlas Methodology — Methodology hub"
            pageTitle="Methodology hub"
            url="https://civicaatlas.org/methodology"
            dataVintage={civicaIndex.lastRevisionIso}
          />
        </section>
      </article>
    </EditorialPage>
  );
}
