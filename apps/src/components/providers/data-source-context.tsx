"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  DataSourceSafe,
  ApiResponse,
} from "@/lib/types";

const API_BASE = "/api";

// ──── Context value ──────────────────────────────────────────────────────────

interface DataSourceContextValue {
  dataSources: DataSourceSafe[];
  loading: boolean;
  error: string | null;
  addDataSource: (data: {
    name: string;
    type: string;
    connectionString?: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  }) => Promise<DataSourceSafe | null>;
  removeDataSource: (id: string) => Promise<boolean>;
  testConnection: (id: string) => Promise<{ connected: boolean; error?: string }>;
  refresh: () => Promise<void>;
}

const DataSourceContext = createContext<DataSourceContextValue | null>(null);

// ──── Provider ───────────────────────────────────────────────────────────────

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [dataSources, setDataSources] = useState<DataSourceSafe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDataSources = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/data-sources`);
      const json: ApiResponse<DataSourceSafe[]> = await res.json();
      if (json.success && json.data) {
        setDataSources(json.data);
        setError(null);
      } else {
        setError(json.error || "Failed to fetch data sources");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDataSources();
  }, [fetchDataSources]);

  const addDataSource = useCallback(
    async (data: {
      name: string;
      type: string;
      connectionString?: string;
      host: string;
      port: number;
      database: string;
      username: string;
      password: string;
      ssl?: boolean;
    }): Promise<DataSourceSafe | null> => {
      try {
        const res = await fetch(`${API_BASE}/data-sources`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json: ApiResponse<DataSourceSafe> = await res.json();
        if (json.success && json.data) {
          setDataSources((prev) => [json.data!, ...prev]);
          return json.data;
        }
        setError(json.error || "Failed to add data source");
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error");
        return null;
      }
    },
    [],
  );

  const removeDataSource = useCallback(async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/data-sources/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        setDataSources((prev) => prev.filter((ds) => ds.id !== id));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const testConnection = useCallback(
    async (id: string): Promise<{ connected: boolean; error?: string }> => {
      try {
        const res = await fetch(`${API_BASE}/data-sources/${id}`, {
          method: "POST",
        });
        const json = await res.json();
        if (json.success) {
          // Refresh data sources to get updated status
          await fetchDataSources();
          return json.data;
        }
        return { connected: false, error: json.error };
      } catch (err) {
        return {
          connected: false,
          error: err instanceof Error ? err.message : "Network error",
        };
      }
    },
    [fetchDataSources],
  );

  return (
    <DataSourceContext.Provider
      value={{
        dataSources,
        loading,
        error,
        addDataSource,
        removeDataSource,
        testConnection,
        refresh: fetchDataSources,
      }}
    >
      {children}
    </DataSourceContext.Provider>
  );
}

// ──── Hook ───────────────────────────────────────────────────────────────────

export function useDataSourceContext() {
  const ctx = useContext(DataSourceContext);
  if (!ctx) {
    throw new Error(
      "useDataSourceContext must be used within DataSourceProvider",
    );
  }
  return ctx;
}
