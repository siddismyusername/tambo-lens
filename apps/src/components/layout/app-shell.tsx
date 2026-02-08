"use client";

import { useAppContext } from "@/components/providers/app-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AnalyticsChat } from "@/components/views/analytics-chat";
import { DataSourcesView } from "@/components/views/data-sources-view";
import { SchemaBrowserView } from "@/components/views/schema-browser-view";
import { PermissionsView } from "@/components/views/permissions-view";
import { DashboardsView } from "@/components/views/dashboards-view";
import { ReportView } from "@/components/views/report-view";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import type { Report } from "@/lib/types";

export function AppShell() {
  const { activeView, sidebarOpen, setSidebarOpen } = useAppContext();
  const [currentReport, setCurrentReport] = useState<Report | null>(null);
  const isMobile = useIsMobile();

  // Auto-collapse sidebar on mobile
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile, setSidebarOpen]);

  // Close sidebar when switching views on mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) setSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

  // Load report from sessionStorage when view switches to "report"
  useEffect(() => {
    if (activeView === "report") {
      try {
        const raw = sessionStorage.getItem("tambo-lens-report");
        if (raw) setCurrentReport(JSON.parse(raw));
      } catch {
        // ignore
      }
    }
  }, [activeView]);

  const renderView = () => {
    switch (activeView) {
      case "chat":
        return <AnalyticsChat />;
      case "sources":
        return <DataSourcesView />;
      case "schema":
        return <SchemaBrowserView />;
      case "permissions":
        return <PermissionsView />;
      case "dashboards":
        return <DashboardsView />;
      case "report":
        return currentReport ? <ReportView report={currentReport} /> : <AnalyticsChat />;
      default:
        return <AnalyticsChat />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar — on mobile it becomes a fixed overlay */}
      <div
        className={
          isMobile
            ? `fixed inset-y-0 left-0 z-50 transition-transform duration-200 ${
                sidebarOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : ""
        }
      >
        <AppSidebar />
      </div>
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {isMobile && !sidebarOpen && (
          <div className="flex items-center gap-2 p-2 border-b bg-background">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-sm font-medium">Tambo Lens</span>
          </div>
        )}
        {renderView()}
      </main>
    </div>
  );
}
