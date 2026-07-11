import { redirect } from "next/navigation";

/**
 * The peer-lens explorer depended on the superseded Civica composite.
 * Preserve its research code and release artifacts, but do not expose those
 * scores as a current public comparison product.
 */
export default function LegacyGovernmentTypesPage() {
  redirect("/civica-index");
}
