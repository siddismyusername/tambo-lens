"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardItem {
  /** Unique ID for this pinned item */
  id: string;
  /** Tambo component name: "KPICard", "BarChart", "LineChart", etc. */
  componentName: string;
  /** The props used to render the component (serializable JSON) */
  props: Record<string, unknown>;
  /** Human-readable label (generated from title prop or component name) */
  label: string;
  /** When this was pinned */
  pinnedAt: string;
}

export interface DashboardData {
  /** Server-side dashboard ID (null until first save) */
  id: string | null;
  name: string;
  items: DashboardItem[];
}

interface DashboardContextValue {
  dashboard: DashboardData;
  /** Add a component to the dashboard */
  pinItem: (componentName: string, props: Record<string, unknown>) => void;
  /** Remove a component from the dashboard by item ID */
  unpinItem: (itemId: string) => void;
  /** Remove a component from the dashboard by matching component name + props */
  unpinByFingerprint: (componentName: string, props: Record<string, unknown>) => void;
  /** Check if a component with these exact props is already pinned */
  isItemPinned: (componentName: string, props: Record<string, unknown>) => boolean;
  /** Whether a save is in progress */
  isSaving: boolean;
  /** Rename the dashboard */
  renameDashboard: (name: string) => void;
  /** Clear all items */
  clearDashboard: () => void;
}

const STORAGE_KEY = "intentboard-dashboard";

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeFingerprintKey(
  componentName: string,
  props: Record<string, unknown>
): string {
  // Create a stable fingerprint from component name + title prop (or first string prop)
  const title =
    (props.title as string) ??
    (props.content as string) ??
    (props.value as string) ??
    "";
  return `${componentName}::${title}`;
}

function loadFromStorage(): DashboardData {
  if (typeof window === "undefined") {
    return { id: null, name: "My Dashboard", items: [] };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { id: null, name: "My Dashboard", items: [] };
}

function saveToStorage(data: DashboardData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [dashboard, setDashboard] = useState<DashboardData>(loadFromStorage);
  const [isSaving, setIsSaving] = useState(false);

  // Persist to localStorage on every change
  useEffect(() => {
    saveToStorage(dashboard);
  }, [dashboard]);

  // Sync to server whenever items change (debounced)
  useEffect(() => {
    if (dashboard.items.length === 0 && !dashboard.id) return;

    const timeout = setTimeout(() => {
      syncToServer(dashboard).catch(() => {
        // silently ignore server save failures
      });
    }, 1500);

    return () => clearTimeout(timeout);
  }, [dashboard]);

  const pinItem = useCallback(
    (componentName: string, props: Record<string, unknown>) => {
      setDashboard((prev) => {
        // Don't add duplicates
        const fingerprint = makeFingerprintKey(componentName, props);
        const isDuplicate = prev.items.some(
          (item) => makeFingerprintKey(item.componentName, item.props) === fingerprint
        );
        if (isDuplicate) return prev;

        const label =
          (props.title as string) ||
          (props.content as string)?.slice(0, 50) ||
          componentName;

        const newItem: DashboardItem = {
          id: generateId(),
          componentName,
          props,
          label,
          pinnedAt: new Date().toISOString(),
        };

        return { ...prev, items: [...prev.items, newItem] };
      });
    },
    []
  );

  const unpinItem = useCallback((itemId: string) => {
    setDashboard((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  }, []);

  const unpinByFingerprint = useCallback(
    (componentName: string, props: Record<string, unknown>) => {
      const fingerprint = makeFingerprintKey(componentName, props);
      setDashboard((prev) => ({
        ...prev,
        items: prev.items.filter(
          (item) => makeFingerprintKey(item.componentName, item.props) !== fingerprint
        ),
      }));
    },
    []
  );

  const isItemPinned = useCallback(
    (componentName: string, props: Record<string, unknown>) => {
      const fingerprint = makeFingerprintKey(componentName, props);
      return dashboard.items.some(
        (item) => makeFingerprintKey(item.componentName, item.props) === fingerprint
      );
    },
    [dashboard.items]
  );

  const renameDashboard = useCallback((name: string) => {
    setDashboard((prev) => ({ ...prev, name }));
  }, []);

  const clearDashboard = useCallback(() => {
    setDashboard((prev) => ({ ...prev, items: [] }));
  }, []);

  return (
    <DashboardContext.Provider
      value={{
        dashboard,
        pinItem,
        unpinItem,
        unpinByFingerprint,
        isItemPinned,
        isSaving,
        renameDashboard,
        clearDashboard,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx)
    throw new Error("useDashboard must be used within DashboardProvider");
  return ctx;
}

// ── Server sync ──────────────────────────────────────────────────────────────

async function syncToServer(data: DashboardData) {
  try {
    const body = {
      name: data.name,
      description: `Dashboard with ${data.items.length} pinned items`,
      components: data.items.map((item) => ({
        id: item.id,
        componentName: item.componentName,
        props: item.props,
        label: item.label,
        pinnedAt: item.pinnedAt,
      })),
    };

    if (data.id) {
      // Update existing dashboard
      await fetch(`/api/dashboards?id=${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      // Create new dashboard
      const res = await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success && json.data?.id) {
        // Store the server ID so future saves are updates
        const updated = { ...data, id: json.data.id };
        saveToStorage(updated);
      }
    }
  } catch {
    // silently ignore
  }
}
