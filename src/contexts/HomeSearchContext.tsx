"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type HomeSearchContextValue = {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
};

const HomeSearchContext = createContext<HomeSearchContextValue | null>(null);

export function HomeSearchProvider({ children }: { children: ReactNode }) {
  const [searchTerm, setSearchTerm] = useState("");
  return (
    <HomeSearchContext.Provider value={{ searchTerm, setSearchTerm }}>
      {children}
    </HomeSearchContext.Provider>
  );
}

export function useHomeSearch(): HomeSearchContextValue {
  const ctx = useContext(HomeSearchContext);
  if (!ctx) {
    throw new Error("useHomeSearch must be used within HomeSearchProvider");
  }
  return ctx;
}
