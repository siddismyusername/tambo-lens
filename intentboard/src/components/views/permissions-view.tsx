"use client";

import { useState, useEffect } from "react";
import { useAppContext } from "@/components/providers/app-context";
import { useSchema, usePermissions } from "@/hooks/use-data-sources";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Shield,
  Database,
  Save,
  Loader2,
  CheckCircle2,
  Lock,
  Unlock,
  Eye,
  EyeOff,
} from "lucide-react";

interface LocalPermission {
  tableName: string;
  allowed: boolean;
  maskedColumns: string[];
  rowLimit: number;
}

export function PermissionsView() {
  const { activeDataSourceId } = useAppContext();
  const { schema } = useSchema(activeDataSourceId);
  const { permissions, updatePermissions, loading } =
    usePermissions(activeDataSourceId);
  const [localPerms, setLocalPerms] = useState<LocalPermission[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Initialize local permissions from schema + existing permissions
  useEffect(() => {
    if (!schema?.tables) return;

    const existingMap = new Map(
      permissions?.permissions.map((p) => [p.tableName, p]) ?? []
    );

    setLocalPerms(
      schema.tables.map((table) => {
        const existing = existingMap.get(table.name);
        return {
          tableName: table.name,
          allowed: existing?.allowed ?? false,
          maskedColumns: existing?.maskedColumns ?? [],
          rowLimit: existing?.rowLimit ?? 1000,
        };
      })
    );
  }, [schema, permissions]);

  const toggleTable = (tableName: string) => {
    setLocalPerms((prev) =>
      prev.map((p) =>
        p.tableName === tableName ? { ...p, allowed: !p.allowed } : p
      )
    );
    setSaved(false);
  };

  const setRowLimit = (tableName: string, limit: number) => {
    setLocalPerms((prev) =>
      prev.map((p) =>
        p.tableName === tableName ? { ...p, rowLimit: limit } : p
      )
    );
    setSaved(false);
  };

  const toggleAllTables = (allowed: boolean) => {
    setLocalPerms((prev) => prev.map((p) => ({ ...p, allowed })));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const success = await updatePermissions(localPerms);
    setSaving(false);
    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const allowedCount = localPerms.filter((p) => p.allowed).length;

  if (!activeDataSourceId) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3">
        <Database className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Select a data source from the sidebar to manage permissions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">AI Permissions</h2>
          <Badge variant="outline">
            {allowedCount}/{localPerms.length} tables allowed
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {saved && (
            <Badge variant="default" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Saved
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAllTables(true)}
          >
            <Unlock className="h-3 w-3 mr-1" />
            Allow All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleAllTables(false)}
          >
            <Lock className="h-3 w-3 mr-1" />
            Deny All
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="gap-1"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Save Permissions
          </Button>
        </div>
      </div>

      {/* Permissions list */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl space-y-3 mx-auto">
          <Card className="bg-muted/50">
            <CardContent className="py-3">
              <p className="text-sm text-muted-foreground">
                <Shield className="h-4 w-4 inline mr-1" />
                Control which tables the AI can query. Only allowed tables will be
                accessible in analytics conversations. Row limits prevent
                excessive data retrieval.
              </p>
            </CardContent>
          </Card>

          {loading && !localPerms.length ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            localPerms.map((perm) => {
              const table = schema?.tables.find(
                (t) => t.name === perm.tableName
              );

              return (
                <Card
                  key={perm.tableName}
                  className={
                    perm.allowed ? "border-primary/30" : "opacity-60"
                  }
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={perm.allowed}
                          onCheckedChange={() => toggleTable(perm.tableName)}
                        />
                        <div>
                          <CardTitle className="text-sm font-mono">
                            {perm.tableName}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {table?.columns.length ?? 0} columns
                            {table?.rowCount !== undefined &&
                              ` · ~${table.rowCount.toLocaleString()} rows`}
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {perm.allowed ? (
                          <Badge variant="default" className="gap-1 text-xs">
                            <Eye className="h-3 w-3" />
                            AI Accessible
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <EyeOff className="h-3 w-3" />
                            Restricted
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {perm.allowed && (
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground whitespace-nowrap">
                            Row Limit:
                          </Label>
                          <Input
                            type="number"
                            value={perm.rowLimit}
                            onChange={(e) =>
                              setRowLimit(
                                perm.tableName,
                                parseInt(e.target.value) || 1000
                              )
                            }
                            className="w-24 h-7 text-xs"
                            min={1}
                            max={100000}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Columns:{" "}
                          <span className="font-mono">
                            {table?.columns
                              .map((c) => c.name)
                              .slice(0, 5)
                              .join(", ")}
                            {(table?.columns.length ?? 0) > 5 && "..."}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
