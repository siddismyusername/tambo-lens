import { query } from "../db";
import { getCachedSchema, getAllowedTables } from "./data-source-service";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import type { DatabaseSchema, SuggestedQuestion } from "../types";

// ──── Constants ──────────────────────────────────────────────────────────────

const MAX_QUESTIONS = 8;
const LLM_ENABLED = process.env.SUGGESTION_LLM_ENABLED !== "false";

// ──── Schema Summary Builder ─────────────────────────────────────────────────

/**
 * Build a compact text summary of the schema for the LLM prompt.
 * Includes table names, columns with types, relationships, and row counts.
 */
function buildSchemaSummary(
  schema: DatabaseSchema,
  allowedTables: string[]
): string {
  const allowedSet = new Set(allowedTables.map((t) => t.toLowerCase()));
  const tables = schema.tables.filter((t) =>
    allowedSet.has(t.name.toLowerCase())
  );

  return tables
    .map((t) => {
      const cols = t.columns
        .map((c) => {
          let desc = `${c.name} (${c.dataType})`;
          if (c.isPrimaryKey) desc += " PK";
          if (c.isForeignKey && c.references)
            desc += ` → ${c.references.table}.${c.references.column}`;
          return desc;
        })
        .join(", ");
      const rowInfo = t.rowCount ? ` ~${t.rowCount} rows` : "";
      return `TABLE ${t.name}${rowInfo}: ${cols}`;
    })
    .join("\n");
}

// ──── Heuristic Question Generation (no LLM) ────────────────────────────────

interface HeuristicQuestion {
  question: string;
  category: string;
  icon: string;
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

function generateHeuristicQuestions(
  schema: DatabaseSchema,
  allowedTables: string[]
): HeuristicQuestion[] {
  const questions: HeuristicQuestion[] = [];
  const allowedSet = new Set(allowedTables.map((t) => t.toLowerCase()));
  const tables = schema.tables.filter((t) =>
    allowedSet.has(t.name.toLowerCase())
  );

  for (const table of tables) {
    const numericCols = table.columns.filter(
      (c) => NUMERIC_TYPES.has(c.dataType.toLowerCase()) && !c.isPrimaryKey
    );
    const timeCols = table.columns.filter((c) =>
      TIMESTAMP_TYPES.has(c.dataType.toLowerCase())
    );
    const nameCols = table.columns.filter((c) =>
      /name|title|label|email|username/i.test(c.name)
    );
    const fkCols = table.columns.filter((c) => c.isForeignKey);

    const tableName = table.name;
    const humanName = tableName.replace(/_/g, " ");

    // Top N by numeric column
    if (numericCols.length > 0 && (nameCols.length > 0 || fkCols.length > 0)) {
      const metric = numericCols[0].name.replace(/_/g, " ");
      questions.push({
        question: `What are the top 10 ${humanName} by ${metric}?`,
        category: "ranking",
        icon: "trophy",
      });
    }

    // Trend over time
    if (timeCols.length > 0 && numericCols.length > 0) {
      const metric = numericCols[0].name.replace(/_/g, " ");
      questions.push({
        question: `How has ${metric} in ${humanName} trended over time?`,
        category: "trend",
        icon: "trending-up",
      });
    }

    // Count / overview
    if (table.rowCount && table.rowCount > 0) {
      questions.push({
        question: `How many ${humanName} are there in total?`,
        category: "overview",
        icon: "hash",
      });
    }

    // Distribution by FK / categorical column
    if (fkCols.length > 0 && numericCols.length > 0) {
      const fk = fkCols[0];
      const refTable = fk.references?.table ?? fk.name.replace(/_id$/, "");
      const metric = numericCols[0].name.replace(/_/g, " ");
      questions.push({
        question: `Show ${metric} broken down by ${refTable.replace(/_/g, " ")}`,
        category: "breakdown",
        icon: "pie-chart",
      });
    }

    // Time-based count
    if (timeCols.length > 0) {
      const timeCol = timeCols[0].name.replace(/_/g, " ");
      questions.push({
        question: `Show the monthly count of ${humanName} by ${timeCol}`,
        category: "trend",
        icon: "calendar",
      });
    }
  }

  // Deduplicate and limit
  const seen = new Set<string>();
  const unique = questions.filter((q) => {
    const key = q.question.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique.slice(0, MAX_QUESTIONS);
}

// ──── LLM-Powered Question Generation ────────────────────────────────────────

interface LLMQuestion {
  question: string;
  category: string;
  icon: string;
}

async function generateLLMQuestions(
  schemaSummary: string
): Promise<LLMQuestion[]> {
  const prompt = `You are a business intelligence analyst. Given the following database schema, generate exactly 8 insightful analytical questions that a user would want to ask about this data.

Make questions:
- Specific to the actual tables and columns (reference real column/table names in human-readable form)
- Cover a variety of categories: rankings, trends, comparisons, summaries, anomalies
- Actionable and concise (under 60 characters each if possible)
- Natural language a non-technical user would use

Database schema:
${schemaSummary}

Return ONLY a valid JSON array of objects with fields: question, category (one of: ranking, trend, comparison, overview, breakdown, anomaly), icon (one of: trophy, trending-up, bar-chart, hash, pie-chart, calendar, alert-triangle, users).

Example:
[{"question":"What are the top 10 products by revenue?","category":"ranking","icon":"trophy"}]`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxOutputTokens: 800,
    });

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as LLMQuestion[];
    return parsed
      .filter((q) => q.question && q.category)
      .slice(0, MAX_QUESTIONS);
  } catch {
    return [];
  }
}

// ──── Persistence ────────────────────────────────────────────────────────────

async function persistQuestions(
  dataSourceId: string,
  questions: { question: string; category: string; icon: string }[]
): Promise<void> {
  // Clear old questions for this data source
  await query(`DELETE FROM suggested_questions WHERE data_source_id = $1`, [
    dataSourceId,
  ]);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await query(
      `INSERT INTO suggested_questions (data_source_id, question, category, icon, sort_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [dataSourceId, q.question, q.category, q.icon, i]
    );
  }
}

// ──── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate and persist smart suggested questions for a data source.
 * Uses LLM if available, falls back to heuristic generation.
 * Call this after connecting a data source + schema introspection.
 */
export async function generateSuggestedQuestions(
  dataSourceId: string
): Promise<{ question: string; category: string; icon: string }[]> {
  // 1. Load cached schema
  const schema = await getCachedSchema(dataSourceId);
  if (!schema || schema.tables.length === 0) {
    return [];
  }

  // 2. Get allowed tables
  const allowedTables = await getAllowedTables(dataSourceId);
  // If no permissions set yet, use all tables
  const tablesToUse =
    allowedTables.length > 0
      ? allowedTables
      : schema.tables.map((t) => t.name);

  // 3. Generate questions
  let questions: { question: string; category: string; icon: string }[];

  if (LLM_ENABLED) {
    const summary = buildSchemaSummary(schema, tablesToUse);
    const llmQuestions = await generateLLMQuestions(summary);
    if (llmQuestions.length >= 3) {
      questions = llmQuestions;
    } else {
      // Fallback to heuristic if LLM produced too few
      questions = generateHeuristicQuestions(schema, tablesToUse);
    }
  } else {
    questions = generateHeuristicQuestions(schema, tablesToUse);
  }

  // 4. Persist
  if (questions.length > 0) {
    await persistQuestions(dataSourceId, questions);
  }

  return questions;
}

/**
 * Get cached suggested questions for a data source.
 */
export async function getSuggestedQuestions(
  dataSourceId: string
): Promise<SuggestedQuestion[]> {
  return query<SuggestedQuestion>(
    `SELECT
       id,
       data_source_id AS "dataSourceId",
       question,
       category,
       icon,
       sort_order AS "sortOrder",
       created_at AS "createdAt"
     FROM suggested_questions
     WHERE data_source_id = $1
     ORDER BY sort_order ASC
     LIMIT $2`,
    [dataSourceId, MAX_QUESTIONS]
  );
}
