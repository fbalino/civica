"use client";

/**
 * CountryMapTile — the masthead "Map" tile. Shows a live, non-interactive
 * Civica map preview (replacing the old static locator globe); clicking opens
 * the large MapExplorerModal (interactive 2D, with an on-demand Mapbox 3D
 * toggle). Rendered only when we have bounds for the country; otherwise the
 * masthead falls back to the static locator tile.
 */
import { useState } from "react";
import { CountryMap } from "./CountryMap";
import { MapExplorerModal } from "./MapExplorerModal";
import type { CountryBounds } from "@/lib/data/country-bounds";

interface CountryMapTileProps {
  bounds: CountryBounds;
  countryName: string;
  mapboxAvailable: boolean;
}

export function CountryMapTile({
  bounds,
  countryName,
  mapboxAvailable,
}: CountryMapTileProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="factbook-hero-box country-map-tile"
        onClick={() => setOpen(true)}
        aria-label={`Explore the interactive map of ${countryName}`}
      >
        <CountryMap
          bounds={bounds}
          countryName={countryName}
          className="country-map-preview"
        />
        <span className="country-map-explore-hint" aria-hidden>
          ⤢ Explore
        </span>
        <span className="label-strip">Map</span>
      </button>
      {open && (
        <MapExplorerModal
          bounds={bounds}
          countryName={countryName}
          mapboxAvailable={mapboxAvailable}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
