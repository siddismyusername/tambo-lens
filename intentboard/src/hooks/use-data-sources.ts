"use client";

import { useState, useEffect, useCallback } from "react";
import type {
  DataSourceSafe,
  DatabaseSchema,
  DataSourcePermissions,
} from "@/lib/types";
import type { ApiResponse } from "@/lib/types";

const API_BASE = "/api";

// ──── Data Sources ───────────────────────────────────────────────────────────

export function useDataSources() {
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

  const addDataSource = async (data: {
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
  };

  const removeDataSource = async (id: string): Promise<boolean> => {
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
  };

  const testConnection = async (
    id: string
  ): Promise<{ connected: boolean; error?: string }> => {
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
  };

  return {
    dataSources,
    loading,
    error,
    addDataSource,
    removeDataSource,
    testConnection,
    refresh: fetchDataSources,
  };
}

// ──── Schema ─────────────────────────────────────────────────────────────────

export function useSchema(dataSourceId: string | null) {
  const [schema, setSchema] = useState<DatabaseSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchema = useCallback(async () => {
    if (!dataSourceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/data-sources/${dataSourceId}/schema`
      );
      const json: ApiResponse<DatabaseSchema> = await res.json();
      if (json.success && json.data) {
        setSchema(json.data);
      } else {
        setError(json.error || "Failed to fetch schema");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [dataSourceId]);

  useEffect(() => {
    fetchSchema();
  }, [fetchSchema]);

  const refreshSchema = async () => {
    if (!dataSourceId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/data-sources/${dataSourceId}/schema`,
        { method: "POST" }
      );
      const json: ApiResponse<DatabaseSchema> = await res.json();
      if (json.success && json.data) {
        setSchema(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  return { schema, loading, error, refreshSchema };
}

// ──── Permissions ────────────────────────────────────────────────────────────

export function usePermissions(dataSourceId: string | null) {
  const [permissions, setPermissions] =
    useState<DataSourcePermissions | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!dataSourceId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/data-sources/${dataSourceId}/permissions`
      );
      const json: ApiResponse<DataSourcePermissions> = await res.json();
      if (json.success && json.data) {
        setPermissions(json.data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [dataSourceId]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  const updatePermissions = async (
    perms: {
      tableName: string;
      allowed: boolean;
      maskedColumns?: string[];
      rowLimit?: number;
    }[]
  ): Promise<boolean> => {
    if (!dataSourceId) return false;
    try {
      const res = await fetch(
        `${API_BASE}/data-sources/${dataSourceId}/permissions`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions: perms }),
        }
      );
      const json: ApiResponse<DataSourcePermissions> = await res.json();
      if (json.success && json.data) {
        setPermissions(json.data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  return { permissions, loading, updatePermissions, refresh: fetchPermissions };
}
