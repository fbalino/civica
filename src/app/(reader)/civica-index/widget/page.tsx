import { redirect } from "next/navigation";

/**
 * Composite widgets were part of the superseded public Index product.
 * The selected disposition exposes only source-native observations, so this
 * legacy gallery resolves directly to that product instead of publishing a
 * derived country score.
 */
export default function LegacyIndexWidgetPage() {
  redirect("/governance-evidence");
}
