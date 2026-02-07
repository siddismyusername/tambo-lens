"use client";

import { defineTool } from "@tambo-ai/react";
import { z } from "zod";

/**
 * Tambo tool: Execute a safe, read-only SQL query against a connected data source.
 *
 * This tool is invoked by the AI when it needs to fetch data from the user's database.
 * The actual query validation and execution happens server-side via the /api/query endpoint.
 */
export const runSelectQueryTool = defineTool({
  name: "run_select_query",
  description:
    "Execute a safe, read-only SELECT query against the user's connected database. The query must be a valid SELECT statement. INSERT/UPDATE/DELETE/DROP and other write operations are not allowed. The system will validate the query against authorized tables and enforce row limits automatically.",
  inputSchema: z.object({
    dataSourceId: z
      .string()
      .describe("The UUID or identifier of the data source to query"),
    query: z
      .string()
      .describe(
        "A valid SQL SELECT query. Only SELECT statements are permitted. Do not include INSERT, UPDATE, DELETE, DROP, or any other DDL/DML statements."
      ),
  }),
  outputSchema: z.object({
    columns: z.array(z.string()).describe("Column names in the result set"),
    rows: z
      .array(z.array(z.string()))
      .describe("Array of rows, each row is an array of cell values matching column order"),
    rowCount: z.number().describe("Number of rows returned"),
    executionTimeMs: z.number().describe("Query execution time in milliseconds"),
    error: z.string().optional().describe("Error message if the query failed"),
  }),
  tool: async ({ dataSourceId, query }) => {
    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSourceId, query }),
      });

      const result = await response.json();

      if (!result.success) {
        return {
          columns: [],
          rows: [],
          rowCount: 0,
          executionTimeMs: 0,
          error: result.error || "Query failed",
        };
      }

      return {
        columns: result.data.columns,
        rows: (result.data.rows as Record<string, unknown>[]).map(
          (row: Record<string, unknown>) =>
            (result.data.columns as string[]).map((col: string) =>
              row[col] == null ? "—" : String(row[col])
            )
        ),
        rowCount: result.data.rowCount,
        executionTimeMs: result.data.executionTimeMs,
      };
    } catch (err) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        executionTimeMs: 0,
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  },
});

/**
 * Tambo tool: Describe table schema for a connected data source.
 *
 * Allows the AI to understand the shape of the data before forming queries.
 */
export const describeTableTool = defineTool({
  name: "describe_table",
  description:
    "Get the schema (columns, types, relationships) of a specific table in the user's connected database. Use this to understand the data shape before writing queries.",
  inputSchema: z.object({
    dataSourceId: z
      .string()
      .describe("The UUID of the data source"),
    tableName: z
      .string()
      .describe("The name of the table to describe"),
  }),
  outputSchema: z.object({
    tableName: z.string(),
    columns: z.array(
      z.object({
        name: z.string(),
        dataType: z.string(),
        nullable: z.boolean(),
        isPrimaryKey: z.boolean(),
        isForeignKey: z.boolean(),
      })
    ),
    rowCount: z.number().optional(),
    error: z.string().optional(),
  }),
  tool: async ({ dataSourceId, tableName }) => {
    try {
      const response = await fetch(`/api/data-sources/${dataSourceId}/schema`);
      const result = await response.json();

      if (!result.success) {
        return {
          tableName,
          columns: [],
          error: result.error || "Failed to fetch schema",
        };
      }

      const table = result.data.tables.find(
        (t: { name: string }) => t.name.toLowerCase() === tableName.toLowerCase()
      );

      if (!table) {
        return {
          tableName,
          columns: [],
          error: `Table "${tableName}" not found or not authorized`,
        };
      }

      return {
        tableName: table.name,
        columns: table.columns.map(
          (c: {
            name: string;
            dataType: string;
            nullable: boolean;
            isPrimaryKey: boolean;
            isForeignKey: boolean;
          }) => ({
            name: c.name,
            dataType: c.dataType,
            nullable: c.nullable,
            isPrimaryKey: c.isPrimaryKey,
            isForeignKey: c.isForeignKey,
          })
        ),
        rowCount: table.rowCount,
      };
    } catch (err) {
      return {
        tableName,
        columns: [],
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  },
});

/**
 * Tambo tool: List all authorized tables in a data source.
 */
export const listTablesTool = defineTool({
  name: "list_tables",
  description:
    "List all tables the user has authorized for AI access in a given data source. Use this to discover what data is available before querying.",
  inputSchema: z.object({
    dataSourceId: z
      .string()
      .describe("The UUID of the data source"),
  }),
  outputSchema: z.object({
    tables: z.array(
      z.object({
        name: z.string(),
        rowCount: z.number().optional(),
        columnCount: z.number(),
      })
    ),
    error: z.string().optional(),
  }),
  tool: async ({ dataSourceId }) => {
    try {
      const response = await fetch(`/api/data-sources/${dataSourceId}/schema`);
      const result = await response.json();

      if (!result.success) {
        return { tables: [], error: result.error || "Failed to fetch schema" };
      }

      return {
        tables: result.data.tables.map(
          (t: { name: string; rowCount?: number; columns: unknown[] }) => ({
            name: t.name,
            rowCount: t.rowCount,
            columnCount: t.columns.length,
          })
        ),
      };
    } catch (err) {
      return {
        tables: [],
        error: err instanceof Error ? err.message : "Network error",
      };
    }
  },
});

/**
 * All Tambo tools for IntentBoard
 */
export const intentBoardTools = [
  runSelectQueryTool,
  describeTableTool,
  listTablesTool,
];
