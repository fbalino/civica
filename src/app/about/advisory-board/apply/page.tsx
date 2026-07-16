import type { Metadata } from "next";
import ApplyClient from "./ApplyClient";
import { withOg } from "@/lib/og";
import "../../../contact/contact.css";

export const revalidate = 0;

export const metadata: Metadata = {
  title: "Apply to the Advisory Board",
  description:
    "Submit a private expression of interest under the Civica Atlas advisory-board charter. Application does not imply appointment, review, or endorsement.",
  alternates: {
    canonical: "https://civicaatlas.org/about/advisory-board/apply",
  },
  openGraph: withOg({
    title: "Apply to the Advisory Board · Civica Atlas",
    description:
      "Submit a private expression of interest under the Civica Atlas advisory-board charter.",
    url: "https://civicaatlas.org/about/advisory-board/apply",
  }),
};

export default function AdvisoryBoardApplyPage() {
  return <ApplyClient />;
}
