"use client";

import { useAppContext } from "@/components/providers/app-context";
import { useDataSources } from "@/hooks/use-data-sources";
import { useSession, signOut } from "next-auth/react";
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
  LogOut,
  User,
  Sparkles,
  ShieldCheck,
  BellRing,
  FileText,
  Lock,
  SearchCode,
  BarChart3,
} from "lucide-react";
import { AlertsFeed, AlertsFeedCollapsed } from "@/components/views/alerts-feed";

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
  const { data: session } = useSession();

  const navItems = [
    { key: "chat" as const, label: "Analytics Chat", icon: MessageSquare },
    { key: "sources" as const, label: "Data Sources", icon: Database },
    { key: "schema" as const, label: "Schema Browser", icon: TableProperties },
    { key: "permissions" as const, label: "Permissions", icon: Shield },
    { key: "dashboards" as const, label: "Dashboards", icon: LayoutDashboard },
  ];

  const featureItems = [
    { label: "Generative UI", icon: Sparkles, badge: "7 components" },
    { label: "Query Guardrails", icon: ShieldCheck, badge: "Active" },
    { label: "Anomaly Detection", icon: BellRing, badge: null },
    { label: "Report Builder", icon: FileText, badge: null },
    { label: "Encrypted Vault", icon: Lock, badge: "AES-256" },
    { label: "Schema Discovery", icon: SearchCode, badge: null },
    { label: "Charts & Visuals", icon: BarChart3, badge: null },
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
        {featureItems.map((item) => (
          <div
            key={item.label}
            className="h-8 w-8 flex items-center justify-center"
            title={item.label}
          >
            <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        ))}
        <Separator />
        <AlertsFeed />
        <Separator />
        <ChatHistoryPanel collapsed />
        <div className="mt-auto">
          <Separator />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mt-2"
            onClick={() => signOut()}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
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
        <div className="flex items-center gap-1">
          <AlertsFeed />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setSidebarOpen(false)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
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

      {/* Features */}
      <div className="p-3">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Features
        </span>
        <div className="mt-2 space-y-0.5">
          {featureItems.map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-foreground"
            >
              <item.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="flex-1 truncate text-xs">{item.label}</span>
              {item.badge && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 shrink-0">
                  {item.badge}
                </Badge>
              )}
            </div>
          ))}
        </div>
      </div>

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

      {/* User Footer */}
      {session?.user && (
        <>
          <Separator />
          <div className="p-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">
                  {session.user.name}
                </p>
                {(session.user as { isDemo?: boolean }).isDemo && (
                  <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4 shrink-0">
                    Demo
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {session.user.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => signOut()}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
