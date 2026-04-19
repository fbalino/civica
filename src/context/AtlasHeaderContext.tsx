"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type AtlasHeaderContextType = {
  atlasControls: ReactNode | null;
  setAtlasControls: (controls: ReactNode | null) => void;
};

const AtlasHeaderContext = createContext<AtlasHeaderContextType>({
  atlasControls: null,
  setAtlasControls: () => {},
});

export function AtlasHeaderProvider({ children }: { children: ReactNode }) {
  const [atlasControls, setAtlasControls] = useState<ReactNode | null>(null);
  return (
    <AtlasHeaderContext.Provider value={{ atlasControls, setAtlasControls }}>
      {children}
    </AtlasHeaderContext.Provider>
  );
}

export function useAtlasHeader() {
  return useContext(AtlasHeaderContext);
}
