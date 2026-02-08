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
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import type { LineChartProps } from "@/lib/types";

const CHART_COLORS = [
  "var(--color-chart-1, #2563eb)",
  "var(--color-chart-2, #e11d48)",
  "var(--color-chart-3, #16a34a)",
  "var(--color-chart-4, #f59e0b)",
  "var(--color-chart-5, #8b5cf6)",
];

export function LineChartComponent({
  title = "",
  data = [],
  xAxisLabel,
  yAxisLabel,
}: LineChartProps) {
  const safeData = data ?? [];

  // Extract all unique series names
  const seriesNames = Array.from(
    new Set(safeData.flatMap((d) => (d.series ?? []).map((s) => s.name ?? "")))
  );

  // Transform data for Recharts: { label, [seriesName]: value, ... }
  const chartData = safeData.map((point) => {
    const entry: Record<string, unknown> = { name: point.label ?? "" };
    for (const s of (point.series ?? [])) {
      entry[s.name ?? ""] = s.value ?? 0;
    }
    return entry;
  });

  const chartConfig: Record<string, { label: string; color: string }> = {};
  seriesNames.forEach((name, i) => {
    chartConfig[name] = {
      label: name,
      color: CHART_COLORS[i % CHART_COLORS.length],
    };
  });

  // Decide if we need angled labels
  const needsAngle = chartData.length > 6;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={`Line chart: ${title}. ${seriesNames.length} series, ${chartData.length} data points.`}>
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            {/* ChartContainer already provides ResponsiveContainer — do NOT nest another one */}
            <RechartsLineChart
              data={chartData}
              margin={{ top: 5, right: 20, bottom: needsAngle ? 60 : 30, left: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={needsAngle ? -45 : 0}
                textAnchor={needsAngle ? "end" : "middle"}
                height={needsAngle ? 70 : 40}
                interval={0}
                label={
                  xAxisLabel && !needsAngle
                    ? { value: xAxisLabel, position: "bottom", offset: 10 }
                    : undefined
                }
              />
              <YAxis
                tick={{ fontSize: 11 }}
                width={60}
                label={
                  yAxisLabel
                    ? { value: yAxisLabel, angle: -90, position: "insideLeft", offset: -5 }
                    : undefined
                }
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend verticalAlign="top" height={30} />
              {seriesNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={CHART_COLORS[i % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: CHART_COLORS[i % CHART_COLORS.length] }}
                  activeDot={{ r: 6 }}
                  connectNulls
                />
              ))}
            </RechartsLineChart>
          </ChartContainer>
        </div>
        {/* Screen-reader accessible data table */}
        <table className="sr-only">
          <caption>{title}</caption>
          <thead>
            <tr>
              <th>{xAxisLabel || "Label"}</th>
              {seriesNames.map((name) => (
                <th key={name}>{name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chartData.map((d, i) => (
              <tr key={i}>
                <td>{d.name as string}</td>
                {seriesNames.map((name) => (
                  <td key={name}>{d[name] as number}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
