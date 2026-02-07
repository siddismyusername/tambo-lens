"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayoutDashboard, Loader2, ExternalLink } from "lucide-react";

interface DashboardSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
}

export function DashboardsView() {
  const [dashboards, setDashboards] = useState<DashboardSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboards")
      .then((res) => res.json())
      .then((json) => {
        if (json.success) setDashboards(json.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Dashboards</h2>
          <Badge variant="outline">{dashboards.length}</Badge>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1 p-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : dashboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-medium">No dashboards yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Dashboards are automatically saved from your analytics conversations.
                Start chatting to create your first dashboard.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 max-w-3xl">
            {dashboards.map((db) => (
              <Card key={db.id} className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{db.name}</CardTitle>
                      {db.description && (
                        <CardDescription className="text-xs mt-1">
                          {db.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {new Date(db.createdAt).toLocaleDateString()}
                      </Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
