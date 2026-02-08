"use client";

import { KPICard } from "./kpi-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MetricGridProps } from "@/lib/types";

export function MetricGrid({ title = "", metrics = [] }: MetricGridProps) {
  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {metrics.map((metric, i) => (
            <KPICard key={i} {...metric} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
