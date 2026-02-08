import { NextRequest, NextResponse } from "next/server";
import { queryRequestSchema } from "@/lib/schemas";
import { executeGuardedQuery } from "@/lib/services/query-service";
import type { ApiResponse, QueryResult } from "@/lib/types";

/** POST /api/query — Execute a guarded query */
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<QueryResult>>> {
  try {
    const body = await req.json();
    const parsed = queryRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { dataSourceId, query, params } = parsed.data;
    const { result, validation } = await executeGuardedQuery(
      dataSourceId,
      query,
      params
    );

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: `Query validation failed: ${validation.errors.join("; ")}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Query execution failed",
      },
      { status: 500 }
    );
  }
}
