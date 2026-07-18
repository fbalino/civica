"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Country } from "./data";
import { AtlasWorldMap } from "./AtlasWorldMap";
import { Button } from "@/components/editorial/Button";
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
 * The synchronized country selector is the accessible selection path for the
 * visual map. Pointer/touch selections feed the same state, then readers
 * explicitly choose whether to open a profile or add that country to compare.
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
  const [selectedCountryId, setSelectedCountryId] = useState<string | null>(
    null,
  );
  const [layer, setLayer] = useState<AtlasLayerKey>(initialLayer);
  const countriesById = useMemo(
    () => new Map(countries.map((country) => [country.id, country])),
    [countries],
  );
  const countriesByName = useMemo(
    () => [...countries].sort((a, b) => a.name.localeCompare(b.name)),
    [countries],
  );
  const selectedCountry = selectedCountryId
    ? countriesById.get(selectedCountryId) ?? null
    : null;
  const canAddSelectedCountry =
    selectedCountry !== null &&
    !pinned.includes(selectedCountry.id) &&
    pinned.length < 2;

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

  const selectCountry = useCallback((country: Country) => {
    setSelectedCountryId(country.id);
  }, []);

  const openSelectedCountry = useCallback(() => {
    if (!selectedCountry) return;
    router.push(`/country/${atlasIdToSlug(selectedCountry.id, countries)}`);
  }, [countries, router, selectedCountry]);

  const addSelectedCountryToCompare = useCallback(() => {
    if (!selectedCountry || !canAddSelectedCountry) return;
    setPinned((current) => [...current, selectedCountry.id]);
  }, [canAddSelectedCountry, selectedCountry]);

  return (
    <div className="atlas-standalone">
      <header className="atlas-accessible-header">
        <div className="atlas-accessible-header__intro">
          <h1>World Atlas</h1>
          <p>
            Explore map-eligible sovereign-state entries, then open a profile
            or build a two-country comparison.
          </p>
        </div>
        <details className="atlas-country-controls">
          <summary>
            Country controls{selectedCountry ? ` · ${selectedCountry.name}` : ""}
          </summary>
          <div className="atlas-country-controls__body">
            <label htmlFor="atlas-country-selector">
              <span>Select a country</span>
              <select
                id="atlas-country-selector"
                value={selectedCountryId ?? ""}
                onChange={(event) => {
                  if (!event.target.value) {
                    setSelectedCountryId(null);
                    return;
                  }
                  const country = countriesById.get(event.target.value);
                  if (country) selectCountry(country);
                }}
              >
                <option value="">Choose a country</option>
                {countriesByName.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="atlas-country-controls__status" role="status">
              {selectedCountry
                ? `${selectedCountry.name} selected. Choose an action below.`
                : "No country selected."}
            </p>
            <div className="atlas-country-controls__actions">
              <Button
                size="sm"
                disabled={!selectedCountry}
                onClick={openSelectedCountry}
              >
                Open profile
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={!canAddSelectedCountry}
                onClick={addSelectedCountryToCompare}
              >
                {selectedCountry && pinned.includes(selectedCountry.id)
                  ? "Already in comparison"
                  : pinned.length >= 2
                    ? "Comparison is full"
                    : "Add to comparison"}
              </Button>
            </div>
            <p className="atlas-country-controls__hint">
              Select and add two countries, then choose Open compare on the
              map.
            </p>
          </div>
        </details>
      </header>
      <div
        className="atlas-view"
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
          selectedCountryId={selectedCountryId}
          onCountrySelect={selectCountry}
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
