"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AnomalyAlert } from "@/lib/types";

const POLL_INTERVAL_MS = 30_000; // poll every 30s for new alerts

interface UseAnomaliesOptions {
  dataSourceId?: string | null;
  enabled?: boolean;
}

interface UseAnomaliesReturn {
  alerts: AnomalyAlert[];
  unseenCount: number;
  loading: boolean;
  scanning: boolean;
  error: string | null;
  triggerScan: (dsId: string) => Promise<void>;
  markSeen: (alertIds: string[]) => Promise<void>;
  dismiss: (alertId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useAnomalies({
  dataSourceId,
  enabled = true,
}: UseAnomaliesOptions = {}): UseAnomaliesReturn {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAlerts = useCallback(async () => {
    if (!enabled) return;
    try {
      const url = dataSourceId
        ? `/api/anomalies?dataSourceId=${dataSourceId}`
        : `/api/anomalies`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success && json.data) {
        setAlerts(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch alerts");
    }
  }, [dataSourceId, enabled]);

  // Initial fetch + polling
  useEffect(() => {
    if (!enabled) return;

    setLoading(true);
    fetchAlerts().finally(() => setLoading(false));

    intervalRef.current = setInterval(fetchAlerts, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAlerts, enabled]);

  const triggerScan = useCallback(
    async (dsId: string) => {
      setScanning(true);
      setError(null);
      try {
        const res = await fetch("/api/anomalies/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataSourceId: dsId }),
        });
        const json = await res.json();
        if (!json.success) {
          setError(json.error || "Scan failed");
        }
        // Refetch alerts after scan completes
        await fetchAlerts();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Scan failed");
      } finally {
        setScanning(false);
      }
    },
    [fetchAlerts]
  );

  const markSeen = useCallback(async (alertIds: string[]) => {
    if (alertIds.length === 0) return;
    try {
      await fetch("/api/anomalies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seen", alertIds }),
      });
      setAlerts((prev) =>
        prev.map((a) =>
          alertIds.includes(a.id) ? { ...a, seen: true } : a
        )
      );
    } catch {
      // Silent fail for mark-seen
    }
  }, []);

  const dismiss = useCallback(async (alertId: string) => {
    try {
      await fetch("/api/anomalies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", alertId }),
      });
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch {
      // Silent fail for dismiss
    }
  }, []);

  const unseenCount = alerts.filter((a) => !a.seen).length;

  return {
    alerts,
    unseenCount,
    loading,
    scanning,
    error,
    triggerScan,
    markSeen,
    dismiss,
    refetch: fetchAlerts,
  };
}
