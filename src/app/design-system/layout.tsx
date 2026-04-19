import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design System",
  description:
    "Civica design tokens, typography, color palette, spacing, and component guidelines for designers and developers.",
};

export default function DesignSystemLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
