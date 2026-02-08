"use client";

import {
  useDashboard,
  type DashboardItem,
} from "@/components/providers/dashboard-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LayoutDashboard, Pin, Trash2, X, Sparkles } from "lucide-react";

// ── Import all GenUI components so we can reconstruct them from saved props ──
import { KPICard } from "@/components/genui/kpi-card";
import { DataTable } from "@/components/genui/data-table";
import { BarChartComponent } from "@/components/genui/bar-chart";
import { LineChartComponent } from "@/components/genui/line-chart";
import { PieChartComponent } from "@/components/genui/pie-chart";
import { SummaryCard } from "@/components/genui/summary-card";
import { MetricGrid } from "@/components/genui/metric-grid";

// ── Component registry for reconstructing saved items ────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const COMPONENT_MAP: Record<string, React.ComponentType<any>> = {
  KPICard,
  DataTable,
  BarChart: BarChartComponent,
  BarChartComponent,
  LineChart: LineChartComponent,
  LineChartComponent,
  PieChart: PieChartComponent,
  PieChartComponent,
  SummaryCard,
  MetricGrid,
};

function renderDashboardItem(item: DashboardItem): React.ReactNode {
  const Component = COMPONENT_MAP[item.componentName];
  if (!Component) {
    return (
      <Card className="w-full">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Unknown component: {item.componentName}
        </CardContent>
      </Card>
    );
  }
  return <Component {...item.props} />;
}

// ── Size hints based on component type ───────────────────────────────────────

function getGridSpan(componentName: string): string {
  switch (componentName) {
    case "KPICard":
      return "col-span-1";
    case "MetricGrid":
    case "DataTable":
      return "col-span-1 md:col-span-2";
    case "BarChart":
    case "BarChartComponent":
    case "LineChart":
    case "LineChartComponent":
    case "PieChart":
    case "PieChartComponent":
      return "col-span-1 md:col-span-2 lg:col-span-1";
    case "SummaryCard":
      return "col-span-1 md:col-span-2";
    default:
      return "col-span-1";
  }
}

export function DashboardsView() {
  const { dashboard, unpinItem, clearDashboard } = useDashboard();
  const { items, name } = dashboard;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">{name}</h2>
          <Badge variant="outline">
            {items.length} {items.length === 1 ? "item" : "items"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-destructive hover:text-destructive"
              onClick={clearDashboard}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Dashboard grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {items.length === 0 ? (
          <EmptyDashboard />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-6xl mx-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className={`relative group ${getGridSpan(item.componentName)}`}
              >
                {/* Remove button — visible on hover */}
                <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="h-6 w-6 shadow-sm bg-background/90 backdrop-blur-sm"
                    onClick={() => unpinItem(item.id)}
                    title="Remove from dashboard"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {/* Rendered component */}
                {renderDashboardItem(item)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-6">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Pin className="h-8 w-8 text-primary" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">No pinned items yet</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          When the AI generates charts, tables, or KPIs in the chat, hover over
          them and click <strong>&quot;Pin to Dashboard&quot;</strong> to save
          them here permanently.
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>Pinned items persist across sessions</span>
      </div>
    </div>
  );
}
