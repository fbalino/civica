import type { Metadata } from "next";
import ApplyClient from "./ApplyClient";
import { withOg } from "@/lib/og";
import "../../../contact/contact.css";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Apply to the Advisory Board",
  description:
    "Civica Atlas accepts private expressions of interest in the five areas named by the charter: governance measurement, political event data, research-data curation, data-heavy accessibility, and source rights. Fernando Baliño reads each application. Submission does not confer membership, a review role, or endorsement.",
  alternates: {
    canonical: "https://civicaatlas.org/about/advisory-board/apply",
  },
  openGraph: withOg({
    title: "Apply to the Advisory Board · Civica Atlas",
    description:
      "Civica Atlas accepts private expressions of interest in the five areas named by the charter: governance measurement, political event data, research-data curation, data-heavy accessibility, and source rights. Fernando Baliño reads each application. Submission does not confer membership, a review role, or endorsement.",
    url: "https://civicaatlas.org/about/advisory-board/apply",
  }),
};

export default function AdvisoryBoardApplyPage() {
  return <ApplyClient />;
}
