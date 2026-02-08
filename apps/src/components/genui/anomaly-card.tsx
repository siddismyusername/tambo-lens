"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingDown,
  TrendingUp,
  Table2,
} from "lucide-react";
import type { AnomalyCardProps } from "@/lib/types";

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-500/10 border-red-500/20",
    badge: "destructive" as const,
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-500",
    bg: "bg-amber-500/10 border-amber-500/20",
    badge: "secondary" as const,
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-500/10 border-blue-500/20",
    badge: "outline" as const,
  },
};

export function AnomalyCard({
  severity = "info",
  metricName = "",
  description = "",
  detail,
  changePercent,
  currentValue,
  previousValue,
  tableName,
}: AnomalyCardProps) {
  const config = severityConfig[severity] ?? severityConfig.info;
  const Icon = config.icon;
  const isPositive =
    changePercent !== undefined && changePercent !== null && changePercent > 0;

  return (
    <Card className={`w-full border ${config.bg}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`h-5 w-5 shrink-0 ${config.color}`} />
            <CardTitle className="text-sm font-semibold leading-tight truncate">
              {metricName}
            </CardTitle>
          </div>
          <Badge variant={config.badge} className="shrink-0 text-xs capitalize">
            {severity}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{description}</p>

        {/* Change indicator */}
        {changePercent !== undefined && changePercent !== null && (
          <div className="flex items-center gap-2">
            {isPositive ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
            <span
              className={`text-lg font-bold tabular-nums ${isPositive ? "text-green-600" : "text-red-600"}`}
            >
              {isPositive ? "+" : ""}
              {changePercent.toFixed(1)}%
            </span>
          </div>
        )}

        {/* Current vs Previous */}
        {(currentValue || previousValue) && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            {currentValue && (
              <span>
                Current: <span className="font-medium text-foreground">{currentValue}</span>
              </span>
            )}
            {previousValue && (
              <span>
                Previous: <span className="font-medium text-foreground">{previousValue}</span>
              </span>
            )}
          </div>
        )}

        {/* Table source */}
        {tableName && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Table2 className="h-3 w-3" />
            <span>{tableName}</span>
          </div>
        )}

        {/* Detail */}
        {detail && (
          <p className="text-xs text-muted-foreground border-t pt-2">{detail}</p>
        )}
      </CardContent>
    </Card>
  );
}
