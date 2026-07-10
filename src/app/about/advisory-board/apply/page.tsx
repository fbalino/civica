import type { Metadata } from "next";
import ApplyClient from "./ApplyClient";
import { withOg } from "@/lib/og";
import "../../../contact/contact.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Apply to the Advisory Board",
  description:
    "Express interest in a planned independent advisory board for the Civica Index methodology. No board review or endorsement has occurred yet.",
  alternates: {
    canonical: "https://civicaatlas.org/about/advisory-board/apply",
  },
  openGraph: withOg({
    title: "Apply to the Advisory Board · Civica Atlas",
    description:
      "Express interest in a planned independent advisory board for the Civica Index methodology.",
    url: "https://civicaatlas.org/about/advisory-board/apply",
  }),
};

export default function AdvisoryBoardApplyPage() {
  return <ApplyClient />;
}
