import { Pool, type PoolConfig } from "pg";

/**
 * Internal PostgreSQL connection pool for IntentBoard metadata.
 * NOT for user databases — this is the application's own store.
 */
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const config: PoolConfig = {
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
    pool = new Pool(config);
  }
  return pool;
}

/**
 * Execute a query against the internal metadata database.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

/**
 * Execute a single-row query against the internal metadata database.
 */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Initialize the internal database schema if not present.
 */
export async function initializeDatabase(): Promise<void> {
  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_sources (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('postgresql', 'mysql', 'mongodb')),
        host VARCHAR(500) NOT NULL,
        port INTEGER NOT NULL,
        database_name VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        encrypted_password TEXT NOT NULL,
        ssl BOOLEAN DEFAULT false,
        status VARCHAR(50) DEFAULT 'disconnected',
        read_only BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS table_permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
        table_name VARCHAR(500) NOT NULL,
        allowed BOOLEAN DEFAULT false,
        masked_columns TEXT[] DEFAULT '{}',
        row_limit INTEGER DEFAULT 1000,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(data_source_id, table_name)
      );

      CREATE TABLE IF NOT EXISTS schema_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
        schema_data JSONB NOT NULL,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(data_source_id)
      );

      CREATE TABLE IF NOT EXISTS dashboards (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(500) NOT NULL,
        description TEXT,
        thread_id VARCHAR(500),
        components JSONB DEFAULT '[]',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS query_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_source_id UUID REFERENCES data_sources(id),
        query_text TEXT NOT NULL,
        query_params JSONB,
        execution_time_ms INTEGER,
        row_count INTEGER,
        status VARCHAR(50) DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
  } finally {
    client.release();
  }
}
