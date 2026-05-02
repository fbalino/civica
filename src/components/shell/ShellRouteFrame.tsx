"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ThreePaneShell } from "./ThreePaneShell";

interface ShellRouteFrameProps {
  leftSlot: ReactNode;
  rightSlot: ReactNode;
  children: ReactNode;
}

export function ShellRouteFrame({
  leftSlot,
  rightSlot,
  children,
}: ShellRouteFrameProps) {
  const pathname = usePathname();
  const isHomepage = pathname === "/";
  const hideRight =
    isHomepage ||
    pathname === "/atlas" ||
    pathname === "/civica-index";

  return (
    <ThreePaneShell
      leftSlot={leftSlot}
      rightSlot={rightSlot}
      hideLeft={isHomepage}
      hideRight={hideRight}
    >
      {children}
    </ThreePaneShell>
  );
}
