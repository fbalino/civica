"use client";

/**
 * MapExplorerModal — the large, focused map view opened from the masthead tile.
 * Defaults to the free Civica 2D map; a 2D·3D SegmentedControl swaps in the
 * Mapbox 3D/globe view on demand (only when a Mapbox token is configured, and
 * only mounted while 3D is selected). Portaled to <body>; Esc / backdrop / ✕
 * close it.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SegmentedControl } from "@/components/editorial/SegmentedControl";
import { CountryMap } from "./CountryMap";
import { Country3DView } from "./Country3DView";
import { isPmtilesEnabled } from "@/lib/map/civica-map-style";
import type { CountryBounds } from "@/lib/data/country-bounds";

interface MapExplorerModalProps {
  bounds: CountryBounds;
  countryName: string;
  mapboxAvailable: boolean;
  onClose: () => void;
}

type Mode = "2d" | "3d";

export function MapExplorerModal({
  bounds,
  countryName,
  mapboxAvailable,
  onClose,
}: MapExplorerModalProps) {
  const [mode, setMode] = useState<Mode>("2d");
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  const options = [
    { value: "2d" as const, label: "2D map" },
    { value: "3d" as const, label: "3D · Globe" },
  ];

  return createPortal(
    <div
      className="map-explorer-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Map of ${countryName}`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="map-explorer-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="map-explorer-head">
          <div className="map-explorer-title">{countryName}</div>
          <div className="map-explorer-head-actions">
            {mapboxAvailable && (
              <SegmentedControl<Mode>
                value={mode}
                options={options}
                onChange={setMode}
                ariaLabel="Map view mode"
              />
            )}
            <button
              ref={closeRef}
              type="button"
              className="map-explorer-close"
              onClick={onClose}
              aria-label="Close map"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="map-explorer-body">
          {mode === "3d" && mapboxAvailable ? (
            <Country3DView bounds={bounds} countryName={countryName} />
          ) : (
            <CountryMap
              bounds={bounds}
              countryName={countryName}
              interactive
              showControls
            />
          )}
        </div>

        <div className="map-explorer-foot">
          {mode === "3d"
            ? "3D terrain & buildings · Mapbox. Drag to pan, right-drag to rotate."
            : isPmtilesEnabled()
              ? "Civica map · OpenStreetMap data via Protomaps. Drag to pan, scroll to zoom."
              : "Civica map · OpenStreetMap data via OpenFreeMap. Drag to pan, scroll to zoom."}
        </div>
      </div>
    </div>,
    document.body,
  );
}
