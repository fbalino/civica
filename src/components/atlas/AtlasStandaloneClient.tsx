"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Country } from "./data";
import { AtlasWorldMap } from "./AtlasWorldMap";
import { buildNeIdMap } from "./map-geom";
import { useMapPaths } from "./useMapPaths";
import { atlasIdToSlug } from "@/lib/atlas/ids";
import type { AtlasLayerValues } from "@/lib/atlas/load-atlas-data";
import {
  type AtlasLayerKey,
  DEFAULT_LAYER,
} from "@/lib/atlas/map-layers";

export interface AtlasStandaloneClientProps {
  countries: Country[];
  /** Per-iso3 data-layer values for the choropleth switcher. */
  layerData: Record<string, AtlasLayerValues>;
  /** Layer selected by the `?layer=` URL param on first load (validated server-side). */
  initialLayer?: AtlasLayerKey;
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
export function AtlasStandaloneClient({
  countries,
  layerData,
  initialLayer = DEFAULT_LAYER,
}: AtlasStandaloneClientProps) {
  const router = useRouter();
  const neIdToOurs = useMemo(() => buildNeIdMap(countries), [countries]);
  const { mapPaths, mapLoaded } = useMapPaths(countries, neIdToOurs);
  const [pinned, setPinned] = useState<string[]>([]);
  const [layer, setLayer] = useState<AtlasLayerKey>(initialLayer);

  // Update the ?layer= param for shareable views (replace, no scroll). The
  // government default drops the param entirely to keep the URL clean.
  const onLayerChange = useCallback(
    (next: AtlasLayerKey) => {
      setLayer(next);
      const params = new URLSearchParams(window.location.search);
      if (next === DEFAULT_LAYER) params.delete("layer");
      else params.set("layer", next);
      const qs = params.toString();
      router.replace(`/atlas${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router]
  );

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
          layerData={layerData}
          layer={layer}
          onLayerChange={onLayerChange}
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
