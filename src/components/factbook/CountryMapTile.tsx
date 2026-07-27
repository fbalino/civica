"use client";

/**
 * CountryMapTile — the masthead "Map" tile. Shows a live, non-interactive
 * Civica map preview (replacing the old static locator globe); clicking opens
 * the large MapExplorerModal (interactive 2D, with an on-demand Mapbox 3D
 * toggle). Rendered only when we have bounds for the country; otherwise the
 * masthead falls back to the static locator tile.
 */
import { useRef, useState, type KeyboardEvent } from "react";
import { CountryMap } from "./CountryMap";
import { MapExplorerModal } from "./MapExplorerModal";
import type { CountryBounds } from "@/lib/data/country-bounds";
import { isPmtilesEnabled } from "@/lib/map/civica-map-style";

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
  const activationRef = useRef<HTMLButtonElement>(null);
  const selfHosted = isPmtilesEnabled();

  function openMap() {
    setOpen(true);
  }

  function handleActivationKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openMap();
  }

  function closeMap() {
    setOpen(false);
    requestAnimationFrame(() => activationRef.current?.focus());
  }

  return (
    <>
      <div className="factbook-hero-box country-map-tile">
        <CountryMap
          bounds={bounds}
          countryName={countryName}
          className="country-map-preview"
        />
        <button
          ref={activationRef}
          type="button"
          className="country-map-activation"
          onClick={openMap}
          onKeyDown={handleActivationKeyDown}
          aria-label={`Explore the interactive map of ${countryName}`}
        >
          <span className="country-map-explore-hint" aria-hidden>
            ⤢ Explore
          </span>
          <span className="label-strip">Map</span>
        </button>
        <span className="country-map-attribution" aria-label="Map attribution">
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            aria-label="OpenStreetMap map-data attribution (opens in a new tab)"
          >
            © OpenStreetMap
          </a>
          <a
            href={selfHosted ? "https://protomaps.com" : "https://openfreemap.org"}
            target="_blank"
            rel="noreferrer"
            aria-label={`${selfHosted ? "Protomaps" : "OpenFreeMap"} map-provider attribution (opens in a new tab)`}
          >
            {selfHosted ? "Protomaps" : "OpenFreeMap"}
          </a>
        </span>
      </div>
      {open && (
        <MapExplorerModal
          bounds={bounds}
          countryName={countryName}
          mapboxAvailable={mapboxAvailable}
          onClose={closeMap}
        />
      )}
    </>
  );
}
