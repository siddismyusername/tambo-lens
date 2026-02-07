"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { PieChartProps } from "@/lib/types";

const CHART_COLORS = [
  "var(--color-chart-1, #2563eb)",
  "var(--color-chart-2, #e11d48)",
  "var(--color-chart-3, #16a34a)",
  "var(--color-chart-4, #f59e0b)",
  "var(--color-chart-5, #8b5cf6)",
];

export function PieChartComponent({ title = "", data = [] }: PieChartProps) {
  const chartData = (data ?? []).map((d, i) => ({
    name: d.label ?? "",
    value: d.value ?? 0,
    fill: d.color || CHART_COLORS[i % CHART_COLORS.length],
  }));

  const chartConfig: Record<string, { label: string; color: string }> = {};
  (data ?? []).forEach((d, i) => {
    chartConfig[d.label ?? ""] = {
      label: d.label ?? "",
      color: d.color || CHART_COLORS[i % CHART_COLORS.length],
    };
  });

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          <RechartsPieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={40}
              paddingAngle={2}
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {chartData.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.fill}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <ChartTooltip content={<ChartTooltipContent />} />
            <Legend verticalAlign="bottom" height={30} />
          </RechartsPieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
