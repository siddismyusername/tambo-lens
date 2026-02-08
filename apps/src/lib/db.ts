import { Pool, type PoolConfig } from "pg";
import "./env"; // Validate env vars on first server-side import

/**
 * Internal PostgreSQL connection pool for Tambo Lens metadata.
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
    await client.query("BEGIN");

    // ── Users table (must come first — referenced by FKs) ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name VARCHAR(255) NOT NULL,
        is_demo BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

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
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
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
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS query_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_source_id UUID REFERENCES data_sources(id),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        query_text TEXT NOT NULL,
        query_params JSONB,
        execution_time_ms INTEGER,
        row_count INTEGER,
        status VARCHAR(50) DEFAULT 'success',
        error_message TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // ── Add user_id columns to existing tables (safe migration for existing DBs) ──
    // ── Anomaly Detection tables ──
    await client.query(`
      CREATE TABLE IF NOT EXISTS anomaly_scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'pending',
        tables_scanned INTEGER DEFAULT 0,
        queries_run INTEGER DEFAULT 0,
        alerts_found INTEGER DEFAULT 0,
        error_message TEXT,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS anomaly_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID REFERENCES anomaly_scans(id) ON DELETE CASCADE,
        data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
        metric_name VARCHAR(500) NOT NULL,
        description TEXT NOT NULL,
        detail TEXT,
        table_name VARCHAR(500),
        column_name VARCHAR(500),
        current_value DOUBLE PRECISION,
        previous_value DOUBLE PRECISION,
        change_percent DOUBLE PRECISION,
        query_used TEXT,
        seen BOOLEAN DEFAULT false,
        dismissed BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS suggested_questions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        category VARCHAR(100),
        icon VARCHAR(50),
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
        thread_id VARCHAR(500),
        title VARCHAR(1000) NOT NULL,
        markdown_content TEXT NOT NULL,
        share_token VARCHAR(64) UNIQUE NOT NULL,
        message_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'data_sources' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE data_sources ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'dashboards' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE dashboards ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'query_audit_log' AND column_name = 'user_id'
        ) THEN
          ALTER TABLE query_audit_log ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
