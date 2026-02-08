import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { query, queryOne } from "@/lib/db";
import type { Report, ReportThreadMessage } from "@/lib/types";
import crypto from "crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateShareToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Summarise a component's props into a concise textual description.
 * The LLM prompt receives these so it can reference visualisations it hasn't "seen".
 */
function describeComponent(
  componentName: string,
  props: Record<string, unknown>
): string {
  const title = (props.title as string) ?? "";
  switch (componentName) {
    case "KPICard": {
      const value = props.value ?? "";
      const change = props.change as number | undefined;
      return `[KPI] ${title}: ${value}${change != null ? ` (${change > 0 ? "+" : ""}${change}%)` : ""}`;
    }
    case "DataTable": {
      const cols = (props.columns as string[]) ?? [];
      const rowCount = (props.rows as unknown[])?.length ?? 0;
      return `[Table] ${title} — ${cols.length} columns, ${rowCount} rows (columns: ${cols.join(", ")})`;
    }
    case "BarChart":
    case "LineChart":
    case "PieChart": {
      const data = (props.data as { label?: string; value?: number }[]) ?? [];
      const top3 = data
        .slice(0, 3)
        .map((d) => `${d.label ?? "?"}: ${d.value ?? "?"}`)
        .join("; ");
      return `[${componentName}] ${title} — ${data.length} data points (${top3}${data.length > 3 ? "; …" : ""})`;
    }
    case "MetricGrid": {
      const metrics = (props.metrics as { title?: string; value?: unknown }[]) ?? [];
      const names = metrics.map((m) => m.title ?? "?").join(", ");
      return `[MetricGrid] ${title} — ${metrics.length} metrics: ${names}`;
    }
    case "SummaryCard": {
      const content = (props.content as string) ?? "";
      return `[Summary] ${title} — ${content.slice(0, 120)}${content.length > 120 ? "…" : ""}`;
    }
    case "AnomalyCard": {
      const metric = (props.metricName as string) ?? "";
      const pct = props.changePercent as number | undefined;
      return `[Anomaly] ${metric}${pct != null ? ` ${pct > 0 ? "+" : ""}${pct}%` : ""} — ${(props.description as string) ?? ""}`;
    }
    default:
      return `[${componentName}] ${title || JSON.stringify(props).slice(0, 120)}`;
  }
}

/**
 * Check if a string is raw JSON (tool-result blob).
 */
function isRawJson(text: string): boolean {
  const trimmed = text.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try { JSON.parse(trimmed); return true; } catch { return false; }
  }
  return false;
}

/**
 * Flatten the Tambo thread messages into a compact text transcript the LLM
 * can turn into a narrative report.
 */
function buildTranscript(messages: ReportThreadMessage[]): string {
  const lines: string[] = [];

  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`USER: ${msg.text}`);
    } else {
      // Assistant text — filter out raw JSON tool output lines
      if (msg.text) {
        const cleaned = msg.text
          .split("\n")
          .filter((line) => !isRawJson(line))
          .join("\n")
          .trim();
        if (cleaned) {
          lines.push(`ASSISTANT: ${cleaned}`);
        }
      }
      // Attached visualisation
      if (msg.componentName && msg.componentProps) {
        lines.push(
          `  VISUALISATION: ${describeComponent(msg.componentName, msg.componentProps)}`
        );
      }
    }
  }

  return lines.join("\n");
}

// ─── Report Generation ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior data analyst writing an executive briefing.
You will receive the transcript of an analytics chat session — a sequence of user questions and AI-generated answers, some accompanied by charts or tables.

Your job is to synthesise this into a polished, self-contained **Markdown** report that reads like a mini executive briefing / data story.

STRUCTURE (use these exact headings):
# <Report Title — a concise, descriptive title derived from the conversation>

## Executive Summary
A 2-4 sentence overview of the key findings. Highlight the single most important takeaway.

## Key Findings
For each meaningful insight from the conversation, write a sub-section:
### <Finding Title>
- Describe the finding in business terms.
- Reference the underlying data (numbers, percentages, comparisons).
- If a chart/table was shown, describe what it revealed — e.g. "A bar chart showed Product A leading at $1.2M, followed by…"

## Data Sources & Methodology
Briefly note what tables/queries were used and any caveats (row limits, time ranges, etc.).

## Recommendations
If the data suggests any actions, list 2-4 actionable recommendations.

## Appendix — Queries & Visualisations
For each visualisation that appeared in the chat, list:
- The component type (Bar Chart, Table, KPI Card, etc.)
- A brief description of what it showed.

GUIDELINES:
- Write in third person, professional tone.
- Use **bold** for key numbers.
- Keep it concise — aim for 400-800 words total.
- Use markdown formatting (headers, bullet lists, bold, tables) liberally.
- Do NOT invent data that wasn't in the transcript.
- Output raw Markdown only — no code fences around the whole document.`;

export async function generateReport(
  messages: ReportThreadMessage[],
  opts: {
    dataSourceId?: string;
    userId?: string;
    threadId?: string;
  } = {}
): Promise<Report> {
  const transcript = buildTranscript(messages);

  let markdown: string;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      prompt: transcript,
      maxOutputTokens: 2048,
      temperature: 0.4,
    });
    markdown = text.trim();
  } catch (err) {
    // Heuristic fallback — build a simple markdown report from the raw transcript
    console.error("[report-service] LLM generation failed, using fallback:", err);
    markdown = buildFallbackReport(messages);
  }

  // Extract title from the first H1 or first line
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Analytics Report";

  const shareToken = generateShareToken();

  const row = await queryOne<{
    id: string;
    created_at: string;
  }>(
    `INSERT INTO reports (user_id, data_source_id, thread_id, title, markdown_content, share_token, message_count)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, created_at`,
    [
      opts.userId ?? null,
      opts.dataSourceId ?? null,
      opts.threadId ?? null,
      title,
      markdown,
      shareToken,
      messages.length,
    ]
  );

  return {
    id: row!.id,
    userId: opts.userId,
    dataSourceId: opts.dataSourceId,
    threadId: opts.threadId,
    title,
    markdownContent: markdown,
    shareToken,
    messageCount: messages.length,
    createdAt: row!.created_at,
  };
}

// ─── Retrieval ───────────────────────────────────────────────────────────────

interface ReportRow {
  id: string;
  user_id: string | null;
  data_source_id: string | null;
  thread_id: string | null;
  title: string;
  markdown_content: string;
  share_token: string;
  message_count: number;
  created_at: string;
}

function rowToReport(row: ReportRow): Report {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    dataSourceId: row.data_source_id ?? undefined,
    threadId: row.thread_id ?? undefined,
    title: row.title,
    markdownContent: row.markdown_content,
    shareToken: row.share_token,
    messageCount: row.message_count,
    createdAt: row.created_at,
  };
}

export async function getReportById(id: string): Promise<Report | null> {
  const row = await queryOne<ReportRow>(
    "SELECT * FROM reports WHERE id = $1",
    [id]
  );
  return row ? rowToReport(row) : null;
}

export async function getReportByShareToken(
  token: string
): Promise<Report | null> {
  const row = await queryOne<ReportRow>(
    "SELECT * FROM reports WHERE share_token = $1",
    [token]
  );
  return row ? rowToReport(row) : null;
}

export async function getReportsByUser(userId: string): Promise<Report[]> {
  const rows = await query<ReportRow>(
    "SELECT * FROM reports WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50",
    [userId]
  );
  return rows.map(rowToReport);
}

// ─── Fallback (no LLM) ──────────────────────────────────────────────────────

function buildFallbackReport(messages: ReportThreadMessage[]): string {
  const lines: string[] = ["# Analytics Report\n"];
  lines.push("## Executive Summary\n");

  // Count user questions
  const userQuestions = messages.filter((m) => m.role === "user");
  const visualisations = messages.filter((m) => m.componentName);
  lines.push(
    `This report summarises an analytics session covering **${userQuestions.length}** question${userQuestions.length !== 1 ? "s" : ""}` +
    (visualisations.length > 0 ? `, with **${visualisations.length}** visualisation${visualisations.length !== 1 ? "s" : ""}` : "") +
    " generated.\n"
  );

  lines.push("## Key Findings\n");

  let sectionIdx = 1;
  for (const msg of messages) {
    if (msg.role === "user") {
      lines.push(`### ${sectionIdx}. ${msg.text}\n`);
      sectionIdx++;
    } else {
      if (msg.text) {
        // Skip raw JSON blobs from tool results
        const cleaned = msg.text
          .split("\n")
          .filter((line) => !isRawJson(line))
          .join("\n")
          .trim();
        if (cleaned) {
          lines.push(cleaned + "\n");
        }
      }
      if (msg.componentName && msg.componentProps) {
        lines.push(
          `> **Visualisation**: ${describeComponent(msg.componentName, msg.componentProps)}\n`
        );
      }
    }
  }

  lines.push("## Data Sources & Methodology\n");
  lines.push(
    "Data was queried through Tambo Lens using safe, read-only SELECT queries against the connected database.\n"
  );

  return lines.join("\n");
}
