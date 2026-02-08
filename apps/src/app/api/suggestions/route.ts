export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  getSuggestedQuestions,
  generateSuggestedQuestions,
} from "@/lib/services/suggestion-service";
import {
  assertDataSourceOwnership,
  AccessDeniedError,
  NotFoundError,
} from "@/lib/services/data-source-service";
import { getCurrentUserId } from "@/lib/auth";
import type { ApiResponse, SuggestedQuestion } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/suggestions?dataSourceId=<uuid>
 * Returns cached suggested questions for a data source.
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<SuggestedQuestion[]>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const dataSourceId = req.nextUrl.searchParams.get("dataSourceId");
    if (!dataSourceId) {
      return NextResponse.json(
        { success: false, error: "dataSourceId query param is required" },
        { status: 400 }
      );
    }

    await assertDataSourceOwnership(dataSourceId, userId);

    const questions = await getSuggestedQuestions(dataSourceId);
    return NextResponse.json({ success: true, data: questions });
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
        error:
          err instanceof Error ? err.message : "Failed to fetch suggestions",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/suggestions — Force regenerate suggestions.
 * Body: { dataSourceId: "<uuid>" }
 */
export async function POST(
  req: NextRequest
): Promise<
  NextResponse<
    ApiResponse<{ question: string; category: string; icon: string }[]>
  >
> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const body = await req.json();
    const { dataSourceId } = body;

    if (!dataSourceId || typeof dataSourceId !== "string") {
      return NextResponse.json(
        { success: false, error: "dataSourceId is required" },
        { status: 400 }
      );
    }

    await assertDataSourceOwnership(dataSourceId, userId);

    const questions = await generateSuggestedQuestions(dataSourceId);
    return NextResponse.json({ success: true, data: questions });
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
        error:
          err instanceof Error
            ? err.message
            : "Failed to generate suggestions",
      },
      { status: 500 }
    );
  }
}
