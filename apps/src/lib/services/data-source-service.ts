import { query, queryOne, getPool } from "../db";
import { encrypt } from "../encryption";
import {
  parseConnectionString,
  testConnection,
  introspectPostgresSchema,
} from "../connectors/postgres";
import type {
  DataSource,
  DataSourceSafe,
  CreateDataSourceInput,
  TablePermission,
  DataSourcePermissions,
  DatabaseSchema,
} from "../types";

// ──── Column Alias Fragment (snake_case → camelCase) ─────────────────────────

const DS_COLUMNS = `
  id,
  name,
  type,
  host,
  port,
  database_name   AS "database",
  username,
  encrypted_password AS "encryptedPassword",
  ssl,
  status,
  read_only       AS "readOnly",
  created_at      AS "createdAt",
  updated_at      AS "updatedAt"
`;

// ──── Data Source CRUD ───────────────────────────────────────────────────────

export async function createDataSource(
  input: CreateDataSourceInput,
  userId?: string
): Promise<DataSourceSafe> {
  // If a connection string is provided, parse it to extract individual fields
  let { host, port, database, username, password, ssl } = input;
  if (input.connectionString && input.connectionString.trim().length > 0) {
    const parsed = parseConnectionString(input.connectionString);
    host = parsed.host;
    port = parsed.port;
    database = parsed.database;
    username = parsed.username;
    password = parsed.password;
    ssl = parsed.ssl || input.ssl || false;
  }

  const encryptedPassword = encrypt(password);

  const row = await queryOne<DataSource>(
    `INSERT INTO data_sources (name, type, host, port, database_name, username, encrypted_password, ssl, status, read_only, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'disconnected', true, $9)
     RETURNING ${DS_COLUMNS}`,
    [
      input.name,
      input.type,
      host,
      port,
      database,
      username,
      encryptedPassword,
      ssl ?? false,
      userId ?? null,
    ]
  );

  if (!row) throw new Error("Failed to create data source");
  return toSafe(row);
}

export async function getDataSources(userId?: string): Promise<DataSourceSafe[]> {
  if (userId) {
    const rows = await query<DataSource>(
      `SELECT ${DS_COLUMNS} FROM data_sources WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map(toSafe);
  }
  const rows = await query<DataSource>(
    `SELECT ${DS_COLUMNS} FROM data_sources ORDER BY created_at DESC`
  );
  return rows.map(toSafe);
}

export async function getDataSource(id: string): Promise<DataSource | null> {
  return queryOne<DataSource>(
    `SELECT ${DS_COLUMNS} FROM data_sources WHERE id = $1`,
    [id]
  );
}

export async function getDataSourceSafe(
  id: string
): Promise<DataSourceSafe | null> {
  const row = await getDataSource(id);
  return row ? toSafe(row) : null;
}

export async function updateDataSourceStatus(
  id: string,
  status: DataSource["status"]
): Promise<void> {
  await query(
    `UPDATE data_sources SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id]
  );
}

export async function deleteDataSource(id: string): Promise<void> {
  await query(`DELETE FROM data_sources WHERE id = $1`, [id]);
}

// ──── Permissions ────────────────────────────────────────────────────────────

export async function getPermissions(
  dataSourceId: string
): Promise<DataSourcePermissions> {
  const rows = await query<{
    data_source_id: string;
    table_name: string;
    allowed: boolean;
    masked_columns: string[];
    row_limit: number;
    updated_at: string;
  }>(
    `SELECT * FROM table_permissions WHERE data_source_id = $1 ORDER BY table_name`,
    [dataSourceId]
  );

  return {
    dataSourceId,
    permissions: rows.map((r) => ({
      dataSourceId: r.data_source_id,
      tableName: r.table_name,
      allowed: r.allowed,
      maskedColumns: r.masked_columns,
      rowLimit: r.row_limit,
    })),
    updatedAt: rows[0]?.updated_at ?? new Date().toISOString(),
  };
}

export async function upsertPermissions(
  dataSourceId: string,
  permissions: Omit<TablePermission, "dataSourceId">[]
): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const perm of permissions) {
      await client.query(
        `INSERT INTO table_permissions (data_source_id, table_name, allowed, masked_columns, row_limit)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (data_source_id, table_name)
         DO UPDATE SET allowed = $3, masked_columns = $4, row_limit = $5, updated_at = NOW()`,
        [
          dataSourceId,
          perm.tableName,
          perm.allowed,
          perm.maskedColumns ?? [],
          perm.rowLimit ?? 1000,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getAllowedTables(dataSourceId: string): Promise<string[]> {
  const rows = await query<{ table_name: string }>(
    `SELECT table_name FROM table_permissions WHERE data_source_id = $1 AND allowed = true`,
    [dataSourceId]
  );
  return rows.map((r) => r.table_name);
}

export async function getMaskedColumns(
  dataSourceId: string
): Promise<Record<string, string[]>> {
  const rows = await query<{ table_name: string; masked_columns: string[] }>(
    `SELECT table_name, masked_columns FROM table_permissions WHERE data_source_id = $1 AND allowed = true`,
    [dataSourceId]
  );
  const result: Record<string, string[]> = {};
  for (const r of rows) {
    if (r.masked_columns?.length) {
      result[r.table_name] = r.masked_columns;
    }
  }
  return result;
}

// ──── Schema Cache ───────────────────────────────────────────────────────────

export async function cacheSchema(
  dataSourceId: string,
  schema: DatabaseSchema
): Promise<void> {
  await query(
    `INSERT INTO schema_cache (data_source_id, schema_data, fetched_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (data_source_id)
     DO UPDATE SET schema_data = $2, fetched_at = NOW()`,
    [dataSourceId, JSON.stringify(schema)]
  );
}

export async function getCachedSchema(
  dataSourceId: string
): Promise<DatabaseSchema | null> {
  const row = await queryOne<{ schema_data: DatabaseSchema }>(
    `SELECT schema_data FROM schema_cache WHERE data_source_id = $1`,
    [dataSourceId]
  );
  return row?.schema_data ?? null;
}

// ──── Dashboard Persistence ──────────────────────────────────────────────────

export async function saveDashboard(dashboard: {
  name: string;
  description?: string;
  threadId?: string;
  components: unknown[];
}, userId?: string): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `INSERT INTO dashboards (name, description, thread_id, components, user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [
      dashboard.name,
      dashboard.description ?? null,
      dashboard.threadId ?? null,
      JSON.stringify(dashboard.components),
      userId ?? null,
    ]
  );
  if (!row) throw new Error("Failed to save dashboard");
  return row;
}

export async function getDashboards(userId?: string): Promise<
  { id: string; name: string; description: string; createdAt: string }[]
> {
  if (userId) {
    return query(
      `SELECT id, name, description, created_at as "createdAt" FROM dashboards WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
  }
  return query(
    `SELECT id, name, description, created_at as "createdAt" FROM dashboards ORDER BY created_at DESC`
  );
}

export async function getDashboard(id: string) {
  return queryOne(
    `SELECT id, name, description, thread_id as "threadId", components, created_at as "createdAt"
     FROM dashboards WHERE id = $1`,
    [id]
  );
}

export async function updateDashboard(
  id: string,
  data: { name?: string; description?: string; components?: unknown[] }
): Promise<{ id: string }> {
  const row = await queryOne<{ id: string }>(
    `UPDATE dashboards
     SET name = COALESCE($2, name),
         description = COALESCE($3, description),
         components = COALESCE($4, components),
         updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [
      id,
      data.name ?? null,
      data.description ?? null,
      data.components ? JSON.stringify(data.components) : null,
    ]
  );
  if (!row) throw new Error("Dashboard not found");
  return row;
}

// ──── Query Audit Log ────────────────────────────────────────────────────────

export async function logQuery(entry: {
  dataSourceId: string;
  queryText: string;
  queryParams?: unknown[];
  executionTimeMs?: number;
  rowCount?: number;
  status: "success" | "error" | "rejected";
  errorMessage?: string;
  userId?: string;
}): Promise<void> {
  await query(
    `INSERT INTO query_audit_log (data_source_id, query_text, query_params, execution_time_ms, row_count, status, error_message, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      entry.dataSourceId,
      entry.queryText,
      entry.queryParams ? JSON.stringify(entry.queryParams) : null,
      entry.executionTimeMs ?? null,
      entry.rowCount ?? null,
      entry.status,
      entry.errorMessage ?? null,
      entry.userId ?? null,
    ]
  );
}

// ──── Demo Data Source Provisioning ──────────────────────────────────────────

/**
 * Ensure the demo user has at least one data source.
 * Uses DEMO_DATABASE_URL if set, otherwise falls back to DATABASE_URL.
 * Returns the existing or newly-created data source, or null on failure.
 */
export async function ensureDemoDataSource(
  userId: string
): Promise<DataSourceSafe | null> {
  // Already has a data source? Return the first one.
  const existing = await getDataSources(userId);
  if (existing.length > 0) return existing[0];

  const demoUrl = process.env.DEMO_DATABASE_URL || process.env.DATABASE_URL;
  if (!demoUrl) return null;

  try {
    const parsed = parseConnectionString(demoUrl);

    const ds = await createDataSource(
      {
        name: "Demo Database",
        type: "postgresql",
        host: parsed.host,
        port: parsed.port,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password,
        ssl: parsed.ssl,
      },
      userId
    );

    // Test connectivity and update status
    const fullDs = await getDataSource(ds.id);
    if (fullDs) {
      const result = await testConnection(fullDs);
      if (result.success) {
        await updateDataSourceStatus(ds.id, "connected");
        ds.status = "connected";

        // Auto-introspect schema (non-blocking failure)
        try {
          const schema = await introspectPostgresSchema(fullDs);
          await cacheSchema(ds.id, schema);
        } catch {
          // schema introspection failure is non-blocking
        }
      } else {
        await updateDataSourceStatus(ds.id, "error");
        ds.status = "error";
      }
    }

    return ds;
  } catch {
    return null;
  }
}

// ──── Helpers ────────────────────────────────────────────────────────────────

function toSafe(ds: DataSource): DataSourceSafe {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encryptedPassword, ...safe } = ds;
  return safe;
}
