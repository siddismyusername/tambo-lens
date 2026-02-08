import { Pool, type PoolConfig } from "pg";
import { decrypt } from "../encryption";
import type { DataSource, DatabaseSchema, TableSchema, ColumnSchema, Relationship } from "../types";

/**
 * Parse a PostgreSQL connection string into individual components.
 * Supports: postgresql://user:password@host:port/database?sslmode=require
 */
export function parseConnectionString(url: string): {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
} {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    database: parsed.pathname.replace(/^\//, ""),
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl:
      parsed.searchParams.get("sslmode") === "require" ||
      parsed.searchParams.get("sslmode") === "verify-full" ||
      parsed.searchParams.get("ssl") === "true",
  };
}

/**
 * Create a read-only connection pool to a user's external database.
 * This is NOT the internal metadata DB — it connects to the user's actual data.
 */
export function createExternalPool(dataSource: DataSource): Pool {
  const password = decrypt(dataSource.encryptedPassword);

  const config: PoolConfig = {
    host: dataSource.host,
    port: dataSource.port,
    database: dataSource.database,
    user: dataSource.username,
    password,
    ssl: dataSource.ssl ? { rejectUnauthorized: false } : false,
    max: 3,
    idleTimeoutMillis: 15000,
    connectionTimeoutMillis: 10000,
  };

  return new Pool(config);
}

/**
 * Create a connection pool directly from a raw connection string.
 * Used for testing before the data source is persisted.
 */
export function createPoolFromConnectionString(connectionString: string): Pool {
  return new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 10000,
  });
}

/**
 * Test connectivity to an external data source.
 * Supports both stored data sources and raw connection strings.
 */
export async function testConnection(
  dataSource: DataSource
): Promise<{ success: boolean; error?: string }> {
  const pool = createExternalPool(dataSource);
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    await pool.end();
    return { success: true };
  } catch (err) {
    await pool.end().catch(() => { });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown connection error",
    };
  }
}

/**
 * Test connectivity using a raw connection string (before persistence).
 */
export async function testConnectionString(
  connectionString: string
): Promise<{ success: boolean; error?: string }> {
  const pool = createPoolFromConnectionString(connectionString);
  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    await pool.end();
    return { success: true };
  } catch (err) {
    await pool.end().catch(() => { });
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown connection error",
    };
  }
}

/**
 * Introspect the schema of a PostgreSQL database.
 */
export async function introspectPostgresSchema(
  dataSource: DataSource
): Promise<DatabaseSchema> {
  const pool = createExternalPool(dataSource);
  const client = await pool.connect();

  try {
    // Fetch all tables in the public schema
    const tablesResult = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tables: TableSchema[] = [];

    for (const tableRow of tablesResult.rows) {
      const tableName = tableRow.table_name;

      // Fetch columns
      const columnsResult = await client.query(
        `
        SELECT 
          c.column_name,
          c.data_type,
          c.is_nullable,
          c.column_default,
          CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key,
          CASE WHEN fk.column_name IS NOT NULL THEN true ELSE false END as is_foreign_key,
          fk.foreign_table_name,
          fk.foreign_column_name
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
            ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_name = $1
            AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        LEFT JOIN (
          SELECT
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_name = $1
            AND tc.constraint_type = 'FOREIGN KEY'
        ) fk ON c.column_name = fk.column_name
        WHERE c.table_name = $1
          AND c.table_schema = 'public'
        ORDER BY c.ordinal_position
      `,
        [tableName]
      );

      const columns: ColumnSchema[] = columnsResult.rows.map((col) => ({
        name: col.column_name,
        dataType: col.data_type,
        nullable: col.is_nullable === "YES",
        isPrimaryKey: col.is_primary_key,
        isForeignKey: col.is_foreign_key,
        defaultValue: col.column_default ?? undefined,
        references: col.is_foreign_key
          ? { table: col.foreign_table_name, column: col.foreign_column_name }
          : undefined,
      }));

      // Fetch relationships
      const relResult = await client.query(
        `
        SELECT
          kcu.column_name as from_column,
          ccu.table_name as to_table,
          ccu.column_name as to_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = $1
          AND tc.constraint_type = 'FOREIGN KEY'
      `,
        [tableName]
      );

      const relationships: Relationship[] = relResult.rows.map((rel) => ({
        fromColumn: rel.from_column,
        toTable: rel.to_table,
        toColumn: rel.to_column,
        type: "many-to-one" as const,
      }));

      // Fetch row count estimate
      const countResult = await client.query(
        `SELECT reltuples::bigint AS estimate FROM pg_class WHERE relname = $1`,
        [tableName]
      );

      tables.push({
        name: tableName,
        schema: "public",
        columns,
        relationships,
        rowCount: Number(countResult.rows[0]?.estimate ?? 0),
      });
    }

    return {
      dataSourceId: dataSource.id,
      tables,
      fetchedAt: new Date().toISOString(),
    };
  } finally {
    client.release();
    await pool.end();
  }
}
