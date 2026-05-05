/**
 * Default left pane fallback — renders when a (shell) route does not
 * declare its own @left/page.tsx. Shows a minimal "Start exploring"
 * shortcut list so the pane isn't blank on the landing or on routes
 * that haven't been converted yet.
 */
import Link from "next/link";

const SHORTCUTS: Array<{ href: string; label: string; hint?: string }> = [
  { href: "/atlas", label: "Atlas map", hint: "Explore every country" },
  { href: "/civica-index", label: "Civica Index", hint: "Governance rankings" },
  { href: "/compare", label: "Compare", hint: "Up to 3 countries" },
  { href: "/countries", label: "Countries", hint: "A–Z directory" },
  { href: "/blog", label: "The Record", hint: "Editorial" },
];

export default function LeftDefault() {
  return (
    <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.15em",
          textTransform: "uppercase",
          color: "var(--atlas-muted)",
        }}
      >
        Start exploring
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {SHORTCUTS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              style={{
                display: "block",
                padding: "10px 12px",
                textDecoration: "none",
                borderRadius: 3,
                color: "var(--atlas-ink)",
                fontFamily: "var(--font-heading, serif)",
                fontSize: 16,
                lineHeight: 1.2,
              }}
            >
              {s.label}
              {s.hint && (
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--atlas-muted)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {s.hint}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
