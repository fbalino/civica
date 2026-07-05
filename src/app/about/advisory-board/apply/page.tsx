import type { Metadata } from "next";
import ApplyClient from "./ApplyClient";
import { withOg } from "@/lib/og";
import "../../../contact/contact.css";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Apply to the Advisory Board",
  description:
    "Apply to join the independent academic advisory board that reviews the Civica Index methodology — for scholars in governance measurement, political methodology, and comparative politics.",
  alternates: {
    canonical: "https://civicaatlas.org/about/advisory-board/apply",
  },
  openGraph: withOg({
    title: "Apply to the Advisory Board · Civica Atlas",
    description:
      "Apply to join the independent academic advisory board that reviews the Civica Index methodology.",
    url: "https://civicaatlas.org/about/advisory-board/apply",
  }),
};

export default function AdvisoryBoardApplyPage() {
  return <ApplyClient />;
}
