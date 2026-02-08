/**
 * Tambo Lens — Dry-Run Test Script
 *
 * Tests Phase 1 (pure library modules, no DB required) and
 * Phase 2 (DB layer, requires DATABASE_URL + ENCRYPTION_KEY).
 *
 * Usage:
 *   npx tsx scripts/dry-run.ts          # Phase 1 only (no DB)
 *   npx tsx scripts/dry-run.ts --all    # Phase 1 + Phase 2 (needs Postgres)
 */

/* eslint-disable @typescript-eslint/no-require-imports */

// Load .env.local
import { config } from "dotenv";
config({ path: ".env.local" });

// ── Helpers ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ❌ ${name}`);
  }
}

function section(title: string) {
  console.log(`\n━━━ ${title} ━━━`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — Pure Library Modules (no database required)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase1() {
  console.log("\n╔═══════════════════════════════╗");
  console.log("║  PHASE 1 — Library Modules    ║");
  console.log("╚═══════════════════════════════╝");

  // ── 1.1 encryption.ts ───────────────────────────────────────────────────
  section("1.1 encryption.ts");
  const { encrypt, decrypt } = await import("../src/lib/encryption");

  const plain = "my-secret-password-123!@#";
  const cipher = encrypt(plain);
  assert(cipher !== plain, "Ciphertext differs from plaintext");
  assert(cipher.length > 0, "Ciphertext is non-empty");
  assert(decrypt(cipher) === plain, "Round-trip decrypt matches original");

  // Edge: empty string
  const emptyCipher = encrypt("");
  assert(decrypt(emptyCipher) === "", "Empty string round-trip");

  // Edge: single char
  assert(decrypt(encrypt("x")) === "x", "Single char round-trip");

  // Edge: unicode
  const unicode = "密码🔑Ñ";
  assert(decrypt(encrypt(unicode)) === unicode, "Unicode round-trip");

  // ── 1.2 query-guardrails.ts ──────────────────────────────────────────────
  section("1.2 query-guardrails.ts");
  const { validateQuery, enforceLimit } = await import(
    "../src/lib/query-guardrails"
  );

  // Valid query
  const valid = validateQuery("SELECT * FROM users", ["users"]);
  assert(valid.valid === true, "Valid SELECT passes");
  assert(valid.errors.length === 0, "No errors on valid query");
  assert(valid.warnings.length > 0, "Warning about missing LIMIT");

  // Non-SELECT
  const del = validateQuery("DELETE FROM users", ["users"]);
  assert(del.valid === false, "DELETE rejected");
  assert(
    del.errors.some((e) => e.includes("Only SELECT")),
    "Error mentions SELECT"
  );

  // Forbidden keyword (DROP)
  const drop = validateQuery("SELECT DROP FROM users", ["users"]);
  assert(drop.valid === false, "DROP keyword detected");

  // "SET" should NOT be in forbidden list anymore (was removed)
  const setQuery = validateQuery("SELECT setting FROM config", ["config"]);
  assert(
    !setQuery.errors.some((e) => e.includes("SET")),
    "SET no longer a false positive"
  );

  // Multi-statement
  const multi = validateQuery("SELECT 1; DROP TABLE users;", ["users"]);
  assert(multi.valid === false, "Multi-statement rejected");

  // Unauthorized table
  const unauth = validateQuery("SELECT * FROM orders", ["users"]);
  assert(unauth.valid === false, "Unauthorized table rejected");
  assert(
    unauth.errors.some((e) => e.includes("orders")),
    "Error names the table"
  );

  // Masked column
  const masked = validateQuery("SELECT email FROM users", ["users"], {
    users: ["email"],
  });
  assert(masked.valid === false, "Masked column detected");

  // Schema-qualified table
  const schemaQual = validateQuery(
    'SELECT * FROM public.users',
    ["users"]
  );
  assert(schemaQual.valid === true, "Schema-qualified table resolves correctly");

  // JOIN table extraction
  const joinQ = validateQuery(
    "SELECT u.id FROM users u JOIN orders o ON u.id = o.user_id",
    ["users", "orders"]
  );
  assert(joinQ.valid === true, "JOIN tables extracted correctly");

  // enforceLimit — adds LIMIT when missing
  const limited = enforceLimit("SELECT * FROM users");
  assert(limited.includes("LIMIT"), "LIMIT added");
  assert(limited.includes("1000"), "Default limit is 1000");

  // enforceLimit — preserves existing LIMIT
  const existing = enforceLimit("SELECT * FROM users LIMIT 50");
  assert(existing === "SELECT * FROM users LIMIT 50", "Existing LIMIT preserved");

  // ── 1.3 schemas.ts ──────────────────────────────────────────────────────────
  section("1.3 schemas.ts (Zod validation)");
  const {
    createDataSourceSchema,
    queryRequestSchema,
    kpiCardPropsSchema,
    dataTablePropsSchema,
    barChartPropsSchema,
    lineChartPropsSchema,
    pieChartPropsSchema,
    summaryCardPropsSchema,
    metricGridPropsSchema,
    updatePermissionsSchema,
  } = await import("../src/lib/schemas");

  // createDataSourceSchema — valid (individual fields)
  const dsResult = createDataSourceSchema.safeParse({
    name: "Test",
    type: "postgresql",
    host: "localhost",
    port: 5432,
    database: "mydb",
    username: "admin",
    password: "pass",
  });
  assert(dsResult.success, "createDataSourceSchema: valid input passes");

  // createDataSourceSchema — valid (connection string)
  const dsUrlResult = createDataSourceSchema.safeParse({
    name: "Test URL",
    type: "postgresql",
    connectionString: "postgresql://admin:pass@localhost:5432/mydb",
  });
  assert(dsUrlResult.success, "createDataSourceSchema: connection string passes");

  // createDataSourceSchema — invalid (neither URL nor fields)
  const dsInvalid = createDataSourceSchema.safeParse({ name: "X", type: "postgresql" });
  assert(!dsInvalid.success, "createDataSourceSchema: incomplete input rejected");

  // queryRequestSchema
  const qr = queryRequestSchema.safeParse({
    dataSourceId: "00000000-0000-0000-0000-000000000000",
    query: "SELECT 1",
  });
  assert(qr.success, "queryRequestSchema: valid input passes");

  // updatePermissionsSchema
  const perm = updatePermissionsSchema.safeParse({
    dataSourceId: "00000000-0000-0000-0000-000000000000",
    permissions: [{ tableName: "users", allowed: true }],
  });
  assert(perm.success, "updatePermissionsSchema: valid input passes");

  // GenUI component schemas
  assert(
    kpiCardPropsSchema.safeParse({ title: "Rev", value: "$1M" }).success,
    "kpiCardPropsSchema validates"
  );
  assert(
    dataTablePropsSchema.safeParse({
      title: "T",
      columns: ["a"],
      rows: [["v"]],
    }).success,
    "dataTablePropsSchema validates (string[][])"
  );
  assert(
    barChartPropsSchema.safeParse({
      title: "B",
      data: [{ label: "Q1", value: 100 }],
    }).success,
    "barChartPropsSchema validates"
  );
  assert(
    lineChartPropsSchema.safeParse({
      title: "L",
      data: [
        { label: "Jan", series: [{ name: "Revenue", value: 10 }] },
        { label: "Feb", series: [{ name: "Revenue", value: 20 }] },
      ],
    }).success,
    "lineChartPropsSchema validates"
  );
  assert(
    pieChartPropsSchema.safeParse({
      title: "P",
      data: [{ label: "A", value: 60 }],
    }).success,
    "pieChartPropsSchema validates"
  );
  assert(
    summaryCardPropsSchema.safeParse({ title: "S", content: "text" }).success,
    "summaryCardPropsSchema validates"
  );
  assert(
    metricGridPropsSchema.safeParse({
      title: "G",
      metrics: [{ title: "M", value: "1" }],
    }).success,
    "metricGridPropsSchema validates"
  );

  // ── 1.4 utils.ts ───────────────────────────────────────────────────────────
  section("1.4 utils.ts");
  const { cn } = await import("../src/lib/utils");
  assert(typeof cn("px-2", "px-4") === "string", "cn() returns a string");
  assert(cn("px-2", "px-4") === "px-4", "Tailwind merge deduplicates px-*");
  assert(cn("", undefined, null as unknown as string, "foo") === "foo", "cn() handles falsy inputs");
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — Database Layer (requires PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════════

async function phase2() {
  console.log("\n╔═══════════════════════════════╗");
  console.log("║  PHASE 2 — Database Layer     ║");
  console.log("╚═══════════════════════════════╝");

  if (!process.env.DATABASE_URL) {
    console.log("  ⏭️  Skipped (DATABASE_URL not set)");
    return;
  }

  // ── 2.1 db.ts — Pool & Init ──────────────────────────────────────────────
  section("2.1 db.ts — Pool & Init");
  const { initializeDatabase, query, queryOne, getPool } = await import(
    "../src/lib/db"
  );

  try {
    await initializeDatabase();
    assert(true, "initializeDatabase() succeeds");
  } catch (e) {
    assert(false, `initializeDatabase() threw: ${e}`);
    return; // Can't continue without DB
  }

  // Verify tables exist
  const tables = await query<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
  );
  const tableNames = tables.map((t) => t.tablename);
  for (const expected of [
    "data_sources",
    "table_permissions",
    "schema_cache",
    "dashboards",
    "query_audit_log",
  ]) {
    assert(tableNames.includes(expected), `Table "${expected}" exists`);
  }

  // queryOne returns null for missing record
  const none = await queryOne(
    "SELECT * FROM data_sources WHERE id = $1",
    ["00000000-0000-0000-0000-000000000000"]
  );
  assert(none === null, "queryOne returns null for missing record");

  // ── 2.2 data-source-service.ts ────────────────────────────────────────────
  section("2.2 data-source-service.ts — CRUD");
  const {
    createDataSource,
    getDataSources,
    getDataSource,
    getDataSourceSafe,
    updateDataSourceStatus,
    deleteDataSource,
    getPermissions,
    upsertPermissions,
    getAllowedTables,
    getMaskedColumns,
    cacheSchema,
    getCachedSchema,
    saveDashboard,
    getDashboards,
    logQuery: auditLogQuery,
  } = await import("../src/lib/services/data-source-service");

  // Create
  const ds = await createDataSource({
    name: "DryRun-Test",
    type: "postgresql",
    host: "localhost",
    port: 5432,
    database: "dryrun_test",
    username: "testuser",
    password: "testpass123",
  });
  assert(!!ds.id, "createDataSource returns UUID");
  assert(!("encryptedPassword" in ds), "Safe rep omits encryptedPassword");
  assert(ds.database === "dryrun_test", "B1 fix: .database is mapped correctly");
  assert(ds.readOnly === true, "B1 fix: .readOnly is mapped correctly");
  assert(ds.status === "disconnected", "Initial status is disconnected");

  // Get full (with encrypted password — verifies B1 column mapping)
  const full = await getDataSource(ds.id);
  assert(full !== null, "getDataSource finds by ID");
  assert(full!.database === "dryrun_test", "B1 fix: full.database mapped");
  assert(
    full!.encryptedPassword.length > 0,
    "B1 fix: full.encryptedPassword present"
  );
  assert(typeof full!.createdAt === "string", "B1 fix: createdAt mapped");
  assert(typeof full!.readOnly === "boolean", "B1 fix: readOnly is boolean");

  // Decrypt round-trip
  const { decrypt } = await import("../src/lib/encryption");
  assert(
    decrypt(full!.encryptedPassword) === "testpass123",
    "Password decrypts correctly from DB"
  );

  // Get safe
  const safe = await getDataSourceSafe(ds.id);
  assert(safe !== null, "getDataSourceSafe finds by ID");
  assert(
    !("encryptedPassword" in safe!),
    "Safe version omits encryptedPassword"
  );

  // Get all
  const all = await getDataSources();
  assert(all.some((d) => d.id === ds.id), "getDataSources includes test record");

  // Status update
  await updateDataSourceStatus(ds.id, "connected");
  const updated = await getDataSource(ds.id);
  assert(updated!.status === "connected", "Status updated to connected");

  // ── Permissions ────────────────────────────────────────────────────────
  section("2.2 data-source-service.ts — Permissions (atomic B5)");

  await upsertPermissions(ds.id, [
    {
      tableName: "orders",
      allowed: true,
      maskedColumns: ["email"],
      rowLimit: 500,
    },
    {
      tableName: "users",
      allowed: false,
      maskedColumns: [],
      rowLimit: 1000,
    },
  ]);
  const perms = await getPermissions(ds.id);
  assert(perms.permissions.length === 2, "2 permissions created");

  const allowed = await getAllowedTables(ds.id);
  assert(
    allowed.includes("orders") && !allowed.includes("users"),
    "getAllowedTables filters correctly"
  );

  const maskedCols = await getMaskedColumns(ds.id);
  assert(
    maskedCols["orders"]?.includes("email"),
    "getMaskedColumns returns masked columns"
  );

  // ── Schema Cache ───────────────────────────────────────────────────────
  section("2.2 data-source-service.ts — Schema Cache");

  const fakeSchema = {
    dataSourceId: ds.id,
    tables: [{ name: "test_table", columns: [], relationships: [] }],
    fetchedAt: new Date().toISOString(),
  };
  await cacheSchema(ds.id, fakeSchema);
  const cached = await getCachedSchema(ds.id);
  assert(cached !== null, "getCachedSchema returns cached data");
  assert(cached!.tables[0].name === "test_table", "Schema data matches");

  // ── Dashboard ──────────────────────────────────────────────────────────
  section("2.2 data-source-service.ts — Dashboards");

  const dash = await saveDashboard({
    name: "DryRun Dashboard",
    components: [{ type: "kpi" }],
  });
  assert(!!dash.id, "saveDashboard returns id");

  const dashes = await getDashboards();
  assert(
    dashes.some((d) => d.id === dash.id),
    "getDashboards includes new dashboard"
  );

  // ── Audit Log ──────────────────────────────────────────────────────────
  section("2.2 data-source-service.ts — Audit Log");

  await auditLogQuery({
    dataSourceId: ds.id,
    queryText: "SELECT 1",
    status: "success",
    executionTimeMs: 5,
    rowCount: 1,
  });
  const auditRows = await query<{ query_text: string }>(
    "SELECT query_text FROM query_audit_log WHERE data_source_id = $1 ORDER BY created_at DESC LIMIT 1",
    [ds.id]
  );
  assert(auditRows[0]?.query_text === "SELECT 1", "Audit log entry created");

  // ── Cleanup ────────────────────────────────────────────────────────────
  section("2.2 Cleanup");
  await deleteDataSource(ds.id);
  const gone = await getDataSource(ds.id);
  assert(gone === null, "deleteDataSource removes record");

  // Clean up dashboard (doesn't cascade from data source)
  await query("DELETE FROM dashboards WHERE id = $1", [dash.id]);

  // Close pool
  getPool().end();
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const runAll = process.argv.includes("--all");

  console.log("🧪 Tambo Lens Dry-Run Test Suite");
  console.log(`   Mode: ${runAll ? "Phase 1 + Phase 2" : "Phase 1 only"}`);

  await phase1();

  if (runAll) {
    await phase2();
  } else {
    console.log("\n  ℹ️  Run with --all to include Phase 2 (requires PostgreSQL)\n");
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════");
  console.log(`  ✅ Passed: ${passed}`);
  console.log(`  ❌ Failed: ${failed}`);
  if (failures.length > 0) {
    console.log("  Failures:");
    for (const f of failures) {
      console.log(`    - ${f}`);
    }
  }
  console.log("═══════════════════════════════════\n");

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("💥 Unhandled error:", err);
  process.exit(2);
});
