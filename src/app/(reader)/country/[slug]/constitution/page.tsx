import Link from "next/link";
import { notFound } from "next/navigation";
import { getJurisdictionBySlug, getConstitution } from "@/lib/db/queries";
import { formatGovernmentType } from "@/lib/text/clean";
import { classifyGovernment } from "@/lib/data/government-category";
import { ConstitutionExplorer } from "@/components/country/ConstitutionExplorer";
import "../../../../constitution.css";

export const revalidate = 3600;

// Constitution tab of the unified /country/[slug] page. The masthead, tab
// bar, sticky search and AI drawer live in the shared layout — this page
// renders ONLY the explorer body. Data comes from getConstitution(); when a
// country has no constitution row we degrade to an on-brand empty state.
export default async function CountryConstitutionTab({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const jurisdiction = await getJurisdictionBySlug(slug).catch(() => null);
  if (!jurisdiction) notFound();

  // Soft-fail the constitution fetch so a Neon hiccup degrades to the empty
  // state rather than 500-ing the whole tab.
  const constitution = await getConstitution(jurisdiction.id).catch(() => null);

  const govLabel =
    formatGovernmentType(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType
    ) ||
    classifyGovernment(
      jurisdiction.governmentTypeDetail ?? jurisdiction.governmentType
    ).label ||
    null;

  // A row counts as "has data" if it carries any displayable metadata or
  // text. Rows can exist with only an id, so guard on the meaningful fields.
  const hasData =
    !!constitution &&
    (constitution.year != null ||
      constitution.yearUpdated != null ||
      !!constitution.constituteProjectId ||
      !!constitution.fullTextHtml);

  if (!hasData) {
    return (
      <div className="const-page">
        <div className="const-empty">
          <div className="const-empty-mark" aria-hidden="true">
            §
          </div>
          <h1 className="const-empty-title">
            No constitution text is available for {jurisdiction.name} yet
          </h1>
          <p className="const-empty-body">
            Civica catalogues constitutions from the Constitute Project, the
            standard scholarly repository of the world&rsquo;s constitutions.
            We haven&rsquo;t indexed {jurisdiction.name}&rsquo;s constitution
            here yet — but you can still explore its government, institutions
            and governance scores.
          </p>
          <div className="const-empty-actions">
            <Link className="btn btn--primary" href={`/country/${slug}`}>
              View the {jurisdiction.name} factbook
              <span className="btn__arrow" aria-hidden="true">
                →
              </span>
            </Link>
            <Link
              className="btn btn--secondary"
              href={`/country/${slug}/civica-data`}
            >
              Civica governance data
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ConstitutionExplorer
      countryName={jurisdiction.name}
      governmentLabel={govLabel}
      data={{
        year: constitution.year,
        yearUpdated: constitution.yearUpdated,
        constituteProjectId: constitution.constituteProjectId,
        fullTextHtml: constitution.fullTextHtml,
        lastFetched: constitution.lastFetched
          ? constitution.lastFetched.toISOString()
          : null,
      }}
    />
  );
}
