import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import { withOg } from "@/lib/og";
import {
  getGlossaryGroups,
  type GlossaryTag,
  type GlossarySeeAlso,
} from "@/lib/data/glossary";
import { GlossaryNav } from "./GlossaryNav";
import "../glossary.css";

export const revalidate = 86400;

const TITLE = "Glossary — Civica";
const DESCRIPTION =
  "The vocabulary of governance, plainly defined — every term Civica uses across the Index, the Pulse, and the Factbook, with concise definitions and links to the methodology that puts each to work.";
const CANONICAL = "https://civicaatlas.org/glossary";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: CANONICAL },
  openGraph: withOg({
    title: TITLE,
    description: DESCRIPTION,
    url: CANONICAL,
    type: "article",
  }),
};

/** Map a category tag to its tinted tag CSS modifier class. */
function tagClass(tag: GlossaryTag): string {
  switch (tag) {
    case "outcome":
      return "glossary-tag glossary-tag--sage";
    case "CI dimension":
      return "glossary-tag glossary-tag--blue";
    case "structure":
      return "glossary-tag glossary-tag--sand";
    case "process":
      return "glossary-tag glossary-tag--rose";
    case "regime type":
    case "provenance":
    default:
      return "glossary-tag";
  }
}

/** In-page anchors render as plain <a>; internal routes use Next <Link>. */
function SeeAlsoLink({ link }: { link: GlossarySeeAlso }) {
  if (link.href.startsWith("#")) {
    return <a href={link.href}>{link.label}</a>;
  }
  return <Link href={link.href}>{link.label}</Link>;
}

export default function GlossaryPage() {
  const groups = getGlossaryGroups();
  const activeLetters = groups.map((g) => g.letter);
  const termCount = groups.reduce((sum, g) => sum + g.terms.length, 0);

  return (
    <>
      <div className="glossary-page">
        <div className="glossary-titleblock">
          <div className="glossary-eyebrow">Reference</div>
          <h1 className="glossary-title">Glossary</h1>
          <p className="glossary-dek">
            The vocabulary of governance, plainly defined. Every term Civica uses
            across the Index, the Pulse, and the Factbook — with a concise
            definition and, where relevant, a link to the methodology that puts
            it to work.
          </p>
        </div>
      </div>

      <GlossaryNav activeLetters={activeLetters} />

      <div className="glossary-page">
        <div className="glossary-body">
          {groups.map((group) => (
            <section
              key={group.letter}
              id={`letter-${group.letter}`}
              className="glossary-lettergroup"
            >
              <div className="glossary-letterhead">
                <span className="glossary-letterhead-big">{group.letter}</span>
                <span className="glossary-letterhead-count">
                  {group.terms.length}{" "}
                  {group.terms.length === 1 ? "term" : "terms"}
                </span>
              </div>
              <div className="glossary-terms">
                {group.terms.map((term) => (
                  <article
                    key={term.id}
                    id={term.id}
                    className="glossary-term"
                  >
                    <h3>
                      {term.term}
                      {term.tag ? (
                        <span className={tagClass(term.tag)}>{term.tag}</span>
                      ) : null}
                    </h3>
                    <p>{term.definition}</p>
                    {term.source ? (
                      <p className="glossary-source">
                        Source:{" "}
                        {term.source.url ? (
                          term.source.url.startsWith("/") ? (
                            <Link href={term.source.url}>{term.source.name}</Link>
                          ) : (
                            <a
                              href={term.source.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {term.source.name}
                            </a>
                          )
                        ) : (
                          term.source.name
                        )}
                      </p>
                    ) : null}
                    {term.seeAlso && term.seeAlso.length > 0 ? (
                      <p className="glossary-seealso">
                        See also:{" "}
                        {term.seeAlso.map((link, i) => (
                          <Fragment key={link.href + link.label}>
                            {i > 0 ? " · " : null}
                            <SeeAlsoLink link={link} />
                          </Fragment>
                        ))}
                      </p>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))}

          <p className="glossary-seealso" style={{ marginTop: "var(--space-7)" }}>
            {termCount} terms. Definitions are written for general readers in our
            own words and paraphrase the cited reference for each entry; for the
            precise measures behind the Civica Index, see the{" "}
            <Link href="/civica-index/methodology">Index methodology</Link>.
          </p>
        </div>
      </div>
    </>
  );
}
