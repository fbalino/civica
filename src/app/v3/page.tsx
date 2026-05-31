import type { Metadata } from "next";
import { V3ShowcaseClient } from "./V3ShowcaseClient";
import "./v3.css";

export const metadata: Metadata = {
  title: "V3 Visual Language — Civica Atlas",
  description: "A mockup-driven V3 component and visual-language preview for Civica Atlas.",
};

export default function V3Page() {
  return <V3ShowcaseClient />;
}
