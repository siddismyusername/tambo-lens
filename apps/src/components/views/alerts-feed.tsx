"use client";

import { useEffect, useRef } from "react";
import { useAppContext } from "@/components/providers/app-context";
import { useAnomalies } from "@/hooks/use-anomalies";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  TrendingDown,
  TrendingUp,
  X,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { AnomalyAlert } from "@/lib/types";

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    color: "text-red-500",
    bg: "bg-red-500/10",
    toastType: "error" as const,
  },
  warning: {
    icon: AlertCircle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    toastType: "warning" as const,
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    toastType: "info" as const,
  },
};

function AlertItem({
  alert,
  onDismiss,
}: {
  alert: AnomalyAlert;
  onDismiss: (id: string) => void;
}) {
  const config = severityConfig[alert.severity] ?? severityConfig.info;
  const Icon = config.icon;
  const isPositive = alert.changePercent != null && alert.changePercent > 0;

  return (
    <div
      className={`group relative p-3 rounded-lg border transition-colors ${config.bg} ${
        !alert.seen ? "border-primary/30" : "border-transparent"
      }`}
    >
      {!alert.seen && (
        <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-primary animate-pulse" />
      )}
      <div className="flex items-start gap-2.5">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-medium leading-tight">{alert.metricName}</p>
          <p className="text-xs text-muted-foreground">{alert.description}</p>

          {alert.changePercent != null && (
            <div className="flex items-center gap-1.5">
              {isPositive ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500" />
              )}
              <span
                className={`text-xs font-semibold tabular-nums ${
                  isPositive ? "text-green-600" : "text-red-600"
                }`}
              >
                {isPositive ? "+" : ""}
                {alert.changePercent.toFixed(1)}%
              </span>
              {alert.tableName && (
                <span className="text-xs text-muted-foreground">
                  · {alert.tableName}
                </span>
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={() => onDismiss(alert.id)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function AlertsFeed() {
  const { activeDataSourceId } = useAppContext();
  const {
    alerts,
    unseenCount,
    scanning,
    triggerScan,
    markSeen,
    dismiss,
  } = useAnomalies({
    dataSourceId: activeDataSourceId,
    enabled: !!activeDataSourceId,
  });

  // Track which alerts we've already toasted so we don't re-toast on poll
  const toastedRef = useRef<Set<string>>(new Set());

  // Fire toasts for new unseen alerts
  useEffect(() => {
    const newUnseen = alerts.filter(
      (a) => !a.seen && !toastedRef.current.has(a.id)
    );

    for (const alert of newUnseen) {
      toastedRef.current.add(alert.id);

      const config = severityConfig[alert.severity] ?? severityConfig.info;
      const Icon = config.icon;

      toast(alert.metricName, {
        description: alert.description,
        icon: <Icon className={`h-4 w-4 ${config.color}`} />,
        duration: alert.severity === "critical" ? 10000 : 6000,
      });
    }
  }, [alerts]);

  const handleOpen = (open: boolean) => {
    if (open) {
      // Mark all alerts as seen when the panel opens
      const unseenIds = alerts.filter((a) => !a.seen).map((a) => a.id);
      if (unseenIds.length > 0) {
        markSeen(unseenIds);
      }
    }
  };

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;

  return (
    <Sheet onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <Bell className="h-4 w-4" />
          {unseenCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
              {unseenCount > 9 ? "9+" : unseenCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[380px] sm:w-[420px] flex flex-col p-0">
        <SheetHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Anomaly Alerts
            </SheetTitle>
            {activeDataSourceId && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                disabled={scanning}
                onClick={() => triggerScan(activeDataSourceId)}
              >
                {scanning ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                {scanning ? "Scanning…" : "Re-scan"}
              </Button>
            )}
          </div>
          {alerts.length > 0 && (
            <div className="flex gap-2 mt-1">
              {criticalCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalCount} critical
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {warningCount} warnings
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        <Separator />

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-2">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="h-8 w-8 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No anomalies detected
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeDataSourceId
                    ? "Your data looks normal. We'll notify you if anything changes."
                    : "Connect a data source to enable anomaly detection."}
                </p>
                {activeDataSourceId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    disabled={scanning}
                    onClick={() => triggerScan(activeDataSourceId)}
                  >
                    {scanning ? (
                      <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                    )}
                    {scanning ? "Scanning…" : "Run Anomaly Scan"}
                  </Button>
                )}
              </div>
            ) : (
              alerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onDismiss={dismiss}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Collapsed version for the narrow sidebar — just the bell icon with badge.
 */
export function AlertsFeedCollapsed() {
  const { activeDataSourceId } = useAppContext();
  const { unseenCount } = useAnomalies({
    dataSourceId: activeDataSourceId,
    enabled: !!activeDataSourceId,
  });

  return (
    <div className="relative">
      <Bell className="h-4 w-4" />
      {unseenCount > 0 && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
          {unseenCount > 9 ? "+" : unseenCount}
        </span>
      )}
    </div>
  );
}
