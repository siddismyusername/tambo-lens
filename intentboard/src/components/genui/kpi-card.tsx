"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { KPICardProps } from "@/lib/types";

export function KPICard({ title = "", value = "", change, changeLabel }: KPICardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <CardDescription className="text-sm font-medium">{title}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <CardTitle className="text-3xl font-bold tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </CardTitle>
          {change !== undefined && (
            <Badge
              variant={isPositive ? "default" : isNegative ? "destructive" : "secondary"}
              className="flex items-center gap-1"
            >
              {isPositive && <ArrowUp className="h-3 w-3" />}
              {isNegative && <ArrowDown className="h-3 w-3" />}
              {isNeutral && <Minus className="h-3 w-3" />}
              {Math.abs(change).toFixed(1)}%
            </Badge>
          )}
        </div>
        {changeLabel && (
          <p className="text-xs text-muted-foreground mt-1">{changeLabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
