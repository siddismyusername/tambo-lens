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
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { BarChartProps } from "@/lib/types";

const CHART_COLORS = [
  "var(--color-chart-1, #2563eb)",
  "var(--color-chart-2, #e11d48)",
  "var(--color-chart-3, #16a34a)",
  "var(--color-chart-4, #f59e0b)",
  "var(--color-chart-5, #8b5cf6)",
];

export function BarChartComponent({
  title = "",
  data = [],
  xAxisLabel,
  yAxisLabel,
}: BarChartProps) {
  const chartData = (data ?? []).map((d, i) => ({
    name: d.label ?? "",
    value: d.value ?? 0,
    fill: d.color || CHART_COLORS[i % CHART_COLORS.length],
  }));

  const chartConfig = {
    value: {
      label: yAxisLabel || "Value",
      color: CHART_COLORS[0],
    },
  };

  const needsAngle = chartData.length > 6;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[350px] w-full">
          {/* ChartContainer already provides ResponsiveContainer */}
          <RechartsBarChart
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
            <Bar dataKey="value" radius={[4, 4, 0, 0]} />
          </RechartsBarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
