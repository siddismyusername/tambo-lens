"use client";

import { useAppContext } from "@/components/providers/app-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AnalyticsChat } from "@/components/views/analytics-chat";
import { DataSourcesView } from "@/components/views/data-sources-view";
import { SchemaBrowserView } from "@/components/views/schema-browser-view";
import { PermissionsView } from "@/components/views/permissions-view";
import { DashboardsView } from "@/components/views/dashboards-view";

export function AppShell() {
  const { activeView } = useAppContext();

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
      default:
        return <AnalyticsChat />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <AppSidebar />
      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        {renderView()}
      </main>
    </div>
  );
}
