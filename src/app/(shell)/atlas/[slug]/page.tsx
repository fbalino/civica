import { redirect } from "next/navigation";

export const revalidate = 3600;

// Canonical atlas country URL always includes the tab. Phase C — Structure
// absorbed the old Chamber tab and is now the default tab for a country.
export default async function AtlasCountryRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/atlas/${slug}/structure`);
}
