"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Country } from "./data";
import { AtlasWorldMap } from "./AtlasWorldMap";
import { buildNeIdMap } from "./map-geom";
import { useMapPaths } from "./useMapPaths";
import { atlasIdToSlug } from "@/lib/atlas/ids";

export interface AtlasMapShellClientProps {
  countries: Country[];
}

/**
 * Client wrapper for the /atlas map-root route. Owns local pinned state
 * and routes country clicks to the shell country view. The shell-route
 * version does NOT need the filter state that the legacy / route uses —
 * when the Atlas moves fully into the shell in Phase 2.2, filter
 * controls will land in the left rail, not the global header.
 */
export function AtlasMapShellClient({ countries }: AtlasMapShellClientProps) {
  const router = useRouter();
  const neIdToOurs = useMemo(() => buildNeIdMap(countries), [countries]);
  const { mapPaths, mapLoaded } = useMapPaths(countries, neIdToOurs);
  const [pinned, setPinned] = useState<string[]>([]);

  return (
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
          router.push(`/atlas/${slug}/chamber`);
        }}
        onUnpinAt={(i) =>
          setPinned((prev) => prev.filter((_, j) => j !== i))
        }
        onOpenCompare={() => {
          if (pinned.length < 2) return;
          // In-atlas compare (fast SPA-style with hemicycles). The
          // long-form scrollable comparison still lives at /compare.
          router.push(`/atlas/compare?a=${pinned[0]}&b=${pinned[1]}`);
        }}
      />
    </div>
  );
}
