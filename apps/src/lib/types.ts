// ─── Tambo Lens Core Types ───────────────────────────────────────────────────

// ──── Data Source ─────────────────────────────────────────────────────────────

export type DatabaseType = "postgresql" | "mysql" | "mongodb";

export interface DataSource {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  /** Encrypted password — never exposed to frontend */
  encryptedPassword: string;
  /** Optional SSL flag */
  ssl: boolean;
  /** Connection status */
  status: "connected" | "disconnected" | "error";
  /** Read-only enforcement */
  readOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Frontend-safe representation (no encrypted password) */
export type DataSourceSafe = Omit<DataSource, "encryptedPassword">;

export interface CreateDataSourceInput {
  name: string;
  type: DatabaseType;
  /** Direct connection string, e.g. postgresql://user:pass@host:5432/db?sslmode=require */
  connectionString?: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
}

// ──── Schema Introspection ───────────────────────────────────────────────────

export interface TableSchema {
  name: string;
  schema?: string; // e.g. "public"
  columns: ColumnSchema[];
  rowCount?: number;
  relationships?: Relationship[];
}

export interface ColumnSchema {
  name: string;
  dataType: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
  references?: {
    table: string;
    column: string;
  };
}

export interface Relationship {
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";
}

export interface DatabaseSchema {
  dataSourceId: string;
  tables: TableSchema[];
  fetchedAt: string;
}

// ──── Permissions ────────────────────────────────────────────────────────────

export interface TablePermission {
  dataSourceId: string;
  tableName: string;
  allowed: boolean;
  /** Optional column-level masking */
  maskedColumns?: string[];
  /** Optional row limit for AI queries */
  rowLimit?: number;
}

export interface DataSourcePermissions {
  dataSourceId: string;
  permissions: TablePermission[];
  updatedAt: string;
}

// ──── Query ──────────────────────────────────────────────────────────────────

export interface QueryRequest {
  dataSourceId: string;
  query: string;
  params?: unknown[];
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
  truncated: boolean;
}

export interface QueryValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ──── Dashboard ──────────────────────────────────────────────────────────────

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  threadId: string;
  components: DashboardComponent[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardComponent {
  id: string;
  componentName: string;
  props: Record<string, unknown>;
  position: { x: number; y: number; w: number; h: number };
}

// ──── Generative UI Component Props ──────────────────────────────────────────

export interface ChartDataPoint {
  label?: string;
  value?: number;
  color?: string;
}

export interface KPICardProps {
  title?: string;
  value?: string | number;
  change?: number;
  changeLabel?: string;
  icon?: string;
}

export interface DataTableProps {
  title?: string;
  columns?: string[];
  rows?: string[][];
  totalRows?: number;
}

export interface BarChartProps {
  title?: string;
  data?: ChartDataPoint[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface LineChartProps {
  title?: string;
  data?: { label?: string; series?: { name?: string; value?: number }[] }[];
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export interface PieChartProps {
  title?: string;
  data?: ChartDataPoint[];
}

export interface SummaryCardProps {
  title?: string;
  content?: string;
  highlights?: string[];
}

export interface MetricGridProps {
  title?: string;
  metrics?: KPICardProps[];
}

// ──── API Responses ──────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ──── Anomaly Detection ──────────────────────────────────────────────────────

export type AnomalySeverity = "critical" | "warning" | "info";

export interface AnomalyScan {
  id: string;
  dataSourceId: string;
  userId?: string;
  status: "pending" | "running" | "completed" | "failed";
  tablesScanned: number;
  queriesRun: number;
  alertsFound: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface AnomalyAlert {
  id: string;
  scanId?: string;
  dataSourceId: string;
  severity: AnomalySeverity;
  metricName: string;
  description: string;
  detail?: string;
  tableName?: string;
  columnName?: string;
  currentValue?: number;
  previousValue?: number;
  changePercent?: number;
  queryUsed?: string;
  seen: boolean;
  dismissed: boolean;
  createdAt: string;
}

export interface AnomalyCardProps {
  severity?: AnomalySeverity;
  metricName?: string;
  description?: string;
  detail?: string;
  changePercent?: number;
  currentValue?: string;
  previousValue?: string;
  tableName?: string;
}
