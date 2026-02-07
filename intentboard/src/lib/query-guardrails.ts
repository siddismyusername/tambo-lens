import type { QueryValidation } from "./types";

/** Reserved SQL keywords that are NEVER allowed in AI-generated queries. */
const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "GRANT",
  "REVOKE",
  "EXECUTE",
  "EXEC",
  "CALL",
  "MERGE",
  "REPLACE",
  "COPY",
  "VACUUM",
  "REINDEX",
  "CLUSTER",
  "COMMENT",
  "LOCK",
  "RESET",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT",
  "PREPARE",
  "DEALLOCATE",
  "LISTEN",
  "NOTIFY",
  "LOAD",
  "SECURITY",
];

const MAX_QUERY_LENGTH = 5000;
const DEFAULT_ROW_LIMIT = 1000;

/**
 * Validate that a query is safe for read-only execution.
 * Enforces SELECT-only, no DDL/DML, row limits, and complexity checks.
 */
export function validateQuery(
  sql: string,
  allowedTables: string[],
  maskedColumns: Record<string, string[]> = {},
  maxRows: number = DEFAULT_ROW_LIMIT
): QueryValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const normalizedSql = sql.trim().toUpperCase();

  // 1. Length check
  if (sql.length > MAX_QUERY_LENGTH) {
    errors.push(`Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters`);
    return { valid: false, errors, warnings };
  }

  // 2. Must be a SELECT statement
  if (!normalizedSql.startsWith("SELECT")) {
    errors.push("Only SELECT queries are permitted");
    return { valid: false, errors, warnings };
  }

  // 3. Check for forbidden keywords
  for (const keyword of FORBIDDEN_KEYWORDS) {
    // Use word boundary regex to avoid false positives (e.g. "RESET" in "PRESET")
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(sql)) {
      errors.push(`Forbidden keyword detected: ${keyword}`);
    }
  }

  // 4. Check for multiple statements (SQL injection vector)
  const semiColonStripped = sql.replace(/'[^']*'/g, "").replace(/"[^"]*"/g, "");
  if (semiColonStripped.includes(";")) {
    const statementsCount = semiColonStripped.split(";").filter((s) => s.trim()).length;
    if (statementsCount > 1) {
      errors.push("Multiple statements are not allowed");
    }
  }

  // 5. Check table access authorization
  // Match FROM/JOIN followed by an identifier (skip subqueries & CTEs)
  const tableRefRegex = /\b(?:FROM|JOIN)\s+(?!\(|LATERAL\b)([a-zA-Z_][a-zA-Z0-9_]*)(?:\.([a-zA-Z_][a-zA-Z0-9_]*))?/gi;
  const referencedTables: string[] = [];
  let tableMatch: RegExpExecArray | null;

  while ((tableMatch = tableRefRegex.exec(sql)) !== null) {
    // If schema-qualified (e.g. public.users), take the table part; otherwise take the first capture
    const tableName = (tableMatch[2] ?? tableMatch[1]).replace(/"/g, "").toLowerCase();
    // Skip SQL keywords that can follow FROM in CTEs: WITH ... AS
    if (["select", "lateral", "unnest", "generate_series"].includes(tableName)) continue;
    if (tableName && !referencedTables.includes(tableName)) {
      referencedTables.push(tableName);
    }
  }

  const allowedTablesLower = allowedTables.map((t) => t.toLowerCase());

  for (const table of referencedTables) {
    if (table && !allowedTablesLower.includes(table)) {
      errors.push(`Access denied to table: ${table}`);
    }
  }

  // 6. Check for masked column exposure
  for (const [table, columns] of Object.entries(maskedColumns)) {
    for (const col of columns) {
      const colRegex = new RegExp(`\\b${col}\\b`, "i");
      if (colRegex.test(sql)) {
        errors.push(`Access to masked column "${col}" in table "${table}" is not allowed`);
      }
    }
  }

  // 7. Auto-LIMIT enforcement
  if (!normalizedSql.includes("LIMIT")) {
    warnings.push(
      `No LIMIT clause detected. A default LIMIT ${maxRows} will be added.`
    );
  }

  // 8. Subquery depth check (simple heuristic)
  const openParens = (sql.match(/\(/g) || []).length;
  if (openParens > 5) {
    warnings.push("Complex subquery nesting detected. Consider simplifying.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Add a LIMIT clause to a query if one is not already present.
 */
export function enforceLimit(sql: string, maxRows: number = DEFAULT_ROW_LIMIT): string {
  const normalizedSql = sql.trim().toUpperCase();
  if (!normalizedSql.includes("LIMIT")) {
    // Remove trailing semicolon if present
    const cleanSql = sql.replace(/;\s*$/, "");
    return `${cleanSql} LIMIT ${maxRows}`;
  }
  return sql;
}
