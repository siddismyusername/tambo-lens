"use client";

import { TamboProvider } from "@tambo-ai/react";
import { intentBoardComponents } from "@/lib/tambo/components";
import { intentBoardTools } from "@/lib/tambo/tools";
import { useAppContext } from "@/components/providers/app-context";
import { useDataSources } from "@/hooks/use-data-sources";
import { useEffect, useMemo, useRef } from "react";

interface IntentBoardProviderProps {
  children: React.ReactNode;
}

export function IntentBoardProvider({ children }: IntentBoardProviderProps) {
  const apiKey = process.env.NEXT_PUBLIC_TAMBO_API_KEY;
  const { activeDataSourceId, setActiveDataSourceId } = useAppContext();
  const { dataSources } = useDataSources();

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
  activeIdRef.current = activeDataSourceId;
  const dataSourcesRef = useRef(dataSources);
  dataSourcesRef.current = dataSources;

  // Build contextHelpers with stable references (Tambo reads these per-message)
  const contextHelpers = useMemo(
    () => ({
      currentTime: () => new Date().toISOString(),
      platform: () => "IntentBoard — Intent-Driven Analytics",
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
                `- "${ds.name}" (id: ${ds.id}, type: ${ds.type}, status: ${ds.status})`
            )
            .join("\n")
        );
      },
      instructions: () =>
        `You are IntentBoard AI, an analytics assistant that helps users explore their connected databases.
You ALWAYS have access to the active data source via the "activeDataSource" context — use its dataSourceId directly in tool calls. NEVER ask the user for a dataSourceId.

When users ask analytical questions:
1. Use list_tables to discover available tables (pass the active dataSourceId)
2. Use describe_table to understand schema and columns
3. Write safe SELECT queries using run_select_query
4. Present results using the appropriate visualization component

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
Format your text responses using markdown for readability (bold, lists, etc).`,
    }),
    []
  );

  if (!apiKey) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center space-y-2">
          <h2 className="text-lg font-semibold text-destructive">
            Configuration Error
          </h2>
          <p className="text-sm text-muted-foreground">
            NEXT_PUBLIC_TAMBO_API_KEY is not set. Please add it to your .env.local file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <TamboProvider
      apiKey={apiKey}
      components={intentBoardComponents}
      tools={intentBoardTools}
      streaming={true}
      contextHelpers={contextHelpers}
    >
      {children}
    </TamboProvider>
  );
}
