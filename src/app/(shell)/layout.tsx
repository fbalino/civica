import { ShellProvider } from "@/components/shell/ShellContext";
import { ThreePaneShell } from "@/components/shell/ThreePaneShell";

/**
 * (shell) route group layout — wraps every route inside the three-pane
 * chrome. `left` and `right` are Next.js parallel route slots (see
 * @left/ and @right/ directories). `children` is the center pane.
 *
 * All three slots come from the active route. Default slot fallbacks in
 * @left/default.tsx and @right/default.tsx render when a route doesn't
 * provide its own slot.
 */
export default function ShellLayout({
  children,
  left,
  right,
}: {
  children: React.ReactNode;
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <ShellProvider>
      <ThreePaneShell leftSlot={left} rightSlot={right}>
        {children}
      </ThreePaneShell>
    </ShellProvider>
  );
}
