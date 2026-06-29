import Link from "next/link";

type ActiveSurface = "factbook" | "civica-index";

interface CountrySwitcherChipsProps {
  slug: string;
  active: ActiveSurface;
  /**
   * Retained for call-site compatibility. The standalone /atlas map (Option B,
   * Phase 2) no longer has per-country pages — the Factbook is the canonical
   * country reader — so this no longer toggles an "Open in Atlas" chip.
   */
  inAtlas?: boolean;
}

// Persistent chip group that appears on every per-country surface so a
// reader can flip between Factbook · Civica Index without losing their place.
// Layout (spacing/wrap/responsive collapse) lives in factbook.css under
// `.factbook-chip-row` / `.factbook-chip`.
export function CountrySwitcherChips({ slug, active }: CountrySwitcherChipsProps) {
  const items: Array<{ id: ActiveSurface; label: string; href: string }> = [
    { id: "factbook", label: "Factbook", href: `/factbook/${slug}` },
    { id: "civica-index", label: "Civica Index", href: `/civica-index/${slug}` },
  ];

  return (
    <nav aria-label="Switch view of country" className="factbook-chip-row">
      {items.map((item) => {
        if (item.id === active) {
          return (
            <span
              key={item.id}
              className="factbook-chip is-active"
              aria-current="page"
            >
              <span aria-hidden className="dot" />
              {item.label}
            </span>
          );
        }
        return (
          <Link key={item.id} href={item.href} className="factbook-chip">
            {item.label} →
          </Link>
        );
      })}
    </nav>
  );
}
