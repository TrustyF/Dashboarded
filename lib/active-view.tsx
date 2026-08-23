"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { LINKS } from "@/lib/nav-links";

type ActiveViewContextValue = {
  activeHref: string;
  setActiveView: (href: string) => void;
};

const ActiveViewContext = createContext<ActiveViewContextValue | null>(null);

// Replaces next/navigation's router as the source of truth for "which view
// is showing" - this is a kiosk, not a multi-page site (see components/Nav.tsx
// and components/ViewHost.tsx), so there's no URL to keep in sync, just this
// bit of shared state.
export function ActiveViewProvider({ children }: { children: ReactNode }) {
  const [activeHref, setActiveView] = useState<string>(LINKS[0].href);
  return (
    <ActiveViewContext.Provider value={{ activeHref, setActiveView }}>
      {children}
    </ActiveViewContext.Provider>
  );
}

export function useActiveView() {
  const ctx = useContext(ActiveViewContext);
  if (!ctx) throw new Error("useActiveView must be used within ActiveViewProvider");
  return ctx;
}
