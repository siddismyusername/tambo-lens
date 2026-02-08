import { query, queryOne } from "../db";
import { getCachedSchema, getAllowedTables } from "./data-source-service";
import { executeGuardedQuery } from "./query-service";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type {
  AnomalyAlert,
  AnomalyScan,
  AnomalySeverity,
  DatabaseSchema,
  TableSchema,
  ColumnSchema,
} from "../types";

// ──── Constants ──────────────────────────────────────────────────────────────

const MAX_QUERIES_PER_SCAN = 10;
const MAX_ROW_ESTIMATE_FOR_SCAN = 1_000_000;
const LLM_ENABLED = process.env.ANOMALY_LLM_ENABLED !== "false"; // default on

// ──── Scan Lifecycle ─────────────────────────────────────────────────────────

/**
 * Create a new anomaly scan record and return its ID.
 */
export async function createScan(
  dataSourceId: string,
  userId?: string
): Promise<string> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO anomaly_scans (data_source_id, user_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING id`,
    [dataSourceId, userId ?? null]
  );
  if (!row) throw new Error("Failed to create anomaly scan");
  return row.id;
}

async function updateScanStatus(
  scanId: string,
  status: AnomalyScan["status"],
  extra?: {
    tablesScanned?: number;
    queriesRun?: number;
    alertsFound?: number;
    errorMessage?: string;
  }
): Promise<void> {
  await query(
    `UPDATE anomaly_scans
     SET status = $1,
         tables_scanned  = COALESCE($2, tables_scanned),
         queries_run     = COALESCE($3, queries_run),
         alerts_found    = COALESCE($4, alerts_found),
         error_message   = COALESCE($5, error_message),
         completed_at    = CASE WHEN $1 IN ('completed','failed') THEN NOW() ELSE completed_at END
     WHERE id = $6`,
    [
      status,
      extra?.tablesScanned ?? null,
      extra?.queriesRun ?? null,
      extra?.alertsFound ?? null,
      extra?.errorMessage ?? null,
      scanId,
    ]
  );
}

// ──── Schema Analysis: pick the best metric columns ──────────────────────────

interface MetricCandidate {
  table: TableSchema;
  numericCol: ColumnSchema;
  timeCol: ColumnSchema;
}

const NUMERIC_TYPES = new Set([
  "integer",
  "bigint",
  "smallint",
  "numeric",
  "decimal",
  "real",
  "double precision",
  "money",
]);

const TIMESTAMP_TYPES = new Set([
  "timestamp without time zone",
  "timestamp with time zone",
  "date",
  "timestamptz",
  "timestamp",
]);

/**
 * Heuristically find (numeric, timestamp) column pairs suitable for
 * time-based anomaly detection from the cached schema.
 */
function findMetricCandidates(
  schema: DatabaseSchema,
  allowedTables: string[]
): MetricCandidate[] {
  const candidates: MetricCandidate[] = [];
  const allowedSet = new Set(allowedTables.map((t) => t.toLowerCase()));

  for (const table of schema.tables) {
    if (!allowedSet.has(table.name.toLowerCase())) continue;

    // Skip huge tables unless they have a likely indexed timestamp
    if (table.rowCount && table.rowCount > MAX_ROW_ESTIMATE_FOR_SCAN) continue;

    const timeCols = table.columns.filter((c) =>
      TIMESTAMP_TYPES.has(c.dataType.toLowerCase())
    );
    const numCols = table.columns.filter(
      (c) =>
        NUMERIC_TYPES.has(c.dataType.toLowerCase()) && !c.isPrimaryKey
    );

    if (timeCols.length === 0 || numCols.length === 0) continue;

    // Prefer columns with conventional names
    const bestTimeCol =
      timeCols.find((c) =>
        /created|order_date|date|timestamp|placed_at|occurred/i.test(c.name)
      ) ?? timeCols[0];

    for (const numCol of numCols.slice(0, 3)) {
      // cap per table
      candidates.push({
        table,
        numericCol: numCol,
        timeCol: bestTimeCol,
      });
    }
  }

  return candidates;
}

// ──── Query Generation ───────────────────────────────────────────────────────

interface ComparisonQuery {
  description: string;
  sql: string;
  tableName: string;
  columnName: string;
}

/**
 * Generate week-over-week comparison queries for the given metric candidates.
 */
function generateComparisonQueries(
  candidates: MetricCandidate[]
): ComparisonQuery[] {
  const queries: ComparisonQuery[] = [];

  for (const { table, numericCol, timeCol } of candidates) {
    if (queries.length >= MAX_QUERIES_PER_SCAN) break;

    // Week-over-week aggregate comparison
    queries.push({
      description: `Week-over-week ${numericCol.name} on ${table.name}`,
      tableName: table.name,
      columnName: numericCol.name,
      sql: `
        SELECT
          'this_week' AS period,
          COALESCE(SUM("${numericCol.name}"), 0) AS total,
          COUNT(*) AS row_count
        FROM "${table.name}"
        WHERE "${timeCol.name}" >= NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT
          'last_week' AS period,
          COALESCE(SUM("${numericCol.name}"), 0) AS total,
          COUNT(*) AS row_count
        FROM "${table.name}"
        WHERE "${timeCol.name}" >= NOW() - INTERVAL '14 days'
          AND "${timeCol.name}" < NOW() - INTERVAL '7 days'
      `.trim(),
    });

    if (queries.length >= MAX_QUERIES_PER_SCAN) break;

    // 30-day vs prior 30-day comparison
    queries.push({
      description: `30-day trend ${numericCol.name} on ${table.name}`,
      tableName: table.name,
      columnName: numericCol.name,
      sql: `
        SELECT
          'recent_30d' AS period,
          COALESCE(SUM("${numericCol.name}"), 0) AS total,
          COUNT(*) AS row_count
        FROM "${table.name}"
        WHERE "${timeCol.name}" >= NOW() - INTERVAL '30 days'
        UNION ALL
        SELECT
          'prior_30d' AS period,
          COALESCE(SUM("${numericCol.name}"), 0) AS total,
          COUNT(*) AS row_count
        FROM "${table.name}"
        WHERE "${timeCol.name}" >= NOW() - INTERVAL '60 days'
          AND "${timeCol.name}" < NOW() - INTERVAL '30 days'
      `.trim(),
    });
  }

  return queries.slice(0, MAX_QUERIES_PER_SCAN);
}

// ──── Anomaly Interpretation ─────────────────────────────────────────────────

interface RawResult {
  query: ComparisonQuery;
  rows: Record<string, unknown>[];
}

interface DetectedAnomaly {
  severity: AnomalySeverity;
  metricName: string;
  description: string;
  detail: string;
  tableName: string;
  columnName: string;
  currentValue: number;
  previousValue: number;
  changePercent: number;
  queryUsed: string;
}

/**
 * Pure heuristic anomaly detection (no LLM cost). Flags significant % changes.
 */
function heuristicDetect(results: RawResult[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = [];

  for (const { query: q, rows } of results) {
    if (rows.length < 2) continue;

    const current = Number(rows[0]?.total ?? 0);
    const previous = Number(rows[1]?.total ?? 0);
    const currentCount = Number(rows[0]?.row_count ?? 0);
    const previousCount = Number(rows[1]?.row_count ?? 0);

    // Skip if both periods are zero (no data)
    if (current === 0 && previous === 0) continue;

    // Calculate percentage change
    let changePercent = 0;
    if (previous !== 0) {
      changePercent = ((current - previous) / Math.abs(previous)) * 100;
    } else if (current > 0) {
      changePercent = 100; // went from 0 → something
    }

    const absChange = Math.abs(changePercent);

    // Only flag if change is significant
    if (absChange < 20) continue;

    let severity: AnomalySeverity = "info";
    if (absChange >= 50) severity = "critical";
    else if (absChange >= 30) severity = "warning";

    const direction = changePercent > 0 ? "increased" : "decreased";
    const periodLabel = q.description.includes("30-day")
      ? "month-over-month"
      : "week-over-week";

    anomalies.push({
      severity,
      metricName: `${q.tableName}.${q.columnName} (${periodLabel})`,
      description: `${q.columnName} ${direction} ${absChange.toFixed(1)}% ${periodLabel} in "${q.tableName}"`,
      detail: `Current: ${current.toLocaleString()} (${currentCount} rows) → Previous: ${previous.toLocaleString()} (${previousCount} rows)`,
      tableName: q.tableName,
      columnName: q.columnName,
      currentValue: current,
      previousValue: previous,
      changePercent: Math.round(changePercent * 10) / 10,
      queryUsed: q.sql,
    });
  }

  return anomalies;
}

/**
 * LLM-enhanced interpretation — takes raw heuristic anomalies and rewrites
 * them into business-friendly language. Falls back to heuristic descriptions
 * on error.
 */
async function llmEnhance(
  anomalies: DetectedAnomaly[]
): Promise<DetectedAnomaly[]> {
  if (anomalies.length === 0 || !LLM_ENABLED) return anomalies;

  try {
    const prompt = `You are a data analyst AI. Given the following raw anomaly detections from a database, rewrite each one with:
1. A concise, business-friendly metricName (e.g., "Weekly Revenue" not "orders.amount (week-over-week)")
2. A punchy description suitable for a notification toast (max 120 chars)
3. A brief detail sentence with context

Return ONLY valid JSON — an array of objects with fields: index (0-based), metricName, description, detail.

Raw anomalies:
${JSON.stringify(
      anomalies.map((a, i) => ({
        index: i,
        raw_metric: a.metricName,
        raw_desc: a.description,
        raw_detail: a.detail,
        change: a.changePercent,
        table: a.tableName,
        column: a.columnName,
      })),
      null,
      2
    )}`;

    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxOutputTokens: 1000,
    });

    // Parse the LLM response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return anomalies;

    const enhanced = JSON.parse(jsonMatch[0]) as {
      index: number;
      metricName: string;
      description: string;
      detail: string;
    }[];

    for (const item of enhanced) {
      if (item.index >= 0 && item.index < anomalies.length) {
        anomalies[item.index].metricName = item.metricName;
        anomalies[item.index].description = item.description;
        anomalies[item.index].detail = item.detail;
      }
    }
  } catch {
    // LLM failure is non-blocking — heuristic descriptions are fine
  }

  return anomalies;
}

// ──── Persist Alerts ─────────────────────────────────────────────────────────

async function persistAlerts(
  scanId: string,
  dataSourceId: string,
  anomalies: DetectedAnomaly[]
): Promise<void> {
  for (const a of anomalies) {
    await query(
      `INSERT INTO anomaly_alerts
       (scan_id, data_source_id, severity, metric_name, description, detail,
        table_name, column_name, current_value, previous_value, change_percent, query_used)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        scanId,
        dataSourceId,
        a.severity,
        a.metricName,
        a.description,
        a.detail,
        a.tableName,
        a.columnName,
        a.currentValue,
        a.previousValue,
        a.changePercent,
        a.queryUsed,
      ]
    );
  }
}

// ──── Public API ─────────────────────────────────────────────────────────────

/**
 * Run a full anomaly detection scan for the given data source.
 * This is the main entry point — call it after connecting a data source
 * or on-demand from the API.
 */
export async function runAnomalyScan(
  dataSourceId: string,
  userId?: string
): Promise<{ scanId: string; alerts: DetectedAnomaly[] }> {
  const scanId = await createScan(dataSourceId, userId);

  try {
    await updateScanStatus(scanId, "running");

    // 1. Load cached schema
    const schema = await getCachedSchema(dataSourceId);
    if (!schema) {
      await updateScanStatus(scanId, "failed", {
        errorMessage: "No cached schema available — introspect first",
      });
      return { scanId, alerts: [] };
    }

    // 2. Get allowed tables
    const allowedTables = await getAllowedTables(dataSourceId);
    if (allowedTables.length === 0) {
      await updateScanStatus(scanId, "failed", {
        errorMessage: "No authorized tables to scan",
      });
      return { scanId, alerts: [] };
    }

    // 3. Find metric candidates in the schema
    const candidates = findMetricCandidates(schema, allowedTables);
    if (candidates.length === 0) {
      await updateScanStatus(scanId, "completed", {
        tablesScanned: 0,
        queriesRun: 0,
        alertsFound: 0,
      });
      return { scanId, alerts: [] };
    }

    // 4. Generate comparison queries
    const comparisonQueries = generateComparisonQueries(candidates);

    // 5. Execute each query through the guarded pipeline
    const rawResults: RawResult[] = [];
    const scannedTables = new Set<string>();

    for (const cq of comparisonQueries) {
      try {
        const { result } = await executeGuardedQuery(dataSourceId, cq.sql);
        if (result && result.rows.length > 0) {
          rawResults.push({ query: cq, rows: result.rows });
          scannedTables.add(cq.tableName);
        }
      } catch {
        // Individual query failure is non-blocking
      }
    }

    // 6. Detect anomalies via heuristics
    let anomalies = heuristicDetect(rawResults);

    // 7. Optionally enhance descriptions with LLM
    anomalies = await llmEnhance(anomalies);

    // 8. Persist alerts
    await persistAlerts(scanId, dataSourceId, anomalies);

    // 9. Update scan record
    await updateScanStatus(scanId, "completed", {
      tablesScanned: scannedTables.size,
      queriesRun: comparisonQueries.length,
      alertsFound: anomalies.length,
    });

    return { scanId, alerts: anomalies };
  } catch (err) {
    await updateScanStatus(scanId, "failed", {
      errorMessage:
        err instanceof Error ? err.message : "Anomaly scan failed",
    });
    return { scanId, alerts: [] };
  }
}

// ──── Read Alerts ────────────────────────────────────────────────────────────

const ALERT_COLUMNS = `
  id,
  scan_id        AS "scanId",
  data_source_id AS "dataSourceId",
  severity,
  metric_name    AS "metricName",
  description,
  detail,
  table_name     AS "tableName",
  column_name    AS "columnName",
  current_value  AS "currentValue",
  previous_value AS "previousValue",
  change_percent AS "changePercent",
  query_used     AS "queryUsed",
  seen,
  dismissed,
  created_at     AS "createdAt"
`;

export async function getAlerts(
  dataSourceId: string,
  opts?: { includeDismissed?: boolean; limit?: number }
): Promise<AnomalyAlert[]> {
  const limit = opts?.limit ?? 50;
  const dismissed = opts?.includeDismissed ?? false;

  const whereClause = dismissed
    ? `WHERE data_source_id = $1`
    : `WHERE data_source_id = $1 AND dismissed = false`;

  return query<AnomalyAlert>(
    `SELECT ${ALERT_COLUMNS} FROM anomaly_alerts ${whereClause}
     ORDER BY created_at DESC LIMIT $2`,
    [dataSourceId, limit]
  );
}

export async function getAlertsByUser(
  userId: string,
  opts?: { includeDismissed?: boolean; limit?: number }
): Promise<AnomalyAlert[]> {
  const limit = opts?.limit ?? 50;
  const dismissed = opts?.includeDismissed ?? false;

  const whereClause = dismissed
    ? `WHERE s.user_id = $1`
    : `WHERE s.user_id = $1 AND a.dismissed = false`;

  return query<AnomalyAlert>(
    `SELECT
       a.id,
       a.scan_id        AS "scanId",
       a.data_source_id AS "dataSourceId",
       a.severity,
       a.metric_name    AS "metricName",
       a.description,
       a.detail,
       a.table_name     AS "tableName",
       a.column_name    AS "columnName",
       a.current_value  AS "currentValue",
       a.previous_value AS "previousValue",
       a.change_percent AS "changePercent",
       a.query_used     AS "queryUsed",
       a.seen,
       a.dismissed,
       a.created_at     AS "createdAt"
     FROM anomaly_alerts a
     JOIN anomaly_scans s ON a.scan_id = s.id
     ${whereClause}
     ORDER BY a.created_at DESC LIMIT $2`,
    [userId, limit]
  );
}

export async function markAlertsSeen(alertIds: string[]): Promise<void> {
  if (alertIds.length === 0) return;
  const placeholders = alertIds.map((_, i) => `$${i + 1}`).join(",");
  await query(
    `UPDATE anomaly_alerts SET seen = true WHERE id IN (${placeholders})`,
    alertIds
  );
}

export async function dismissAlert(alertId: string): Promise<void> {
  await query(
    `UPDATE anomaly_alerts SET dismissed = true WHERE id = $1`,
    [alertId]
  );
}

export async function getLatestScan(
  dataSourceId: string
): Promise<AnomalyScan | null> {
  return queryOne<AnomalyScan>(
    `SELECT
       id,
       data_source_id AS "dataSourceId",
       user_id        AS "userId",
       status,
       tables_scanned AS "tablesScanned",
       queries_run    AS "queriesRun",
       alerts_found   AS "alertsFound",
       error_message  AS "errorMessage",
       started_at     AS "startedAt",
       completed_at   AS "completedAt"
     FROM anomaly_scans
     WHERE data_source_id = $1
     ORDER BY started_at DESC
     LIMIT 1`,
    [dataSourceId]
  );
}
