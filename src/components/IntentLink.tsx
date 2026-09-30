"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

type IntentLinkProps = Omit<ComponentProps<typeof Link>, "prefetch">;

/**
 * A `next/link` that prefetches only on reader intent: pointer hover, focus,
 * or touch start. Use it for the shared site chrome (header, menus, mobile
 * navigation, footer), which renders dozens of links on every page.
 *
 * Database-backed pages are served from the page cache (PLT-033), and Next.js
 * fully prefetches every cached route whose link is in the viewport. Letting
 * the chrome do that would download each linked page's complete payload on
 * every page view (about 0.6 MB more RSC on a Record article). Deferring the
 * prefetch to intent keeps navigation warm for the link the reader is about
 * to follow without paying for the ones they are not.
 */
export function IntentLink({
  onMouseEnter,
  onFocus,
  onTouchStart,
  ...props
}: IntentLinkProps) {
  const [intent, setIntent] = useState(false);
  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onMouseEnter={(event) => {
        setIntent(true);
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        setIntent(true);
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        setIntent(true);
        onTouchStart?.(event);
      }}
    />
  );
}
