import type { Metadata } from "next";
import AtlasApp from "@/components/atlas/AtlasApp";

export const metadata: Metadata = {
  title: "Civica — Interactive Atlas of World Government Structures | 250+ Countries",
  description:
    "Explore how every country in the world is governed. Interactive visualizations of government structures, branches of power, and political systems for 250+ nations. The modern successor to the CIA World Factbook.",
  alternates: { canonical: "https://civica-kappa.vercel.app" },
  openGraph: {
    title: "Civica — Interactive Atlas of World Government Structures | 250+ Countries",
    description:
      "Explore how every country in the world is governed. Interactive visualizations of government structures, branches of power, and political systems for 250+ nations.",
    url: "https://civica-kappa.vercel.app",
    type: "website",
  },
};

export default function Home() {
  return <AtlasApp />;
}
