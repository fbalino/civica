"use client";

import { useState } from "react";
import { SourceDot } from "@/components/SourceDot";

/**
 * Constitution Explorer — the Constitution tab of /country/[slug].
 *
 * The DB today carries METADATA only per constitution (adopted/amended years,
 * a Constitute Project id, last-fetched) — there is no parsed full text. So
 * this explorer is metadata-led and honest: it never fabricates a country's
 * article text. The left pane is a reader's guide to the universal parts of a
 * written constitution, each deep-linking to that topic on Constitute Project;
 * the right pane is a comfortable editorial reading column that explains the
 * selected element and links out to the real provisions.
 *
 * The component is built so that when `fullTextHtml` lands, the reading pane
 * lights up automatically (it renders the parsed HTML inside `.const-prose-html`
 * instead of the guide prose) — no structural change required.
 */

export interface ConstitutionData {
  year: number | null;
  yearUpdated: number | null;
  constituteProjectId: string | null;
  fullTextHtml: string | null;
  lastFetched: string | null;
}

interface ConstitutionExplorerProps {
  countryName: string;
  governmentLabel: string | null;
  data: ConstitutionData;
}

/**
 * The universal anatomy of a written constitution. Each entry is general
 * civic-education guidance — NOT a country-specific claim — plus the
 * Constitute Project topic anchor used to deep-link into the live text.
 * `topicAnchor` matches Constitute Project's on-page section ids.
 */
interface ConstSection {
  id: string;
  label: string;
  /** Constitute Project page anchor for this topic, when one exists. */
  topicAnchor?: string;
  blurb: string[];
}

const SECTIONS: ConstSection[] = [
  {
    id: "preamble",
    label: "Preamble",
    topicAnchor: "preamble",
    blurb: [
      "A preamble opens most constitutions with a statement of who is adopting the document and why. It names the source of authority — most often “the people” — and sets out the founding aspirations the rest of the text is meant to serve.",
      "Preambles are usually declaratory rather than enforceable, but courts in several countries read them as an aid to interpreting the binding provisions that follow.",
    ],
  },
  {
    id: "principles",
    label: "Fundamental principles",
    topicAnchor: "principles",
    blurb: [
      "The opening articles typically fix the character of the state: whether it is a republic or a monarchy, unitary or federal, secular or confessional, and what its official language, capital and symbols are.",
      "These provisions are the load-bearing structure of the document — later articles build on the form of government declared here.",
    ],
  },
  {
    id: "rights",
    label: "Rights & freedoms",
    topicAnchor: "rights",
    blurb: [
      "A bill of rights enumerates the freedoms the state must respect — expression, assembly, religion, due process, equality before the law — and the limits, if any, that may be placed on them.",
      "How a constitution defines, qualifies and entrenches these rights is one of the clearest signals of the governance model it describes.",
    ],
  },
  {
    id: "executive",
    label: "The executive",
    topicAnchor: "executive",
    blurb: [
      "These articles establish the head of state and head of government, how they are chosen, the length and limits of their terms, and the powers they hold over the administration, the armed forces and foreign affairs.",
      "The balance struck here — presidential, parliamentary or semi-presidential — defines how concentrated executive authority is.",
    ],
  },
  {
    id: "legislature",
    label: "The legislature",
    topicAnchor: "legislature",
    blurb: [
      "The legislative articles create the parliament or assembly: whether it has one chamber or two, how members are elected, the length of their mandate, and the procedure by which bills become law.",
      "They also set out the legislature’s power to scrutinise the executive — through questions, confidence votes and control of the budget.",
    ],
  },
  {
    id: "judiciary",
    label: "The judiciary",
    topicAnchor: "judiciary",
    blurb: [
      "These provisions establish the courts and, crucially, their independence: how judges are appointed, how they may be removed, and whether a constitutional or supreme court can review laws against the constitution.",
      "Judicial review is the mechanism that makes the rest of the document enforceable rather than merely declaratory.",
    ],
  },
  {
    id: "elections",
    label: "Elections & suffrage",
    topicAnchor: "elections",
    blurb: [
      "A constitution usually fixes who may vote and stand for office, how often elections are held, and which body administers them.",
      "Some entrench an independent electoral commission; others leave the detail to ordinary statute, which makes the rules easier to change.",
    ],
  },
  {
    id: "amendment",
    label: "Amendment process",
    topicAnchor: "amendment",
    blurb: [
      "Every constitution sets the bar for its own revision. Higher thresholds — supermajorities, referendums, ratification by sub-national units — make a constitution more rigid and durable.",
      "Some texts also place certain clauses beyond amendment entirely; these “eternity clauses” protect the core identity of the state.",
    ],
  },
  {
    id: "emergency",
    label: "Emergency powers",
    topicAnchor: "emergency",
    blurb: [
      "Many constitutions allow rights to be suspended and power to be concentrated during a declared emergency.",
      "The safeguards around these powers — who declares an emergency, for how long, with what oversight, and which rights remain inviolable — are a key test of constitutional resilience.",
    ],
  },
];

function constituteUrl(cpId: string, anchor?: string): string {
  const base = `https://www.constituteproject.org/constitution/${cpId}`;
  return anchor ? `${base}?lang=en#${anchor}` : `${base}?lang=en`;
}

export function ConstitutionExplorer({
  countryName,
  governmentLabel,
  data,
}: ConstitutionExplorerProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const hasFullText = !!data.fullTextHtml;

  const active = SECTIONS.find((s) => s.id === activeId) ?? null;
  const cpId = data.constituteProjectId;
  const lastFetchedIso = data.lastFetched
    ? new Date(data.lastFetched).toISOString()
    : null;

  return (
    <div className="const-page">
      {/* ---- Document header ---- */}
      <header className="const-header">
        <p className="const-eyebrow">Constitution</p>
        <h1 className="const-title">Constitution of {countryName}</h1>
        <p className="const-dek">
          A reader&rsquo;s guide to {countryName}&rsquo;s constitutional order,
          with the authoritative text on the Constitute Project. Select a part of
          the document to read about what it governs.
        </p>

        <div className="const-meta">
          {data.year != null && (
            <div className="const-meta-item">
              <span className="const-meta-label">Adopted</span>
              <span className="const-meta-value">{data.year}</span>
            </div>
          )}
          {data.yearUpdated != null && (
            <div className="const-meta-item">
              <span className="const-meta-label">Last amended</span>
              <span className="const-meta-value">{data.yearUpdated}</span>
            </div>
          )}
          {governmentLabel && (
            <div className="const-meta-item">
              <span className="const-meta-label">System</span>
              <span className="const-meta-value const-meta-value--sm">
                {governmentLabel}
              </span>
            </div>
          )}
          <div className="const-meta-item">
            <span className="const-meta-label">Source</span>
            <span className="const-meta-source">
              Constitute Project
              <SourceDot source="constitute_project" retrievedAt={lastFetchedIso} />
            </span>
          </div>
        </div>
      </header>

      {/* ---- Two-pane reading layout ---- */}
      <div className="const-grid">
        {/* Left: outline */}
        <nav className="const-outline" aria-label="Constitution outline">
          <p className="const-outline-heading">In this constitution</p>
          <ul className="const-outline-list">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={`const-outline-btn${
                    activeId === s.id ? " is-active" : ""
                  }`}
                  aria-pressed={activeId === s.id}
                  onClick={() =>
                    setActiveId((cur) => (cur === s.id ? null : s.id))
                  }
                >
                  <span className="const-outline-num">{i + 1}</span>
                  <span>{s.label}</span>
                </button>
              </li>
            ))}
          </ul>

          {cpId && (
            <div className="const-outline-foot">
              The full, article-by-article text is hosted by the{" "}
              <a href={constituteUrl(cpId)} target="_blank" rel="noopener noreferrer">
                Constitute Project
              </a>
              , which publishes constitutions under a non-commercial license.
            </div>
          )}
        </nav>

        {/* Right: reading pane */}
        <article className="const-reader">
          {hasFullText ? (
            // When parsed full text exists, render it as the reading column.
            <div
              className="const-prose-html"
              dangerouslySetInnerHTML={{ __html: data.fullTextHtml! }}
            />
          ) : active ? (
            // A constitutional element is selected — explain it + deep-link out.
            <>
              <p className="const-reader-eyebrow">
                <span className="const-reader-num">
                  {String(SECTIONS.indexOf(active) + 1).padStart(2, "0")}
                </span>{" "}
                Part of a constitution
              </p>
              <h2 className="const-reader-title">{active.label}</h2>
              <div className="const-prose">
                {active.blurb.map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>
              {cpId ? (
                <a
                  className="btn btn--primary const-readlink"
                  href={constituteUrl(cpId, active.topicAnchor)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read {countryName}&rsquo;s provisions
                  <span className="btn__arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              ) : null}
            </>
          ) : (
            // Default landing view: an editorial overview of the document.
            <>
              <p className="const-reader-eyebrow">Overview</p>
              <h2 className="const-reader-title">About this constitution</h2>
              <div className="const-prose">
                <p>
                  {countryName}&rsquo;s constitution
                  {data.year != null ? (
                    <>
                      {" "}
                      took its current form in{" "}
                      <strong>{data.year}</strong>
                      {data.yearUpdated != null && data.yearUpdated !== data.year ? (
                        <>
                          {" "}
                          and was last amended in{" "}
                          <strong>{data.yearUpdated}</strong>
                        </>
                      ) : null}
                    </>
                  ) : (
                    " is catalogued by the Constitute Project"
                  )}
                  . It is the supreme law that establishes the institutions of the
                  state and the rights of the people who live under it.
                </p>
                <p>
                  Use the outline to read about each part of the document — its
                  preamble, the rights it guarantees, how power is divided between
                  the executive, legislature and judiciary, and how the text itself
                  can be amended. Each section links to the authoritative
                  article-by-article text.
                </p>
              </div>

              <div className="const-note">
                Civica catalogues constitutions from the Constitute Project, the
                standard scholarly repository of the world&rsquo;s constitutions.
                The full, searchable text — including every article and amendment —
                is published there.
              </div>

              {cpId ? (
                <a
                  className="btn btn--primary const-readlink"
                  href={constituteUrl(cpId)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Read the full text on Constitute Project
                  <span className="btn__arrow" aria-hidden="true">
                    →
                  </span>
                </a>
              ) : null}

              {/* Adoption timeline */}
              {(data.year != null || data.yearUpdated != null) && (
                <div className="const-timeline">
                  <p className="const-timeline-heading">Constitutional milestones</p>
                  {data.yearUpdated != null && data.yearUpdated !== data.year && (
                    <div className="const-timeline-row">
                      <span className="const-timeline-year">{data.yearUpdated}</span>
                      <span className="const-timeline-label">
                        Most recent revision in force
                      </span>
                    </div>
                  )}
                  {data.year != null && (
                    <div className="const-timeline-row">
                      <span className="const-timeline-year">{data.year}</span>
                      <span className="const-timeline-label">
                        Current constitution adopted
                      </span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </article>
      </div>
    </div>
  );
}
