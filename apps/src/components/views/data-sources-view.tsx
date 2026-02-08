"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useDataSources } from "@/hooks/use-data-sources";
import { useAppContext } from "@/components/providers/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  Plus,
  Trash2,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Link,
  Settings2,
} from "lucide-react";

export function DataSourcesView() {
  const { dataSources, loading, addDataSource, removeDataSource, testConnection } =
    useDataSources();
  const { setActiveDataSourceId, setActiveView } = useAppContext();
  const { data: session } = useSession();
  const isDemo = !!(session?.user as { isDemo?: boolean } | undefined)?.isDemo;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleTest = async (id: string) => {
    setTesting(id);
    await testConnection(id);
    setTesting(null);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await removeDataSource(id);
    setDeleting(null);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return (
          <Badge variant="default" className="gap-1">
            <Wifi className="h-3 w-3" /> Connected
          </Badge>
        );
      case "error":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" /> Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1">
            <WifiOff className="h-3 w-3" /> Disconnected
          </Badge>
        );
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Data Sources</h2>
          <Badge variant="outline">{dataSources.length}</Badge>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1">
              <Plus className="h-3 w-3" /> Add Source
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Data Source</DialogTitle>
              <DialogDescription>
                Connect to your database. Connections are read-only by default.
              </DialogDescription>
            </DialogHeader>
            <AddDataSourceForm
              isDemo={isDemo}
              onSubmit={async (data) => {
                const result = await addDataSource(data);
                if (result) {
                  setDialogOpen(false);
                  setActiveDataSourceId(result.id);
                }
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* List */}
      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : dataSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Database className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="font-medium">No data sources connected</h3>
              <p className="text-sm text-muted-foreground">
                Add your first database connection to get started.
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-1">
              <Plus className="h-3 w-3" /> Add Data Source
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 max-w-3xl">
            {dataSources.map((ds) => (
              <Card key={ds.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base flex items-center gap-2">
                        {ds.name}
                        {statusBadge(ds.status)}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {ds.type}://{ds.host}:{ds.port}/{ds.database}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleTest(ds.id)}
                        disabled={testing === ds.id}
                      >
                        {testing === ds.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Test
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveDataSourceId(ds.id);
                          setActiveView("schema");
                        }}
                      >
                        Schema
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveDataSourceId(ds.id);
                          setActiveView("permissions");
                        }}
                      >
                        Permissions
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(ds.id)}
                        disabled={deleting === ds.id}
                      >
                        {deleting === ds.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>User: {ds.username}</span>
                    <span>SSL: {ds.ssl ? "Yes" : "No"}</span>
                    <span>Read-only: {ds.readOnly ? "Yes" : "No"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const DEMO_CONNECTION_STRING =
  "postgresql://postgres:test%40%23%24dbpass%3D@db.opdwefyhrbooojxradkk.supabase.co:5432/postgres";

function AddDataSourceForm({
  onSubmit,
  isDemo = false,
}: {
  onSubmit: (data: {
    name: string;
    type: string;
    connectionString?: string;
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    ssl?: boolean;
  }) => Promise<void>;
  isDemo?: boolean;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"fields" | "url">(isDemo ? "url" : "fields");
  const [formData, setFormData] = useState({
    name: isDemo ? "Demo Database" : "",
    type: "postgresql",
    connectionString: isDemo ? DEMO_CONNECTION_STRING : "",
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    ssl: false,
  });

  const handleChange = (field: string, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "url") {
      await onSubmit({
        name: formData.name,
        type: formData.type,
        connectionString: formData.connectionString,
        host: "",
        port: 5432,
        database: "",
        username: "",
        password: "",
        ssl: formData.ssl,
      });
    } else {
      await onSubmit({
        name: formData.name,
        type: formData.type,
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password,
        ssl: formData.ssl,
      });
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name + Type (always shown) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            placeholder="My Database"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="type">Type</Label>
          <Select
            value={formData.type}
            onValueChange={(v) => {
              handleChange("type", v);
              if (v === "postgresql") handleChange("port", 5432);
              if (v === "mysql") handleChange("port", 3306);
              if (v === "mongodb") handleChange("port", 27017);
            }}
          >
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="postgresql">PostgreSQL</SelectItem>
              <SelectItem value="mysql">MySQL</SelectItem>
              <SelectItem value="mongodb">MongoDB</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
        <button
          type="button"
          onClick={() => setMode("fields")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "fields"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Settings2 className="h-3.5 w-3.5" />
          Individual Fields
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            mode === "url"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Link className="h-3.5 w-3.5" />
          Connection URL
        </button>
      </div>

      {mode === "url" ? (
        /* ── Connection String Mode ─────────────────────────────── */
        <div className="space-y-2">
          <Label htmlFor="connectionString">Connection String</Label>
          <Input
            id="connectionString"
            value={formData.connectionString}
            onChange={(e) => handleChange("connectionString", e.target.value)}
            placeholder="postgresql://user:password@host:5432/database?sslmode=require"
            required
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Paste your full PostgreSQL connection URL. Host, port, database, user, and password will be extracted automatically.
          </p>
        </div>
      ) : (
        /* ── Individual Fields Mode ─────────────────────────────── */
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="host">Host</Label>
              <Input
                id="host"
                value={formData.host}
                onChange={(e) => handleChange("host", e.target.value)}
                placeholder="db.example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="port">Port</Label>
              <Input
                id="port"
                type="number"
                value={formData.port}
                onChange={(e) => handleChange("port", parseInt(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="database">Database</Label>
            <Input
              id="database"
              value={formData.database}
              onChange={(e) => handleChange("database", e.target.value)}
              placeholder="mydb"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => handleChange("username", e.target.value)}
                placeholder="postgres"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => handleChange("password", e.target.value)}
                required
              />
            </div>
          </div>
        </>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Switch
            id="ssl"
            checked={formData.ssl}
            onCheckedChange={(v) => handleChange("ssl", v)}
          />
          <Label htmlFor="ssl" className="text-sm">
            Use SSL
          </Label>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 text-green-500" />
          Read-only access enforced
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Plus className="h-4 w-4 mr-2" />
        )}
        Connect Data Source
      </Button>
    </form>
  );
}
