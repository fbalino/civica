"use client";

import { useState } from "react";
import { wikimediaUrl } from "@/lib/data/country-photos";

/*
 * LeaderPortrait — the avatar for a principal-leadership card.
 *
 * Renders the Wikidata P18 portrait (P2 enrichment) as an <img> built from the
 * stored Commons FILE NAME via wikimediaUrl(file, size) — the same
 * hotlink-the-CDN approach the country photo galleries use. Falls back to the
 * existing monogram avatar when:
 *   - photoUrl is null (no free portrait for this leader), OR
 *   - the Commons file 404s / fails to load at render time.
 *
 * Client component ONLY because the image needs an onError fallback; the
 * monogram path is otherwise identical to the prior server-rendered avatar,
 * so a leader without a portrait still renders the monogram with no JS.
 */

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export function LeaderPortrait({
  photoFile,
  personName,
}: {
  photoFile: string | null;
  personName: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = Boolean(photoFile) && !failed;

  return (
    <span className="lead-avatar">
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="lead-avatar-photo"
          src={wikimediaUrl(photoFile!, 200)}
          alt={`Portrait of ${personName}`}
          width={56}
          height={56}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="lead-avatar-monogram" aria-hidden>
          {initialsOf(personName)}
        </span>
      )}
    </span>
  );
}
