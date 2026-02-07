"use client";

import type { TamboComponent } from "@tambo-ai/react";
import {
  kpiCardPropsSchema,
  dataTablePropsSchema,
  barChartPropsSchema,
  lineChartPropsSchema,
  pieChartPropsSchema,
  summaryCardPropsSchema,
  metricGridPropsSchema,
} from "@/lib/schemas";
import { KPICard } from "@/components/genui/kpi-card";
import { DataTable } from "@/components/genui/data-table";
import { BarChartComponent } from "@/components/genui/bar-chart";
import { LineChartComponent } from "@/components/genui/line-chart";
import { PieChartComponent } from "@/components/genui/pie-chart";
import { SummaryCard } from "@/components/genui/summary-card";
import { MetricGrid } from "@/components/genui/metric-grid";

/**
 * All Generative UI components registered with Tambo.
 *
 * The AI will select which component to render based on user intent
 * and the available data shape. All components use shadcn/ui primitives.
 */
export const intentBoardComponents: TamboComponent[] = [
  {
    name: "KPICard",
    description:
      "Displays a single key performance indicator with a numeric value, optional percentage change indicator, and optional change label. Use for individual metrics like revenue, user count, conversion rate, etc.",
    component: KPICard,
    propsSchema: kpiCardPropsSchema,
  },
  {
    name: "DataTable",
    description:
      "Renders a scrollable data table with column headers and rows. Use for tabular data, query results, lists of records, leaderboards, and any structured multi-row data.",
    component: DataTable,
    propsSchema: dataTablePropsSchema,
  },
  {
    name: "BarChart",
    description:
      "Renders a bar chart for comparing categorical data. Use for showing distributions, rankings, comparisons between categories like sales per region, revenue per product, counts by type.",
    component: BarChartComponent,
    propsSchema: barChartPropsSchema,
  },
  {
    name: "LineChart",
    description:
      "Renders a line chart for time-series or sequential data. Supporting multiple series. Use for trends over time, growth curves, comparative time-based data like monthly revenue, daily active users.",
    component: LineChartComponent,
    propsSchema: lineChartPropsSchema,
  },
  {
    name: "PieChart",
    description:
      "Renders a pie/donut chart for proportional data. Use for market share, percentage breakdowns, composition analysis like revenue by category, user distribution by platform.",
    component: PieChartComponent,
    propsSchema: pieChartPropsSchema,
  },
  {
    name: "SummaryCard",
    description:
      "Displays a text-based analysis summary with optional bullet-point highlights. Use for qualitative insights, AI-generated analysis narratives, executive summaries, and data stories.",
    component: SummaryCard,
    propsSchema: summaryCardPropsSchema,
  },
  {
    name: "MetricGrid",
    description:
      "Displays a grid of multiple KPI cards. Use when showing a dashboard overview of several metrics at once like total users + revenue + conversion rate + churn rate.",
    component: MetricGrid,
    propsSchema: metricGridPropsSchema,
  },
];
