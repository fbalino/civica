import { AskCivicaPanel } from "@/components/shell/AskCivicaPanel";
import { ATLAS_ORG_PROMPTS } from "@/lib/shell/suggested-prompts";
import { getOrganizationBySlug } from "@/lib/data/international-organizations";

export const revalidate = 3600;

/**
 * Right pane for /atlas/organizations/[slug]. Ask Civica is scoped to the
 * org being viewed; thread is keyed per-org so navigating between orgs
 * starts fresh conversations.
 */
export default async function OrgRightSlot({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = getOrganizationBySlug(slug);
  const orgName = org?.name ?? slug.toUpperCase();

  return (
    <AskCivicaPanel
      title={`Ask Civica · ${orgName}`}
      suggestions={ATLAS_ORG_PROMPTS}
      inputPlaceholder={`Ask about ${orgName}…`}
      apiContext={{ mode: "atlas-organization", organization: orgName, organizationSlug: slug }}
      threadKey={`atlas:org:${slug}`}
    />
  );
}
