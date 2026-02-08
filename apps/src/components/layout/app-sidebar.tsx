"use client";

import { useAppContext } from "@/components/providers/app-context";
import { useDataSources } from "@/hooks/use-data-sources";
import { ChatHistoryPanel } from "@/components/views/chat-history-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Database,
  MessageSquare,
  TableProperties,
  Shield,
  LayoutDashboard,
  Plus,
  ChevronLeft,
  ChevronRight,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";

export function AppSidebar() {
  const {
    activeView,
    setActiveView,
    activeDataSourceId,
    setActiveDataSourceId,
    sidebarOpen,
    setSidebarOpen,
  } = useAppContext();

  const { dataSources, loading } = useDataSources();

  const navItems = [
    { key: "chat" as const, label: "Analytics Chat", icon: MessageSquare },
    { key: "sources" as const, label: "Data Sources", icon: Database },
    { key: "schema" as const, label: "Schema Browser", icon: TableProperties },
    { key: "permissions" as const, label: "Permissions", icon: Shield },
    { key: "dashboards" as const, label: "Dashboards", icon: LayoutDashboard },
  ];

  const statusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <Wifi className="h-3 w-3 text-green-500" />;
      case "error":
        return <AlertCircle className="h-3 w-3 text-destructive" />;
      default:
        return <WifiOff className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (!sidebarOpen) {
    return (
      <div className="w-12 shrink-0 border-r bg-sidebar flex flex-col items-center py-4 gap-2 h-full">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setSidebarOpen(true)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Separator />
        {navItems.map((item) => (
          <Button
            key={item.key}
            variant={activeView === item.key ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setActiveView(item.key)}
            title={item.label}
          >
            <item.icon className="h-4 w-4" />
          </Button>
        ))}
        <Separator />
        <ChatHistoryPanel collapsed />
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 border-r bg-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h1 className="font-semibold text-base">Tambo Lens</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setSidebarOpen(false)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="p-2 space-y-1">
        {navItems.map((item) => (
          <Button
            key={item.key}
            variant={activeView === item.key ? "secondary" : "ghost"}
            className="w-full justify-start gap-2 h-9 text-sm"
            onClick={() => setActiveView(item.key)}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Button>
        ))}
      </nav>

      <Separator />

      {/* Chat History */}
      <div className="p-3">
        <ChatHistoryPanel />
      </div>

      <Separator />

      {/* Data Sources */}
      <div className="p-3 flex-1 min-h-0 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Data Sources
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setActiveView("sources")}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-1">
            {loading ? (
              <p className="text-xs text-muted-foreground px-2 py-1">
                Loading...
              </p>
            ) : dataSources.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">
                No sources connected
              </p>
            ) : (
              dataSources.map((ds) => (
                <button
                  key={ds.id}
                  onClick={() => setActiveDataSourceId(ds.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors hover:bg-sidebar-accent ${
                    activeDataSourceId === ds.id
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground"
                  }`}
                >
                  {statusIcon(ds.status)}
                  <span className="truncate flex-1">{ds.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1 py-0 h-4"
                  >
                    {ds.type === "postgresql"
                      ? "PG"
                      : ds.type === "mysql"
                        ? "MY"
                        : "MG"}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
