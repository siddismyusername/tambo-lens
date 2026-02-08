export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createDataSourceSchema } from "@/lib/schemas";
import {
  createDataSource,
  getDataSources,
  updateDataSourceStatus,
} from "@/lib/services/data-source-service";
import {
  testConnection,
  introspectPostgresSchema,
} from "@/lib/connectors/postgres";
import { getDataSource, cacheSchema } from "@/lib/services/data-source-service";
import { getCurrentUserId } from "@/lib/auth";
import { runAnomalyScan } from "@/lib/services/anomaly-service";
import { generateSuggestedQuestions } from "@/lib/services/suggestion-service";
import type { ApiResponse, DataSourceSafe } from "@/lib/types";

export async function GET(): Promise<NextResponse<ApiResponse<DataSourceSafe[]>>> {
  try {
    const userId = await getCurrentUserId();
    const sources = await getDataSources(userId ?? undefined);
    return NextResponse.json({ success: true, data: sources });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch data sources",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<DataSourceSafe>>> {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const parsed = createDataSourceSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    // Create the data source
    const dataSource = await createDataSource(parsed.data, userId ?? undefined);

    // Test connectivity
    const fullDs = await getDataSource(dataSource.id);
    if (fullDs) {
      const testResult = await testConnection(fullDs);
      if (testResult.success) {
        await updateDataSourceStatus(dataSource.id, "connected");
        dataSource.status = "connected";

        // Auto-introspect schema
        try {
          const schema = await introspectPostgresSchema(fullDs);
          await cacheSchema(dataSource.id, schema);

          // Trigger proactive anomaly scan (non-blocking)
          runAnomalyScan(dataSource.id, userId ?? undefined).catch(() => {
            // Anomaly scan failure is non-blocking
          });

          // Trigger smart question generation (non-blocking)
          generateSuggestedQuestions(dataSource.id).catch(() => {
            // Suggestion generation failure is non-blocking
          });
        } catch {
          // Schema introspection failure is non-blocking
        }
      } else {
        await updateDataSourceStatus(dataSource.id, "error");
        dataSource.status = "error";
      }
    }

    return NextResponse.json({ success: true, data: dataSource }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create data source",
      },
      { status: 500 }
    );
  }
}
