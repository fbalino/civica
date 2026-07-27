import type { Metadata } from "next";
import { HomeGrid } from "@/components/home/HomeGrid";
import { withOg } from "@/lib/og";

export const revalidate = 0;

export const metadata: Metadata = {
  // The root layout's `title.template` does not apply to the page of its own
  // segment (Next.js documented behavior), so the homepage sets the full
  // brand-led title absolutely — matching the layout's `title.default`.
  title: { absolute: "Civica Atlas — How Every Country Is Governed" },
  // PUBLIC_CLAIM: home.reference-scope
  description:
    "Civica Atlas is a provenance-first comparative reference to how every country is governed, with country profiles covering institutions, constitutions, elections, and source-linked facts.",
  alternates: { canonical: "https://civicaatlas.org" },
  openGraph: withOg({
    title: "Civica Atlas — How Every Country Is Governed",
    description:
      "A provenance-first comparative reference to how every country is governed, with country profiles covering institutions, constitutions, elections, and source-linked facts.",
    url: "https://civicaatlas.org",
    type: "website",
  }),
};

export default function LandingPage() {
  return <HomeGrid />;
}
