import type { ReactNode } from "react";
import {
  ReaderSidebar,
  type ReaderSidebarItem,
} from "@/components/editorial/ReaderSidebar";

interface MethodologyLayoutProps {
  items: ReadonlyArray<ReaderSidebarItem>;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function MethodologyLayout({
  items,
  children,
  className,
  contentClassName,
}: MethodologyLayoutProps) {
  return (
    <div className={`methodology-layout${className ? ` ${className}` : ""}`}>
      <ReaderSidebar items={items} className="methodology-sidebar" />
      <div
        className={`methodology-content${
          contentClassName ? ` ${contentClassName}` : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}
