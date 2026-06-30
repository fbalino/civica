"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Country } from "./data";
import { AtlasWorldMap } from "./AtlasWorldMap";
import { buildNeIdMap } from "./map-geom";
import { useMapPaths } from "./useMapPaths";
import { atlasIdToSlug } from "@/lib/atlas/ids";

export interface AtlasStandaloneClientProps {
  countries: Country[];
}

/**
 * Standalone /atlas map client (Option B, Phase 2). Renders the choropleth
 * world map full-bleed with NO three-pane shell, no ShellContext, no left/
 * right rails. Selection state (pinned compare) is owned locally here.
 *
 * Country clicks navigate to the canonical factbook country reader
 * (`/factbook/[slug]`) — the atlas country tabs were retired to the factbook.
 * Shift-pinning two countries and opening compare routes to the long-form
 * `/compare` page (the in-atlas compare view was retired too).
 */
export function AtlasStandaloneClient({ countries }: AtlasStandaloneClientProps) {
  const router = useRouter();
  const neIdToOurs = useMemo(() => buildNeIdMap(countries), [countries]);
  const { mapPaths, mapLoaded } = useMapPaths(countries, neIdToOurs);
  const [pinned, setPinned] = useState<string[]>([]);

  return (
    <div className="atlas-standalone">
      <div
        className="atlas-view"
        style={{ position: "relative", height: "100%" }}
        data-shell-route="atlas-map"
      >
        <AtlasWorldMap
          countries={countries}
          mapPaths={mapPaths}
          mapLoaded={mapLoaded}
          filteredCountryIds={countries.map((c) => c.id)}
          pinned={pinned}
          onCountrySelect={(c, { shift }) => {
            if (shift && pinned.length < 2 && !pinned.includes(c.id)) {
              setPinned((prev) => [...prev, c.id]);
              return;
            }
            const slug = atlasIdToSlug(c.id, countries);
            router.push(`/country/${slug}`);
          }}
          onUnpinAt={(i) =>
            setPinned((prev) => prev.filter((_, j) => j !== i))
          }
          onOpenCompare={() => {
            if (pinned.length < 2) return;
            // The fast in-atlas compare was retired; the canonical
            // side-by-side comparison lives at /compare.
            const slugA = atlasIdToSlug(pinned[0], countries);
            const slugB = atlasIdToSlug(pinned[1], countries);
            router.push(`/compare?c=${slugA}&c=${slugB}`);
          }}
        />
      </div>
    </div>
  );
}
