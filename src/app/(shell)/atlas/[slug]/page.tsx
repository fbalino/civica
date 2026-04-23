import { redirect } from "next/navigation";

// Canonical atlas country URL always includes the tab, so /atlas/[slug]
// redirects to /atlas/[slug]/chamber.
export default async function AtlasCountryRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/atlas/${slug}/chamber`);
}
