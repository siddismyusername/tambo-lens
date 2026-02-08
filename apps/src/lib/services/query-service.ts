import { Pool } from "../../../node_modules/@types/pg";
import { createExternalPool } from "../connectors/postgres";
import { validateQuery, enforceLimit } from "../query-guardrails";
import {
  getDataSource,
  getAllowedTables,
  getMaskedColumns,
  logQuery,
} from "./data-source-service";
import type { QueryResult, QueryValidation } from "../types";

// ──── Pool Cache (reuse pools per data-source) ──────────────────────────────
const poolCache = new Map<string, { pool: Pool; lastUsed: number }>();
const POOL_TTL_MS = 5 * 60 * 1000; // 5 minutes idle TTL

function getOrCreatePool(dataSourceId: string, dataSource: Parameters<typeof createExternalPool>[0]): Pool {
  const cached = poolCache.get(dataSourceId);
  if (cached) {
    cached.lastUsed = Date.now();
    return cached.pool;
  }
  const pool = createExternalPool(dataSource);
  poolCache.set(dataSourceId, { pool, lastUsed: Date.now() });
  return pool;
}

// Periodic cleanup of idle pools
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of poolCache) {
      if (now - entry.lastUsed > POOL_TTL_MS) {
        entry.pool.end().catch(() => { });
        poolCache.delete(id);
      }
    }
  }, 60_000);
}

/**
 * Execute a guarded, read-only query against a user's external database.
 *
 * Pipeline:
 * 1. Load data source & permissions
 * 2. Validate query against guardrails
 * 3. Enforce LIMIT
 * 4. Execute against external DB
 * 5. Audit log result
 * 6. Return structured results
 */
export async function executeGuardedQuery(
  dataSourceId: string,
  sql: string,
  params?: unknown[]
): Promise<{ result?: QueryResult; validation: QueryValidation }> {
  // 1. Resolve data source
  const dataSource = await getDataSource(dataSourceId);
  if (!dataSource) {
    return {
      validation: {
        valid: false,
        errors: [`Data source not found: ${dataSourceId}`],
        warnings: [],
      },
    };
  }

  // 2. Get permissions
  const allowedTables = await getAllowedTables(dataSourceId);
  const maskedColumns = await getMaskedColumns(dataSourceId);

  if (allowedTables.length === 0) {
    return {
      validation: {
        valid: false,
        errors: ["No tables are authorized for this data source"],
        warnings: [],
      },
    };
  }

  // 3. Validate
  const validation = validateQuery(sql, allowedTables, maskedColumns);

  if (!validation.valid) {
    await logQuery({
      dataSourceId,
      queryText: sql,
      queryParams: params,
      status: "rejected",
      errorMessage: validation.errors.join("; "),
    });
    return { validation };
  }

  // 4. Enforce LIMIT
  const safeSql = enforceLimit(sql);

  // 5. Execute (reuse pool via cache)
  const pool = getOrCreatePool(dataSourceId, dataSource);
  const startTime = Date.now();

  try {
    const client = await pool.connect();
    try {
      // Set statement timeout to 30 seconds
      await client.query("SET statement_timeout = '30000'");

      const queryResult = await client.query(safeSql, params);
      const executionTimeMs = Date.now() - startTime;

      const result: QueryResult = {
        columns: queryResult.fields?.map((f) => f.name) ?? [],
        rows: queryResult.rows ?? [],
        rowCount: queryResult.rowCount ?? 0,
        executionTimeMs,
        truncated: false,
      };

      // 6. Audit log
      await logQuery({
        dataSourceId,
        queryText: safeSql,
        queryParams: params,
        executionTimeMs,
        rowCount: result.rowCount,
        status: "success",
      });

      return { result, validation };
    } finally {
      client.release();
    }
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    const errorMessage =
      err instanceof Error ? err.message : "Query execution failed";

    await logQuery({
      dataSourceId,
      queryText: safeSql,
      queryParams: params,
      executionTimeMs,
      status: "error",
      errorMessage,
    });

    return {
      validation: {
        valid: false,
        errors: [`Query execution error: ${errorMessage}`],
        warnings: validation.warnings,
      },
    };
  }
}
