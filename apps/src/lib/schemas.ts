import { z } from "zod";

// ──── Data Source Schemas ────────────────────────────────────────────────────

export const createDataSourceSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(255),
    type: z.enum(["postgresql", "mysql", "mongodb"]),
    /** Direct URL connection string — when provided, host/port/database/username/password are optional */
    connectionString: z.string().optional(),
    host: z.string().optional().default(""),
    port: z.number().int().min(1).max(65535).optional().default(5432),
    database: z.string().optional().default(""),
    username: z.string().optional().default(""),
    password: z.string().optional().default(""),
    ssl: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      // Either connectionString OR all individual fields must be provided
      if (data.connectionString && data.connectionString.trim().length > 0) {
        return true;
      }
      return (
        data.host!.length > 0 &&
        data.database!.length > 0 &&
        data.username!.length > 0 &&
        data.password!.length > 0
      );
    },
    {
      message:
        "Provide either a connection string or all individual fields (host, database, username, password)",
    }
  );

export type CreateDataSourceSchema = z.infer<typeof createDataSourceSchema>;

// ──── Permission Schemas ─────────────────────────────────────────────────────

export const updatePermissionsSchema = z.object({
  dataSourceId: z.string().uuid(),
  permissions: z.array(
    z.object({
      tableName: z.string().min(1),
      allowed: z.boolean(),
      maskedColumns: z.array(z.string()).optional().default([]),
      rowLimit: z.number().int().min(1).max(100000).optional().default(1000),
    })
  ),
});

export type UpdatePermissionsSchema = z.infer<typeof updatePermissionsSchema>;

// ──── Query Schemas ──────────────────────────────────────────────────────────

export const queryRequestSchema = z.object({
  dataSourceId: z.string().uuid(),
  query: z.string().min(1),
  params: z.array(z.unknown()).optional(),
});

export type QueryRequestSchema = z.infer<typeof queryRequestSchema>;

// ──── Generative UI Component Prop Schemas (for Tambo BYOC) ──────────────────

// Helpers that accept null | undefined and coerce to a safe default.
// Tambo streams partial JSON where fields can be null OR undefined at any point.
const safeStr = () =>
  z.preprocess((v) => (v == null ? "" : v), z.string().default(""));
const safeNum = () =>
  z.preprocess((v) => (v == null ? 0 : v), z.number().default(0));
const safeStrArr = () =>
  z.preprocess((v) => (v == null ? [] : v), z.array(z.string()).default([]));

export const chartDataPointSchema = z.object({
  label: safeStr(),
  value: safeNum(),
  color: z.string().nullable().optional(),
});

export const kpiCardPropsSchema = z.object({
  title: safeStr().describe("The title of the KPI metric"),
  value: z.preprocess(
    (v) => (v == null ? "" : v),
    z.union([z.string(), z.number()]).default("")
  ).describe("The main KPI value"),
  change: z.number().nullable().optional().describe("Percentage change (positive or negative)"),
  changeLabel: z.string().nullable().optional().describe("Label for the change, e.g. 'vs last month'"),
  icon: z.string().nullable().optional().describe("Icon name from lucide-react"),
});

export const dataTablePropsSchema = z.object({
  title: safeStr().describe("Title displayed above the table"),
  columns: safeStrArr().describe("Column header names"),
  rows: z
    .preprocess(
      (v) => (v == null ? [] : v),
      z.array(z.preprocess((r) => (r == null ? [] : r), z.array(z.preprocess((c) => (c == null ? "—" : String(c)), z.string())))).default([])
    )
    .describe("Array of rows, where each row is an array of cell values in the same order as columns"),
  totalRows: z
    .number()
    .nullable()
    .optional()
    .describe("Total count if results are truncated"),
});

export const barChartPropsSchema = z.object({
  title: safeStr().describe("Chart title"),
  data: z.preprocess((v) => (v == null ? [] : v), z.array(chartDataPointSchema).default([])).describe("Data points for the bar chart"),
  xAxisLabel: z.string().nullable().optional().describe("X-axis label"),
  yAxisLabel: z.string().nullable().optional().describe("Y-axis label"),
});

export const lineChartPropsSchema = z.object({
  title: safeStr().describe("Chart title"),
  data: z
    .preprocess(
      (v) => (v == null ? [] : v),
      z.array(
        z.object({
          label: safeStr(),
          series: z.preprocess(
            (v) => (v == null ? [] : v),
            z.array(
              z.object({
                name: safeStr(),
                value: safeNum(),
              })
            ).default([])
          ),
        })
      ).default([])
    )
    .describe("Data points with multiple series"),
  xAxisLabel: z.string().nullable().optional().describe("X-axis label"),
  yAxisLabel: z.string().nullable().optional().describe("Y-axis label"),
});

export const pieChartPropsSchema = z.object({
  title: safeStr().describe("Chart title"),
  data: z.preprocess((v) => (v == null ? [] : v), z.array(chartDataPointSchema).default([])).describe("Data slices for the pie chart"),
});

export const summaryCardPropsSchema = z.object({
  title: safeStr().describe("Summary title"),
  content: safeStr().describe("Main summary text / analysis"),
  highlights: z
    .preprocess((v) => (v == null ? [] : v), z.array(z.string()).default([]))
    .optional()
    .describe("Key highlight bullet points"),
});

export const metricGridPropsSchema = z.object({
  title: safeStr().describe("Grid title"),
  metrics: z.preprocess((v) => (v == null ? [] : v), z.array(kpiCardPropsSchema).default([])).describe("Array of KPI metrics to display"),
});

// ──── Anomaly Card Schema ────────────────────────────────────────────────────

export const anomalyCardPropsSchema = z.object({
  severity: z.preprocess(
    (v) => (v == null ? "info" : v),
    z.enum(["critical", "warning", "info"]).default("info")
  ).describe("Anomaly severity: critical, warning, or info"),
  metricName: safeStr().describe("Name of the affected metric, e.g. 'Weekly Revenue'"),
  description: safeStr().describe("Human-readable description of the anomaly"),
  detail: z.string().nullable().optional().describe("Additional detail or context about the anomaly"),
  changePercent: z.number().nullable().optional().describe("Percentage change that triggered the anomaly"),
  currentValue: z.string().nullable().optional().describe("Current value of the metric"),
  previousValue: z.string().nullable().optional().describe("Previous/expected value of the metric"),
  tableName: z.string().nullable().optional().describe("Source table name"),
});
