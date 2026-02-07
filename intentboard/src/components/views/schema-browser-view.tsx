"use client";

import { useAppContext } from "@/components/providers/app-context";
import { useSchema } from "@/hooks/use-data-sources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TableProperties,
  RefreshCw,
  Loader2,
  Key,
  Link2,
  Database,
} from "lucide-react";
import { useState } from "react";

export function SchemaBrowserView() {
  const { activeDataSourceId } = useAppContext();
  const { schema, loading, refreshSchema } = useSchema(activeDataSourceId);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);

  if (!activeDataSourceId) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-3">
        <Database className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Select a data source from the sidebar to browse its schema.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          <TableProperties className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Schema Browser</h2>
          {schema && (
            <Badge variant="outline">{schema.tables.length} tables</Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshSchema}
          disabled={loading}
          className="gap-1"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Refresh
        </Button>
      </div>

      {/* Schema content */}
      <ScrollArea className="flex-1 p-6">
        {loading && !schema ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !schema ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <p className="text-sm text-muted-foreground">
              No schema data available. Click refresh to introspect.
            </p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl">
            {schema.tables.map((table) => (
              <Card key={table.name}>
                <CardHeader
                  className="pb-2 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() =>
                    setExpandedTable(
                      expandedTable === table.name ? null : table.name
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <TableProperties className="h-4 w-4" />
                        {table.schema ? `${table.schema}.` : ""}
                        {table.name}
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {table.columns.length} columns
                        {table.rowCount !== undefined &&
                          ` · ~${table.rowCount.toLocaleString()} rows`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-1">
                      {table.relationships && table.relationships.length > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Link2 className="h-3 w-3" />
                          {table.relationships.length} FK
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>

                {expandedTable === table.name && (
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Column</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="w-[80px]">Nullable</TableHead>
                          <TableHead className="w-[80px]">Keys</TableHead>
                          <TableHead>References</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {table.columns.map((col) => (
                          <TableRow key={col.name}>
                            <TableCell className="font-mono text-sm">
                              {col.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs font-mono">
                                {col.dataType}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {col.nullable ? (
                                <span className="text-xs text-muted-foreground">
                                  YES
                                </span>
                              ) : (
                                <span className="text-xs font-medium">NO</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {col.isPrimaryKey && (
                                  <Badge
                                    variant="default"
                                    className="text-[10px] px-1 py-0 h-4"
                                  >
                                    <Key className="h-2 w-2 mr-0.5" />
                                    PK
                                  </Badge>
                                )}
                                {col.isForeignKey && (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] px-1 py-0 h-4"
                                  >
                                    <Link2 className="h-2 w-2 mr-0.5" />
                                    FK
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {col.references
                                ? `→ ${col.references.table}.${col.references.column}`
                                : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {table.relationships && table.relationships.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">
                          Relationships
                        </p>
                        <div className="space-y-1">
                          {table.relationships.map((rel, i) => (
                            <div
                              key={i}
                              className="text-xs flex items-center gap-1"
                            >
                              <Link2 className="h-3 w-3 text-muted-foreground" />
                              <span className="font-mono">{rel.fromColumn}</span>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-mono">
                                {rel.toTable}.{rel.toColumn}
                              </span>
                              <Badge variant="outline" className="text-[10px] ml-1">
                                {rel.type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
