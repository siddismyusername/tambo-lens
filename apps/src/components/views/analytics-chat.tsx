"use client";

import { useTambo, useTamboThreadInput } from "@tambo-ai/react";
import { useAppContext } from "@/components/providers/app-context";
import { useDashboard } from "@/components/providers/dashboard-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  Loader2,
  Bot,
  User,
  Sparkles,
  RotateCcw,
  Table2,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  LayoutGrid,
  FileText,
  Gauge,
  Pin,
  PinOff,
  Trophy,
  TrendingUp,
  Hash,
  Calendar,
  AlertTriangle as AlertTriangleIcon,
  Users,
  RefreshCw,
  FileBarChart,
  Lightbulb,
} from "lucide-react";
import { useRef, useEffect, useState, useCallback } from "react";
import { Markdown } from "@/components/ui/markdown";
import { useSuggestedQuestions } from "@/hooks/use-suggested-questions";
import { useReport } from "@/hooks/use-report";
import type { ReportThreadMessage } from "@/lib/types";

// ── Visualization picker options ─────────────────────────────────────────────

const VIZ_OPTIONS = [
  { key: "table", label: "Table", icon: Table2, description: "Rows & columns" },
  {
    key: "bar",
    label: "Bar Chart",
    icon: BarChart3,
    description: "Compare categories",
  },
  {
    key: "line",
    label: "Line Chart",
    icon: LineChartIcon,
    description: "Trends over time",
  },
  {
    key: "pie",
    label: "Pie Chart",
    icon: PieChartIcon,
    description: "Proportions",
  },
  { key: "kpi", label: "KPI Card", icon: Gauge, description: "Single metric" },
  {
    key: "grid",
    label: "Metric Grid",
    icon: LayoutGrid,
    description: "Multiple metrics",
  },
  {
    key: "summary",
    label: "Summary",
    icon: FileText,
    description: "Text analysis",
  },
] as const;

type VizType = (typeof VIZ_OPTIONS)[number]["key"];

// ── "Explain This" deep drill-down ────────────────────────────────────────────

const EXPLAINABLE_COMPONENTS = new Set([
  "BarChart",
  "LineChart",
  "PieChart",
  "DataTable",
  "MetricGrid",
  "KPICard",
]);

/**
 * Serialise a rendered component's data into a structured follow-up prompt
 * that asks the AI to investigate *why* the data looks the way it does.
 */
function buildExplainPrompt(
  componentName: string,
  props: Record<string, unknown>,
): string {
  const title = (props.title as string) || "this data";
  let dataSummary = "";

  switch (componentName) {
    case "BarChart":
    case "PieChart": {
      const points = (props.data as { label?: string; value?: number }[]) ?? [];
      const sorted = [...points].sort(
        (a, b) => (b.value ?? 0) - (a.value ?? 0),
      );
      const total = sorted.reduce((s, d) => s + (d.value ?? 0), 0);
      dataSummary = sorted
        .map(
          (d) =>
            `- ${d.label ?? "?"}: ${d.value ?? 0}${
              total > 0
                ? ` (${(((d.value ?? 0) / total) * 100).toFixed(1)}%)`
                : ""
            }`,
        )
        .join("\n");
      break;
    }
    case "LineChart": {
      const lineData =
        (props.data as { label?: string; series?: { name?: string; value?: number }[] }[]) ?? [];
      const seriesNames = Array.from(
        new Set(
          lineData.flatMap((d) => (d.series ?? []).map((s) => s.name ?? "")),
        ),
      );
      dataSummary = `Series: ${seriesNames.join(", ")}\nData points: ${lineData.length}\n`;
      // Show first, last, and max for each series
      for (const name of seriesNames) {
        const vals = lineData
          .map((d) => ({
            label: d.label ?? "",
            value: (d.series ?? []).find((s) => s.name === name)?.value ?? 0,
          }))
          .filter((v) => v.value !== 0);
        if (vals.length > 0) {
          const max = vals.reduce((a, b) => (b.value > a.value ? b : a));
          dataSummary += `- ${name}: first=${vals[0].value} (${vals[0].label}), last=${vals[vals.length - 1].value} (${vals[vals.length - 1].label}), peak=${max.value} (${max.label})\n`;
        }
      }
      break;
    }
    case "DataTable": {
      const cols = (props.columns as string[]) ?? [];
      const rows = (props.rows as string[][]) ?? [];
      dataSummary = `Columns: ${cols.join(", ")}\nRows shown: ${rows.length}${
        (props.totalRows as number) ? ` of ${props.totalRows} total` : ""
      }`;
      if (rows.length > 0 && rows.length <= 10) {
        dataSummary += "\nSample data:\n";
        dataSummary += rows
          .slice(0, 5)
          .map((r) => cols.map((c, i) => `${c}=${r[i] ?? "—"}`).join(", "))
          .join("\n");
      }
      break;
    }
    case "MetricGrid": {
      const metrics =
        (props.metrics as { title?: string; value?: unknown; change?: number }[]) ?? [];
      dataSummary = metrics
        .map(
          (m) =>
            `- ${m.title ?? "?"}: ${m.value ?? "?"}${
              m.change != null
                ? ` (${m.change > 0 ? "+" : ""}${m.change}%)`
                : ""
            }`,
        )
        .join("\n");
      break;
    }
    case "KPICard": {
      const value = props.value ?? "?";
      const change = props.change as number | undefined;
      const changeLabel = (props.changeLabel as string) || "";
      dataSummary = `Value: ${value}${
        change != null ? ` | Change: ${change > 0 ? "+" : ""}${change}%` : ""
      }${changeLabel ? ` (${changeLabel})` : ""}`;
      break;
    }
  }

  return `[EXPLAIN THIS] The visualization "${title}" (${componentName}) shows the following data:

${dataSummary}

Please act as a senior data analyst and explain WHY the data looks this way:
1. Run 2-4 follow-up queries to investigate causes — look for correlations, time-period comparisons, segment breakdowns, and contributing factors.
2. Synthesise your findings into a causal analysis.
3. Present the explanation as a SummaryCard with specific numbers and actionable highlights.`;
}

export function AnalyticsChat() {
  const { thread, generationStage } = useTambo();
  const { value, setValue, submit } = useTamboThreadInput();
  const { activeDataSourceId, setActiveView } = useAppContext();
  const { pinItem, unpinByFingerprint, isItemPinned } = useDashboard();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showVizPicker, setShowVizPicker] = useState(false);
  const [pendingQuery, setPendingQuery] = useState("");

  const isGenerating =
    generationStage !== "IDLE" &&
    generationStage !== "COMPLETE" &&
    generationStage !== "ERROR" &&
    generationStage !== "CANCELLED" &&
    generationStage !== undefined;

  // Auto-scroll to bottom on new messages or generation updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread?.messages, generationStage]);

  const doSubmit = useCallback(
    (text: string) => {
      setValue(text);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          submit();
        });
      });
    },
    [setValue, submit],
  );

  const handleSubmit = () => {
    if (!value.trim() || isGenerating) return;
    doSubmit(value);
  };

  const handleVizSelect = (viz: VizType) => {
    const vizPrompt = `${pendingQuery}\n\nShow the result as a ${VIZ_OPTIONS.find((v) => v.key === viz)?.label ?? viz}.`;
    setShowVizPicker(false);
    setPendingQuery("");
    doSubmit(vizPrompt);
  };

  const handleSkipViz = () => {
    setShowVizPicker(false);
    doSubmit(pendingQuery);
    setPendingQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const {
    questions: suggestedQuestions,
    loading: suggestionsLoading,
    regenerate: regenerateSuggestions,
    regenerating,
  } = useSuggestedQuestions({ dataSourceId: activeDataSourceId });

  const { generateReport, generating: reportGenerating } = useReport();

  const hasMessages = (thread?.messages?.length ?? 0) > 0;

  const handleGenerateReport = useCallback(async () => {
    if (!thread?.messages || thread.messages.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: ReportThreadMessage[] = thread.messages.map((m: any) => {
      const text =
        m.content
          ?.filter((c: { type: string; text?: string }) => c.type === "text")
          .map((c: { type: string; text?: string }) => c.text)
          .join("") ?? "";
      return {
        role: m.role as "user" | "assistant",
        text,
        componentName: m.component?.componentName,
        componentProps: m.component?.props,
      };
    });

    const report = await generateReport(
      mapped,
      activeDataSourceId ?? undefined,
      thread.id ?? undefined
    );

    if (report) {
      // Store report in sessionStorage so ReportView can pick it up
      sessionStorage.setItem("tambo-lens-report", JSON.stringify(report));
      setActiveView("report");
    }
  }, [thread, generateReport, activeDataSourceId, setActiveView]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Analytics Chat</h2>
          {activeDataSourceId && (
            <Badge variant="outline" className="text-xs">
              Connected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasMessages && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={handleGenerateReport}
              disabled={reportGenerating}
            >
              {reportGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileBarChart className="h-3.5 w-3.5" />
              )}
              {reportGenerating ? "Generating…" : "Generate Report"}
            </Button>
          )}
          {isGenerating && (
          <Badge variant="secondary" className="text-xs animate-pulse">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            {generationStage === "CHOOSING_COMPONENT"
              ? "Choosing visualization..."
              : generationStage === "FETCHING_CONTEXT"
                ? "Fetching data..."
                : generationStage === "HYDRATING_COMPONENT"
                  ? "Building component..."
                  : generationStage === "STREAMING_RESPONSE"
                    ? "Streaming..."
                    : "Processing..."}
          </Badge>
        )}
        </div>
      </div>

      {/* Messages — native scrollable div (not Radix ScrollArea) for reliable flex layout */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain px-6"
      >
        <div className="py-6 space-y-6 max-w-4xl mx-auto">
          {(!thread?.messages || thread.messages.length === 0) && (
            <EmptyState
              questions={suggestedQuestions}
              loading={suggestionsLoading}
              regenerating={regenerating}
              onRegenerate={regenerateSuggestions}
              onSuggestionClick={(s) => {
                setShowVizPicker(true);
                setPendingQuery(s);
              }}
              hasDataSource={!!activeDataSourceId}
            />
          )}

          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {thread?.messages?.map((message: any) => (
            <div key={message.id}>
              {message.role === "user" && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 pt-1">
                    <p className="text-sm whitespace-pre-wrap">
                      {message.content
                        ?.filter((c: { type: string; text?: string }) => c.type === "text")
                        .map((c: { type: string; text?: string }) => c.text)
                        .join("")}
                    </p>
                  </div>
                </div>
              )}

              {message.role === "assistant" && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-secondary-foreground" />
                  </div>
                  <div className="flex-1 space-y-3 pt-1 min-w-0">
                    {/* Text content rendered as Markdown */}
                    {message.content
                      ?.filter((c: { type: string; text?: string }) => c.type === "text" && c.text)
                      .map((c: { type: string; text?: string }, i: number) => (
                        <Markdown key={i} content={c.text ?? ""} />
                      ))}

                    {/* Rendered Generative UI Component — pointer-events-auto ensures interactivity */}
                    {message.renderedComponent &&
                      (() => {
                        const compName = message.component?.componentName ?? "";
                        const compProps = (message.component?.props ??
                          {}) as Record<string, unknown>;
                        const pinned = compName
                          ? isItemPinned(compName, compProps)
                          : false;

                        return (
                          <div className="mt-3 relative z-10 pointer-events-auto group">
                            {message.renderedComponent}
                            {/* Hover action buttons — Pin + Explain */}
                            {compName && (
                              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                                {EXPLAINABLE_COMPONENTS.has(compName) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 gap-1 text-xs shadow-sm bg-background/90 backdrop-blur-sm"
                                    disabled={isGenerating}
                                    onClick={() => {
                                      doSubmit(
                                        buildExplainPrompt(
                                          compName,
                                          compProps,
                                        ),
                                      );
                                    }}
                                  >
                                    <Lightbulb className="h-3 w-3" /> Why?
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant={pinned ? "secondary" : "outline"}
                                  className="h-7 gap-1 text-xs shadow-sm bg-background/90 backdrop-blur-sm"
                                  onClick={() => {
                                    if (pinned) {
                                      unpinByFingerprint(compName, compProps);
                                    } else {
                                      pinItem(compName, compProps);
                                    }
                                  }}
                                >
                                  {pinned ? (
                                    <>
                                      <PinOff className="h-3 w-3" /> Pinned
                                    </>
                                  ) : (
                                    <>
                                      <Pin className="h-3 w-3" /> Pin to
                                      Dashboard
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                </div>
              )}
            </div>
          ))}

          {isGenerating && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-secondary-foreground" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Thinking...
                </span>
              </div>
            </div>
          )}

          {/* Scroll anchor */}
          <div ref={bottomRef} />
        </div>
      </div>

      <Separator />

      {/* Visualization Picker */}
      {showVizPicker && (
        <div className="px-4 pt-3 pb-1 max-w-4xl mx-auto w-full shrink-0">
          <div className="rounded-lg border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                How would you like to see this data?
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={handleSkipViz}
              >
                Let AI decide
              </Button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1.5">
              {VIZ_OPTIONS.map((viz) => (
                <button
                  key={viz.key}
                  onClick={() => handleVizSelect(viz.key)}
                  className="flex flex-col items-center gap-1 p-2 rounded-md border bg-background hover:bg-accent hover:border-primary/40 transition-colors text-center"
                >
                  <viz.icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs font-medium leading-tight">
                    {viz.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 max-w-4xl mx-auto w-full shrink-0">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              activeDataSourceId
                ? "Ask a question about your data..."
                : "Connect a data source first, then ask questions..."
            }
            disabled={isGenerating}
            className="min-h-[48px] max-h-[200px] pr-14 resize-none"
            rows={1}
          />
          <Button
            size="icon"
            className="absolute right-2 bottom-2 h-8 w-8"
            onClick={handleSubmit}
            disabled={!value.trim() || isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Tambo Lens generates safe, read-only queries on your authorized data.
        </p>
      </div>
    </div>
  );
}

// ── Icon mapping for suggested question categories ───────────────────────────

const CATEGORY_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  trophy: Trophy,
  "trending-up": TrendingUp,
  "bar-chart": BarChart3,
  hash: Hash,
  "pie-chart": PieChartIcon,
  calendar: Calendar,
  "alert-triangle": AlertTriangleIcon,
  users: Users,
};

function EmptyState({
  questions,
  loading,
  regenerating,
  onRegenerate,
  onSuggestionClick,
  hasDataSource,
}: {
  questions: { question: string; icon?: string; category?: string }[];
  loading: boolean;
  regenerating: boolean;
  onRegenerate: () => void;
  onSuggestionClick: (s: string) => void;
  hasDataSource: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Welcome to Tambo Lens</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {hasDataSource
            ? "Ask questions about your data in natural language. Here are some suggestions based on your schema:"
            : "Connect a data source from the sidebar to get started with analytics."}
        </p>
      </div>
      {hasDataSource && (
        <>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-3 animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded bg-muted" />
                    <div className="h-4 flex-1 rounded bg-muted" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {questions.map((q, i) => {
                const IconComp =
                  CATEGORY_ICONS[q.icon ?? ""] ?? RotateCcw;
                return (
                  <Card
                    key={i}
                    className="p-3 cursor-pointer hover:bg-accent hover:border-primary/30 transition-colors group"
                    onClick={() => onSuggestionClick(q.question)}
                  >
                    <div className="flex items-center gap-2">
                      <IconComp className="h-3.5 w-3.5 text-primary/70 shrink-0 group-hover:text-primary transition-colors" />
                      <span className="text-sm">{q.question}</span>
                    </div>
                    {q.category && (
                      <Badge
                        variant="outline"
                        className="mt-1.5 text-[10px] px-1.5 py-0 h-4 capitalize text-muted-foreground"
                      >
                        {q.category}
                      </Badge>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            {regenerating ? "Generating…" : "Regenerate suggestions"}
          </Button>
        </>
      )}
    </div>
  );
}
