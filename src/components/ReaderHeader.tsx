import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

export function ReaderHeader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 var(--spacing-page-x)",
        height: 48,
        borderBottom: "1px solid var(--color-divider)",
        background: "var(--color-bg)",
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: "var(--text-18)",
          fontWeight: 300,
          letterSpacing: "var(--tracking-tighter)",
          color: "var(--color-text-primary)",
          textDecoration: "none",
          lineHeight: 1,
        }}
      >
        Civica
      </Link>
      <ThemeToggle />
    </div>
  );
}
