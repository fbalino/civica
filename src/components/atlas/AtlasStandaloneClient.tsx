"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Country } from "./data";
import { AtlasWorldMap } from "./AtlasWorldMap";
import { Button } from "@/components/editorial/Button";
import { Banner } from "@/components/editorial/Banner";
import { DataTable } from "@/components/editorial/DataTable";
import { ResearchVisualizationDisclosure } from "@/components/research/ResearchVisualizationDisclosure";
import { buildNeIdMap } from "./map-geom";
import { useMapPaths } from "./useMapPaths";
import { atlasIdToSlug } from "@/lib/atlas/ids";
import type { AtlasLayerSource, AtlasLayerValues } from "@/lib/atlas/load-atlas-data";
import {
  type AtlasLayerKey,
  ATLAS_LAYER_DESCRIPTION,
  ATLAS_LAYER_MISSINGNESS,
  ATLAS_LAYER_TITLE,
  DEFAULT_LAYER,
  NO_DATA_LABEL,
  tooltipValueForLayer,
} from "@/lib/atlas/map-layers";

export interface AtlasStandaloneClientProps {
  countries: Country[];
  /** Per-iso3 data-layer values for the choropleth switcher. */
  layerData: Record<string, AtlasLayerValues>;
  /** Per-layer publisher and vintage metadata for map/table provenance. */
  layerSources: Record<AtlasLayerKey, AtlasLayerSource>;
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
  layerSources,
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
  const activeLayerSource = layerSources[layer];
  const activeLayerRows = useMemo(
    () =>
      countriesByName.map((country) => ({
        country,
        value: tooltipValueForLayer(layer, country, layerData[country.id]),
      })),
    [countriesByName, layer, layerData],
  );

  // Update the ?layer= param for shareable views (replace, no scroll). The
  // default Regime layer drops the param entirely to keep the URL clean.
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
      {countries.length === 0 ? (
        <div className="editorial-page editorial-page--full">
          <Banner variant="warn">
            No map-eligible country records are currently compiled. This is a
            coverage state, not a claim that no countries exist.
          </Banner>
        </div>
      ) : null}
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
          layerSources={layerSources}
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
      <section
        id="atlas-layer-table"
        className="editorial-page editorial-page--full"
        aria-labelledby="atlas-layer-table-heading"
      >
        <h2 id="atlas-layer-table-heading">Map layer table alternative</h2>
        <p>
          This table uses the same active variable and values as the map. It
          is a keyboard-friendly alternative to pointer exploration.
        </p>
        <p>
          <strong>{ATLAS_LAYER_TITLE[layer]}:</strong>{" "}
          {ATLAS_LAYER_DESCRIPTION[layer]} {ATLAS_LAYER_MISSINGNESS[layer]}
        </p>
        <ResearchVisualizationDisclosure
          title={`${ATLAS_LAYER_TITLE[layer]} map`}
          description="The map is a geographic view of the active source-native layer. The table below is the complete nonvisual equivalent."
          sources={[
            {
              id: activeLayerSource.sourceId,
              label: activeLayerSource.sourceName,
              href: activeLayerSource.sourceUrl ?? undefined,
              retrievedAt: activeLayerSource.lastSyncedAt,
              upstreamVintage: activeLayerSource.upstreamVintageLabel,
            },
          ]}
          missingData={ATLAS_LAYER_MISSINGNESS[layer]}
          dataAccess={{
            kind: "download",
            href: "/downloads/civica-atlas-2026-07-11.json.gz",
            label: "Download the permitted Atlas release (JSON gzip)",
          }}
          tableLabel="Show every map-eligible country and its active layer value"
        >
          <DataTable aria-label={`${ATLAS_LAYER_TITLE[layer]} table alternative`}>
            <thead>
              <tr>
                <th scope="col">Country</th>
                <th scope="col">{ATLAS_LAYER_TITLE[layer]}</th>
                <th scope="col">Availability</th>
              </tr>
            </thead>
            <tbody>
              {activeLayerRows.map(({ country, value }) => (
                <tr key={country.id}>
                  <th scope="row">
                    <Link href={`/country/${atlasIdToSlug(country.id, countries)}`}>
                      {country.name}
                    </Link>
                  </th>
                  <td>{value}</td>
                  <td>{value === NO_DATA_LABEL ? "No data" : "Observed"}</td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </ResearchVisualizationDisclosure>
      </section>
    </div>
  );
}
