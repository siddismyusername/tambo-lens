"use client";

import { useState, useEffect, useCallback } from "react";
import type { SuggestedQuestion } from "@/lib/types";

interface UseSuggestedQuestionsOptions {
  dataSourceId?: string | null;
}

interface UseSuggestedQuestionsReturn {
  questions: SuggestedQuestion[];
  loading: boolean;
  regenerate: () => Promise<void>;
  regenerating: boolean;
}

// Hardcoded fallbacks when no data source is connected or no generated questions yet
const FALLBACK_QUESTIONS: SuggestedQuestion[] = [
  {
    id: "fb-1",
    dataSourceId: "",
    question: "Show me total revenue by month",
    category: "trend",
    icon: "trending-up",
    sortOrder: 0,
    createdAt: "",
  },
  {
    id: "fb-2",
    dataSourceId: "",
    question: "What are our top 10 customers?",
    category: "ranking",
    icon: "trophy",
    sortOrder: 1,
    createdAt: "",
  },
  {
    id: "fb-3",
    dataSourceId: "",
    question: "Display user signup trends",
    category: "trend",
    icon: "trending-up",
    sortOrder: 2,
    createdAt: "",
  },
  {
    id: "fb-4",
    dataSourceId: "",
    question: "Give me a KPI dashboard overview",
    category: "overview",
    icon: "hash",
    sortOrder: 3,
    createdAt: "",
  },
  {
    id: "fb-5",
    dataSourceId: "",
    question: "Compare sales across regions",
    category: "comparison",
    icon: "bar-chart",
    sortOrder: 4,
    createdAt: "",
  },
];

export function useSuggestedQuestions({
  dataSourceId,
}: UseSuggestedQuestionsOptions = {}): UseSuggestedQuestionsReturn {
  const [questions, setQuestions] = useState<SuggestedQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const fetchQuestions = useCallback(async () => {
    if (!dataSourceId) {
      setQuestions(FALLBACK_QUESTIONS);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/suggestions?dataSourceId=${dataSourceId}`
      );
      const json = await res.json();
      if (json.success && json.data && json.data.length > 0) {
        setQuestions(json.data);
      } else {
        setQuestions(FALLBACK_QUESTIONS);
      }
    } catch {
      setQuestions(FALLBACK_QUESTIONS);
    } finally {
      setLoading(false);
    }
  }, [dataSourceId]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const regenerate = useCallback(async () => {
    if (!dataSourceId) return;

    setRegenerating(true);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSourceId }),
      });
      const json = await res.json();
      if (json.success) {
        // Refetch to get full objects with IDs
        await fetchQuestions();
      }
    } catch {
      // Silent fail
    } finally {
      setRegenerating(false);
    }
  }, [dataSourceId, fetchQuestions]);

  return { questions, loading, regenerate, regenerating };
}
