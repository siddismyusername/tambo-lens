"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface AppContextValue {
  activeDataSourceId: string | null;
  setActiveDataSourceId: (id: string | null) => void;
  activeView: "chat" | "sources" | "schema" | "permissions" | "dashboards";
  setActiveView: (view: AppContextValue["activeView"]) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [activeDataSourceId, setActiveDataSourceId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppContextValue["activeView"]>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <AppContext.Provider
      value={{
        activeDataSourceId,
        setActiveDataSourceId,
        activeView,
        setActiveView,
        sidebarOpen,
        setSidebarOpen,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
