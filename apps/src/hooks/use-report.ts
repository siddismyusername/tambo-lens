"use client";

import { useState, useCallback } from "react";
import type { Report, ReportThreadMessage } from "@/lib/types";

interface UseReportReturn {
  /** The latest generated / fetched report */
  report: Report | null;
  /** Whether a generation or fetch is in progress */
  generating: boolean;
  /** Error message if the last operation failed */
  error: string | null;
  /** Generate a new report from the current thread messages */
  generateReport: (
    messages: ReportThreadMessage[],
    dataSourceId?: string,
    threadId?: string
  ) => Promise<Report | null>;
  /** Fetch an existing report by ID */
  fetchReport: (id: string) => Promise<Report | null>;
  /** Fetch a report by share token (public) */
  fetchByShareToken: (id: string, token: string) => Promise<Report | null>;
  /** Clear the current report */
  clear: () => void;
}

export function useReport(): UseReportReturn {
  const [report, setReport] = useState<Report | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReportFn = useCallback(
    async (
      messages: ReportThreadMessage[],
      dataSourceId?: string,
      threadId?: string
    ): Promise<Report | null> => {
      setGenerating(true);
      setError(null);

      try {
        const res = await fetch("/api/reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, dataSourceId, threadId }),
        });

        const json = await res.json();

        if (!json.success) {
          setError(json.error ?? "Report generation failed");
          return null;
        }

        setReport(json.data as Report);
        return json.data as Report;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError(msg);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  const fetchReport = useCallback(async (id: string): Promise<Report | null> => {
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch(`/api/reports/${id}`);
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Failed to fetch report");
        return null;
      }

      setReport(json.data as Report);
      return json.data as Report;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      return null;
    } finally {
      setGenerating(false);
    }
  }, []);

  const fetchByShareToken = useCallback(
    async (id: string, token: string): Promise<Report | null> => {
      setGenerating(true);
      setError(null);

      try {
        const res = await fetch(`/api/reports/${id}?token=${encodeURIComponent(token)}`);
        const json = await res.json();

        if (!json.success) {
          setError(json.error ?? "Failed to fetch report");
          return null;
        }

        setReport(json.data as Report);
        return json.data as Report;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError(msg);
        return null;
      } finally {
        setGenerating(false);
      }
    },
    []
  );

  const clear = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return {
    report,
    generating,
    error,
    generateReport: generateReportFn,
    fetchReport,
    fetchByShareToken,
    clear,
  };
}
