"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Which mobile pane is currently visible when the viewport is <=768px.
 * Matches the existing Atlas "countries / center / chat" tri-state so the
 * existing CSS overlay rules keep working unchanged during the migration.
 */
export type MobilePanel = "center" | "countries" | "chat";

export type ChatRole = "user" | "ai";

export interface ChatMessage {
  role: ChatRole;
  text: string;
  lead?: string;
  cite?: string;
}

interface ShellContextValue {
  /** Viewport is currently <=768px. */
  isMobile: boolean;
  /** Which pane is shown on mobile (desktop: all three are always visible). */
  mobilePanel: MobilePanel;
  setMobilePanel: (panel: MobilePanel) => void;
  /** Left pane width (desktop only). */
  leftW: number;
  setLeftW: (w: number) => void;
  /** Right pane width (desktop only). */
  rightW: number;
  setRightW: (w: number) => void;
  /** Is the right pane collapsed on desktop (user preference). */
  rightCollapsed: boolean;
  setRightCollapsed: (c: boolean) => void;
  /**
   * Per-route chat history. Keyed so /atlas/usa's conversation is
   * preserved when the user hops to /atlas/france and back. The panel
   * initializes a thread with its greeting on first read.
   */
  getThread: (key: string, greeting: string) => ChatMessage[];
  setThread: (
    key: string,
    updater: (prev: ChatMessage[]) => ChatMessage[]
  ) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

const LEFT_MIN = 220;
const LEFT_MAX = 500;
const RIGHT_MIN = 280;
const RIGHT_MAX = 560;
const LEFT_DEFAULT = 290;
const RIGHT_DEFAULT = 325;

// Persist in the same localStorage key as AtlasApp so the shell and the
// legacy Atlas stay in sync on width preferences during the migration.
const STORAGE_KEY = "atlas_panels";
const COLLAPSED_KEY = "shell_right_collapsed";

function clampLeft(w: number) {
  return Math.max(LEFT_MIN, Math.min(LEFT_MAX, w));
}
function clampRight(w: number) {
  return Math.max(RIGHT_MIN, Math.min(RIGHT_MAX, w));
}

export function ShellProvider({ children }: { children: ReactNode }) {
  const [leftW, setLeftWState] = useState<number>(LEFT_DEFAULT);
  const [rightW, setRightWState] = useState<number>(RIGHT_DEFAULT);
  const [rightCollapsed, setRightCollapsedState] = useState<boolean>(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("center");
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // Chat threads are stored keyed by route so /atlas/usa's conversation
  // survives a hop to /atlas/france. Storing in state (not a ref) means
  // updates trigger a re-render of the panel subscribed through useShell.
  const [threads, setThreads] = useState<Record<string, ChatMessage[]>>({});
  // Stable fallback arrays for threads that haven't been seeded yet.
  // Without this, getThread would return a fresh array on every render
  // and the panel's auto-scroll effect would fire in a loop.
  const fallbacksRef = useRef<Record<string, ChatMessage[]>>({});

  // Hydrate persisted values after mount (avoid SSR mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.leftW === "number") setLeftWState(clampLeft(saved.leftW));
        if (typeof saved.rightW === "number") setRightWState(clampRight(saved.rightW));
      }
      const c = localStorage.getItem(COLLAPSED_KEY);
      if (c === "1") setRightCollapsedState(true);
    } catch {
      /* ignore */
    }
  }, []);

  // Track viewport size.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(max-width: 768px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const setLeftW = useCallback((w: number) => {
    const clamped = clampLeft(w);
    setLeftWState(clamped);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...saved, leftW: clamped })
      );
    } catch {
      /* ignore */
    }
  }, []);

  const setRightW = useCallback((w: number) => {
    const clamped = clampRight(w);
    setRightWState(clamped);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...saved, rightW: clamped })
      );
    } catch {
      /* ignore */
    }
  }, []);

  const setRightCollapsed = useCallback((c: boolean) => {
    setRightCollapsedState(c);
    try {
      localStorage.setItem(COLLAPSED_KEY, c ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const getThread = (key: string, greeting: string): ChatMessage[] => {
    if (threads[key]) return threads[key];
    const cached = fallbacksRef.current[key];
    if (cached && cached[0]?.text === greeting) return cached;
    const seeded: ChatMessage[] = [{ role: "ai", text: greeting }];
    fallbacksRef.current[key] = seeded;
    return seeded;
  };

  const setThread = useCallback(
    (key: string, updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setThreads((prev) => {
        const cur = prev[key] ?? [];
        return { ...prev, [key]: updater(cur) };
      });
    },
    []
  );

  const value = useMemo<ShellContextValue>(
    () => ({
      isMobile,
      mobilePanel,
      setMobilePanel,
      leftW,
      setLeftW,
      rightW,
      setRightW,
      rightCollapsed,
      setRightCollapsed,
      getThread,
      setThread,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isMobile,
      mobilePanel,
      leftW,
      setLeftW,
      rightW,
      setRightW,
      rightCollapsed,
      setRightCollapsed,
      threads,
      setThread,
    ]
  );

  return (
    <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
  );
}

export function useShell(): ShellContextValue {
  const v = useContext(ShellContext);
  if (!v) {
    throw new Error(
      "useShell must be used inside <ShellProvider>. Did you render a shell pane outside the (shell) route group?"
    );
  }
  return v;
}
