# IntentBoard — Module-by-Module Dry-Run Testing Plan

## Objective

Systematically exercise every module in the project to surface **logical errors**, **data-shape mismatches**, **dead code**, and **race conditions** before the first real connection to a user database.

---

## Bugs Already Identified (Pre-Dry-Run)

| # | Severity | Module(s) | Issue |
|---|----------|-----------|-------|
| B1 | **CRITICAL** | `db.ts`, `data-source-service.ts`, `connectors/postgres.ts`, `query-service.ts` | **snake_case ↔ camelCase mismatch.** `SELECT *` returns `database_name`, `encrypted_password`, `created_at`, `read_only` but code reads `.database`, `.encryptedPassword`, `.createdAt`, `.readOnly` → all are `undefined`. `toSafe()` destructure fails; `decrypt(undefined)` crashes. |
| B2 | Medium | `analytics-chat.tsx` | **Race condition in `handleSubmit`:** `setValue(prefix + value)` followed by `setTimeout(() => submit(), 0)`. `submit()` may read stale state before React commits the updated value. |
| B3 | Medium | `query-guardrails.ts` | **Fragile table extraction regex.** `FROM`/`JOIN` regex misses subqueries `FROM (SELECT ...)`, CTEs (`WITH ... AS`), and schema-qualified names. AI-generated complex SQL will be incorrectly rejected. |
| B4 | Medium | `query-service.ts` | **No pool reuse.** Each query creates a new `Pool` → connects → tears it down. Wastes connections and adds latency. |
| B5 | Low | `data-source-service.ts` | `upsertPermissions` runs N sequential queries — not atomic, slow. |
| B6 | Low | `kpi-card.tsx` | `icon` prop defined in `KPICardProps` but never destructured/rendered. |
| B7 | Low | `dashboards-view.tsx` | `Plus` icon imported but never used. |
| B8 | Low | `use-data-sources.ts` | `useActiveDataSource` hook duplicates `AppContext` — never imported. Dead code. |
| B9 | Low | `use-mobile.ts` | `useIsMobile` hook never imported anywhere. Dead code. |
| B10 | Low | `components/ui/` | 10 of 24 shadcn/ui components are unused. |

---

## Dry-Run Plan — Phase by Phase

### Phase 0: Static Analysis Sweep
**Goal:** Catch type errors, unused variables, unreachable code.

| Step | Command / Action | What to Check |
|------|-----------------|---------------|
| 0.1 | `npx tsc --noEmit --strict` | Zero type errors. Catches the snake_case mismatch when combined with explicit SELECT aliases. |
| 0.2 | `npx next lint` | ESLint warnings (unused vars, missing deps in useEffect, etc.) |
| 0.3 | Manual review of every `SELECT *` | Map every `SELECT *` returning a TypeScript generic to check that the column names match the interface. This is B1. |

---

### Phase 1: Library Modules (No Server Required)

#### 1.1 `src/lib/encryption.ts`
**Test:** Round-trip encrypt → decrypt with known plaintext.
```ts
import { encrypt, decrypt } from "./encryption";
const plain = "my-secret-password";
const cipher = encrypt(plain);
console.assert(decrypt(cipher) === plain, "Round-trip failed");
console.assert(cipher !== plain, "Cipher should differ");
// Edge cases:
encrypt("");             // should not throw
decrypt(encrypt("x"));  // single char
```

#### 1.2 `src/lib/query-guardrails.ts`
**Test:** Exercise every validation branch.
```ts
import { validateQuery, enforceLimit } from "./query-guardrails";

// ✅ Valid query
validateQuery("SELECT * FROM users", ["users"]);
// → { valid: true, errors: [], warnings: ["No LIMIT..."] }

// ❌ Non-SELECT
validateQuery("DELETE FROM users", ["users"]);
// → { valid: false, errors: ["Only SELECT queries are permitted"] }

// ❌ Forbidden keyword (SET)
validateQuery("SELECT SET FROM foo", ["foo"]);
// → errors includes "Forbidden keyword detected: SET"

// ❌ Unauthorized table
validateQuery("SELECT * FROM orders", ["users"]);
// → errors includes "Access denied to table: orders"

// ❌ Multi-statement
validateQuery("SELECT 1; DROP TABLE users;", ["users"]);
// → errors includes "Multiple statements"

// ❌ Masked column
validateQuery("SELECT email FROM users", ["users"], { users: ["email"] });
// → errors includes 'Access to masked column "email"'

// 🐛 B3: Subqueries
validateQuery("SELECT * FROM (SELECT 1) sub", ["sub"]);
// → This will INCORRECTLY extract "(select" as table name. Should warn, not error.

// LIMIT enforcement
enforceLimit("SELECT * FROM users");
// → "SELECT * FROM users LIMIT 1000"
enforceLimit("SELECT * FROM users LIMIT 50");
// → unchanged "SELECT * FROM users LIMIT 50"
```

#### 1.3 `src/lib/schemas.ts`
**Test:** Parse valid and invalid payloads through every Zod schema.
```ts
import {
  createDataSourceSchema,
  updatePermissionsSchema,
  queryRequestSchema,
  kpiCardPropsSchema,
  dataTablePropsSchema,
  barChartPropsSchema,
  lineChartPropsSchema,
  pieChartPropsSchema,
  summaryCardPropsSchema,
  metricGridPropsSchema,
} from "./schemas";

// Valid create data source
createDataSourceSchema.parse({
  name: "Test", type: "postgresql", host: "localhost",
  port: 5432, database: "mydb", username: "admin", password: "pass"
});

// Invalid — missing name
try { createDataSourceSchema.parse({ type: "postgresql" }); }
catch (e) { /* should throw ZodError with .issues */ }

// DataTable props — must accept string[][] rows
dataTablePropsSchema.parse({
  title: "Test", columns: ["a", "b"], rows: [["1", "2"]]
});

// ... repeat for each schema, including edge cases like empty arrays, missing optional fields.
```

#### 1.4 `src/lib/types.ts`
**Test:** This is a type-only file — no runtime tests needed. Verified via `tsc --noEmit` in Phase 0.

#### 1.5 `src/lib/utils.ts`
**Test:** `cn()` merge behavior.
```ts
import { cn } from "./utils";
console.assert(cn("px-2", "px-4") === "px-4"); // Tailwind merge
```

---

### Phase 2: Database Layer (Requires Local PostgreSQL)

> **Pre-requisite:** A running PostgreSQL instance at `DATABASE_URL`. Set `ENCRYPTION_KEY` to a valid 64-char hex string in `.env.local`.

#### 2.1 `src/lib/db.ts` — Pool & Init
```ts
import { initializeDatabase, query, queryOne, getPool } from "./db";

// Initialize — should create all 5 tables
await initializeDatabase();

// Verify tables exist
const tables = await query<{ tablename: string }>(
  "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
);
console.log(tables.map(t => t.tablename));
// Expect: data_sources, table_permissions, schema_cache, dashboards, query_audit_log

// queryOne returns null for missing record
const none = await queryOne("SELECT * FROM data_sources WHERE id = $1", ['00000000-0000-0000-0000-000000000000']);
console.assert(none === null);
```

#### 2.2 `src/lib/services/data-source-service.ts`
**🔴 B1 must be fixed first** — add column aliases to all `SELECT *` queries.

After fix:
```ts
import {
  createDataSource, getDataSources, getDataSource, getDataSourceSafe,
  updateDataSourceStatus, deleteDataSource,
  getPermissions, upsertPermissions, getAllowedTables, getMaskedColumns,
  cacheSchema, getCachedSchema,
  saveDashboard, getDashboards, getDashboard,
  logQuery,
} from "./data-source-service";

// Create
const ds = await createDataSource({
  name: "Test PG", type: "postgresql", host: "localhost",
  port: 5432, database: "testdb", username: "user", password: "pass",
});
console.assert(ds.id, "Should have UUID id");
console.assert(!("encryptedPassword" in ds), "Safe rep should omit password");

// Get (full) — verify camelCase mapping
const full = await getDataSource(ds.id);
console.assert(full?.database === "testdb", `B1: got ${full?.database}`);
console.assert(full?.encryptedPassword?.length > 0, "B1: encrypted password present");

// Get safe
const safe = await getDataSourceSafe(ds.id);
console.assert(!("encryptedPassword" in safe!), "Should omit encrypted password");

// Status update
await updateDataSourceStatus(ds.id, "connected");
const updated = await getDataSource(ds.id);
console.assert(updated?.status === "connected");

// Permissions round-trip
await upsertPermissions(ds.id, [
  { tableName: "orders", allowed: true, maskedColumns: ["email"], rowLimit: 500 },
  { tableName: "users", allowed: false, maskedColumns: [], rowLimit: 1000 },
]);
const perms = await getPermissions(ds.id);
console.assert(perms.permissions.length === 2);
const allowed = await getAllowedTables(ds.id);
console.assert(allowed.includes("orders") && !allowed.includes("users"));
const masked = await getMaskedColumns(ds.id);
console.assert(masked.orders.includes("email"));

// Schema cache round-trip
const fakeSchema = { dataSourceId: ds.id, tables: [], fetchedAt: new Date().toISOString() };
await cacheSchema(ds.id, fakeSchema);
const cached = await getCachedSchema(ds.id);
console.assert(cached?.dataSourceId === ds.id);

// Dashboard persistence
const dash = await saveDashboard({ name: "Test Dash", components: [{ type: "kpi" }] });
console.assert(dash.id);
const dashes = await getDashboards();
console.assert(dashes.some(d => d.id === dash.id));

// Audit log
await logQuery({
  dataSourceId: ds.id, queryText: "SELECT 1",
  status: "success", executionTimeMs: 5, rowCount: 1,
});

// Cleanup
await deleteDataSource(ds.id);
const gone = await getDataSource(ds.id);
console.assert(gone === null);
```

#### 2.3 `src/lib/connectors/postgres.ts`
**🔴 B1 must be fixed first.**

After fix (test with a real external PG or the internal one):
```ts
import { testConnection, introspectPostgresSchema } from "./connectors/postgres";

const ds = await getDataSource(someId); // after B1 fix

// Test connection
const conn = await testConnection(ds!);
console.log(conn); // { success: true } or { success: false, error: "..." }

// Introspect schema
const schema = await introspectPostgresSchema(ds!);
console.assert(schema.tables.length > 0, "Should find at least 1 table");
for (const t of schema.tables) {
  console.assert(t.columns.length > 0, `Table ${t.name} should have columns`);
}
```

#### 2.4 `src/lib/services/query-service.ts`
**🔴 B1 must be fixed first. B4 (pool reuse) is a performance issue, not a crash.**

```ts
import { executeGuardedQuery } from "./query-service";

// Test against internal DB (after granting permissions to its tables)
const { result, validation } = await executeGuardedQuery(
  knownDataSourceId,
  "SELECT id, name FROM data_sources"
);
console.log("Valid:", validation.valid, "Errors:", validation.errors);
if (result) {
  console.log("Columns:", result.columns, "Row count:", result.rowCount);
}

// Bad query — should be rejected
const bad = await executeGuardedQuery(knownDataSourceId, "DROP TABLE foo");
console.assert(!bad.validation.valid, "DML should be rejected");
```

---

### Phase 3: API Routes (Requires `next dev` Running)

> **Pre-requisite:** `npm run dev`, internal DB initialized (`POST /api/init`).

#### 3.1 `POST /api/init`
```bash
curl -s -X POST http://localhost:3000/api/init | jq .
# Expect: { "success": true, "data": { "initialized": true } }
```

#### 3.2 `POST /api/data-sources` (Create)
```bash
curl -s -X POST http://localhost:3000/api/data-sources \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","type":"postgresql","host":"localhost","port":5432,"database":"testdb","username":"user","password":"secret"}' | jq .
# Check: id present, status "connected" or "error", no encryptedPassword
```

#### 3.3 `GET /api/data-sources` (List)
```bash
curl -s http://localhost:3000/api/data-sources | jq .
# Check: returns array, each item has all camelCase fields
```

#### 3.4 `GET /api/data-sources/:id` (Detail)
```bash
curl -s http://localhost:3000/api/data-sources/<UUID> | jq .
# Check: same shape as list items — B1 will surface here
```

#### 3.5 `POST /api/data-sources/:id` (Re-test)
```bash
curl -s -X POST http://localhost:3000/api/data-sources/<UUID> | jq .
# Expect: { success: true/false }
```

#### 3.6 `DELETE /api/data-sources/:id`
```bash
curl -s -X DELETE http://localhost:3000/api/data-sources/<UUID> | jq .
```

#### 3.7 `GET /api/data-sources/:id/schema`
```bash
curl -s http://localhost:3000/api/data-sources/<UUID>/schema | jq .
# Check: tables array, each with columns, relationships
# 🔴 This hits B1 — getDataSource returns broken object
```

#### 3.8 `POST /api/data-sources/:id/schema` (Force re-introspect)
```bash
curl -s -X POST http://localhost:3000/api/data-sources/<UUID>/schema | jq .
```

#### 3.9 `GET /api/data-sources/:id/permissions`
```bash
curl -s http://localhost:3000/api/data-sources/<UUID>/permissions | jq .
```

#### 3.10 `PUT /api/data-sources/:id/permissions`
```bash
curl -s -X PUT http://localhost:3000/api/data-sources/<UUID>/permissions \
  -H "Content-Type: application/json" \
  -d '{"permissions":[{"tableName":"users","allowed":true,"rowLimit":100}]}' | jq .
```

#### 3.11 `POST /api/query`
```bash
curl -s -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{"dataSourceId":"<UUID>","sql":"SELECT * FROM users"}' | jq .
# Check: columns, rows, rowCount present
# 🔴 This hits B1 → createExternalPool fails
```

#### 3.12 `GET /api/dashboards` & `POST /api/dashboards`
```bash
curl -s http://localhost:3000/api/dashboards | jq .
curl -s -X POST http://localhost:3000/api/dashboards \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Dash","components":[]}' | jq .
```

---

### Phase 4: Client-Side Components (Browser + DevTools)

#### 4.1 GenUI Components — Visual Smoke Tests
Each component should render with mock props in a Storybook-like harness or just visiting the chat and asking questions.

| Component | Test Props | Expected Render |
|-----------|-----------|-----------------|
| `KPICard` | `{ title: "Revenue", value: "$10K", change: 5.2, changeLabel: "vs last month" }` | Card with up arrow, green badge |
| `DataTable` | `{ title: "Users", columns: ["id","name"], rows: [["1","Alice"],["2","Bob"]] }` | 2-column table with 2 rows |
| `BarChart` | `{ title: "Sales", data: [{label:"Q1",value:100},{label:"Q2",value:200}] }` | 2 bars |
| `LineChart` | `{ title: "Trend", data: [{label:"Jan",value:10},{label:"Feb",value:20}] }` | Line chart |
| `PieChart` | `{ title: "Share", data: [{label:"A",value:60},{label:"B",value:40}] }` | Donut chart |
| `SummaryCard` | `{ title: "Summary", content: "Revenue is up", highlights: ["Q1 growth"] }` | Text card with bullet |
| `MetricGrid` | `{ title: "KPIs", metrics: [{title:"A",value:"1"},{title:"B",value:"2"}] }` | Grid of KPICards |

#### 4.2 `analytics-chat.tsx`
**Manual Test:**
1. Open browser at `/`, ensure no data source selected → see "Connect a data source" empty state.
2. Click a suggestion → **B2 may surface** (stale submit). Check DevTools console for errors.
3. Connect a data source, type a question → verify AI responds.
4. Check that `[Active Data Source: ...]` prefix is stripped from display.
5. Send rapid messages → verify no race conditions.

#### 4.3 `data-sources-view.tsx`
**Manual Test:**
1. Navigate to Data Sources view.
2. Add a new data source via dialog form → should auto-test → show connected/error status.
3. Delete a data source → should disappear from list.

#### 4.4 `schema-browser-view.tsx`
**Manual Test:**
1. Select a connected data source → navigate to Schema view.
2. Tables should be listed; click to expand → columns, types, PK/FK visible.
3. Click "Refresh Schema" → spinner → updated schema.

#### 4.5 `permissions-view.tsx`
**Manual Test:**
1. Select a connected data source → navigate to Permissions view.
2. Toggle tables on/off → set row limits → save.
3. Reload → verify permissions persisted.

#### 4.6 `dashboards-view.tsx`
**Manual Test:**
1. Navigate to Dashboards view → should list any saved dashboards.
2. Verify `Plus` import warning in lint (B7).

#### 4.7 `app-sidebar.tsx` + `app-shell.tsx` + `app-context.tsx`
**Manual Test:**
1. Sidebar lists data sources with status dots.
2. Clicking sidebar items switches active view.
3. Toggling sidebar works (collapse/expand).

---

### Phase 5: Tambo Integration

#### 5.1 `tambo/components.ts`
**Test:** Verify all 7 components register without Tambo errors on page load.
- Open DevTools Console → no "Record types not supported" or schema errors.
- Each `TamboComponent` entry has valid `name`, `description`, `component`, `propsSchema`.

#### 5.2 `tambo/tools.ts`
**Test:** Tools should execute and return data when Tambo AI invokes them.
1. Ask: "List all tables" → `list_tables` tool fires → verify response.
2. Ask: "Describe the users table" → `describe_table` fires.
3. Ask: "Show total users" → `run_select_query` fires → verify query goes through guardrails.

**Manually test tool fetch calls:**
```ts
// From browser console after Tambo initializes:
const res = await fetch("/api/data-sources/<UUID>/schema");
console.log(await res.json());
```

---

### Phase 6: End-to-End Smoke Test

| # | Scenario | Steps | Pass Criteria |
|---|----------|-------|---------------|
| E1 | Cold Start | `POST /api/init` → Create data source → Introspect | Schema cached, status "connected" |
| E2 | Query Flow | Set permissions → Ask "Show all orders" in chat | DataTable GenUI renders with correct columns and rows |
| E3 | Chart Flow | Ask "Show revenue by month as a bar chart" | BarChartComponent renders |
| E4 | Permission Deny | Deny `orders` table → Ask "SELECT * FROM orders" | AI sees rejection, responds with "not authorized" |
| E5 | Multi-DS | Add 2 data sources → switch between them in sidebar → ask different questions | Each response uses the correct data source |
| E6 | Dashboard Save | Ask 3 questions → Save dashboard via AI | Dashboard appears in Dashboards view |

---

## Fix Priority Order

1. **🔴 B1 — snake_case/camelCase mapping** (blocks all DB-dependent tests)
2. **B2 — Race condition** (affects user experience)
3. **B3 — Guardrails regex** (affects complex queries)
4. **B4 — Pool reuse** (performance, not crash)
5. **B5 — Atomic upsertPermissions** (data integrity)
6. **B6-B10 — Cleanup** (dead code, unused imports)

---

## Test Script Location

After all fixes, a runnable test script will be placed at:
```
intentboard/scripts/dry-run.ts
```

This can be executed with `npx tsx scripts/dry-run.ts` and will run Phase 1 + Phase 2 tests programmatically.
