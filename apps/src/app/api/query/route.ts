import { NextRequest, NextResponse } from "next/server";
import { queryRequestSchema } from "@/lib/schemas";
import { executeGuardedQuery } from "@/lib/services/query-service";
import {
  assertDataSourceOwnership,
  AccessDeniedError,
  NotFoundError,
} from "@/lib/services/data-source-service";
import { getCurrentUserId } from "@/lib/auth";
import type { ApiResponse, QueryResult } from "@/lib/types";

/** POST /api/query — Execute a guarded query */
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<QueryResult>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = queryRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    const { dataSourceId, query, params } = parsed.data;

    // Verify ownership before executing
    await assertDataSourceOwnership(dataSourceId, userId);

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
    if (err instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Query execution failed",
      },
      { status: 500 }
    );
  }
}
