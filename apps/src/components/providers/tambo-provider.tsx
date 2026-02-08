"use client";

// Polyfill crypto.randomUUID before @tambo-ai/react uses it
import "@/lib/polyfills";

import { TamboProvider } from "@tambo-ai/react";
import { tamboLensComponents } from "@/lib/tambo/components";
import { tamboLensTools } from "@/lib/tambo/tools";
import { useAppContext } from "@/components/providers/app-context";
import { useDataSourceContext } from "@/components/providers/data-source-context";
import { useEffect, useMemo, useRef } from "react";

interface TamboLensProviderProps {
  children: React.ReactNode;
}

export function TamboLensProvider({ children }: TamboLensProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_TAMBO_API_KEY;
  const { activeDataSourceId, setActiveDataSourceId } = useAppContext();
  const { dataSources } = useDataSourceContext();

  // Auto-select the first connected data source if none is active
  useEffect(() => {
    if (!activeDataSourceId && dataSources.length > 0) {
      const connected = dataSources.find((ds) => ds.status === "connected");
      if (connected) {
        setActiveDataSourceId(connected.id);
      } else {
        setActiveDataSourceId(dataSources[0].id);
      }
    }
  }, [activeDataSourceId, dataSources, setActiveDataSourceId]);

  // Keep refs so contextHelper closures always read fresh values
  const activeIdRef = useRef(activeDataSourceId);
  const dataSourcesRef = useRef(dataSources);

  useEffect(() => {
    activeIdRef.current = activeDataSourceId;
    dataSourcesRef.current = dataSources;
  }, [activeDataSourceId, dataSources]);

  // Build contextHelpers with stable references (Tambo reads these per-message)
  const contextHelpers = useMemo(
    () => ({
      currentTime: () => new Date().toISOString(),
      platform: () => "Tambo Lens — Intent-Driven Analytics",
      activeDataSource: () => {
        const id = activeIdRef.current;
        if (!id) return "No data source is currently selected.";
        const ds = dataSourcesRef.current.find((d) => d.id === id);
        return ds
          ? `Active data source: name="${ds.name}", id="${ds.id}", type="${ds.type}", status="${ds.status}". Use this dataSourceId for all tool calls (list_tables, describe_table, run_select_query) unless the user explicitly asks about a different source.`
          : `Active dataSourceId: "${id}". Use this for all tool calls.`;
      },
      availableDataSources: () => {
        const list = dataSourcesRef.current;
        if (list.length === 0) return "No data sources are connected yet.";
        return (
          "Connected data sources:\n" +
          list
            .map(
              (ds) =>
                `- "${ds.name}" (id: ${ds.id}, type: ${ds.type}, status: ${ds.status})`,
            )
            .join("\n")
        );
      },
      instructions: () =>
        `You are Tambo Lens AI, an analytics assistant that helps users explore their connected databases.
You ALWAYS have access to the active data source via the "activeDataSource" context — use its dataSourceId directly in tool calls. NEVER ask the user for a dataSourceId.

When users ask analytical questions:
1. Use list_tables to discover available tables (pass the active dataSourceId)
2. Use describe_table to understand schema and columns
3. Write safe SELECT queries using run_select_query
4. Present results using the appropriate visualization component

PROACTIVE ANOMALY DETECTION:
- The system automatically scans connected databases for anomalies (metric spikes, drops, unusual patterns).
- Use the get_anomalies tool when users ask about anomalies, unusual changes, what's different, or "what should I know".
- When presenting anomaly data, use the AnomalyCard component for individual anomalies.
- You can also investigate anomalies deeper by writing follow-up queries with run_select_query.

IMPORTANT SQL best practices:
- When displaying data in charts, ALWAYS use human-readable labels, not raw IDs. JOIN related tables to get names/titles instead of showing foreign key IDs.
  Example: Instead of "SELECT product_id, SUM(amount)" use "SELECT p.name, SUM(o.amount) FROM orders o JOIN products p ON o.product_id = p.id"
- Use column aliases (AS) to give clean, readable column names for chart labels.
- When a table has both an ID column and a name/title column, always prefer the name for display.

Always prefer visual representations:
- Single metrics → KPICard
- Multiple metrics → MetricGrid
- Tabular data → DataTable
- Comparisons → BarChart
- Trends over time → LineChart
- Proportions → PieChart
- Analysis narrative → SummaryCard

Be conversational, explain your findings, and suggest follow-up questions.
Never execute write operations. Only SELECT queries are safe.
Format your text responses using markdown for readability (bold, lists, etc).

EXPLAIN THIS — DEEP DRILL-DOWN:
When the user sends a message that starts with "[EXPLAIN THIS]", they have clicked the "Why?" button on a chart or visualization. This is your chance to act as a SENIOR DATA ANALYST, not just a chart generator.
The message will contain the component type and its data. Your job:
1. INVESTIGATE: Run 2-4 targeted follow-up queries using run_select_query to uncover the *why* behind the data:
   - Time comparisons (this period vs previous period)
   - Segment breakdowns (which sub-categories are driving the trend)
   - Correlation analysis (what changed at the same time)
   - Outlier investigation (which specific records are unusual)
2. SYNTHESISE: Combine your findings into a causal narrative. Don't just restate the numbers — explain the business story.
   - Example: "Revenue increased in Q3 primarily driven by Product A (+45%), while Product C declined (-12%). This coincides with the marketing campaign launched on Aug 15."
3. PRESENT: Always output a SummaryCard component with:
   - A clear, insight-driven title (e.g. "Why Revenue Spiked in Q3")
   - A narrative paragraph explaining causation, not just correlation
   - 3-5 bullet-point highlights with specific numbers
4. NEVER just describe the chart back to the user. They already see it. Dig DEEPER.
5. If a follow-up query fails or returns no useful data, explain what you tried and why the data doesn't reveal a clear cause.`,
    }),
    [],
  );

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-destructive">
            Configuration Error
          </h2>
          <p className="text-sm text-muted-foreground">
            NEXT_PUBLIC_TAMBO_API_KEY is not set. Please add it to your
            .env.local file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TamboProvider
      apiKey={apiKey}
      components={tamboLensComponents}
      tools={tamboLensTools}
      streaming={true}
      contextHelpers={contextHelpers}
    >
      {children}
    </TamboProvider>
  );
}
