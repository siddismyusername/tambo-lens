import { NextRequest, NextResponse } from "next/server";
import {
  getSuggestedQuestions,
  generateSuggestedQuestions,
} from "@/lib/services/suggestion-service";
import type { ApiResponse, SuggestedQuestion } from "@/lib/types";

/**
 * GET /api/suggestions?dataSourceId=<uuid>
 * Returns cached suggested questions for a data source.
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<SuggestedQuestion[]>>> {
  try {
    const dataSourceId = req.nextUrl.searchParams.get("dataSourceId");
    if (!dataSourceId) {
      return NextResponse.json(
        { success: false, error: "dataSourceId query param is required" },
        { status: 400 }
      );
    }

    const questions = await getSuggestedQuestions(dataSourceId);
    return NextResponse.json({ success: true, data: questions });
  } catch (err) {
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
    const body = await req.json();
    const { dataSourceId } = body;

    if (!dataSourceId || typeof dataSourceId !== "string") {
      return NextResponse.json(
        { success: false, error: "dataSourceId is required" },
        { status: 400 }
      );
    }

    const questions = await generateSuggestedQuestions(dataSourceId);
    return NextResponse.json({ success: true, data: questions });
  } catch (err) {
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
