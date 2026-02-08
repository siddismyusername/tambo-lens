import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { generateReport, getReportsByUser } from "@/lib/services/report-service";
import type { ApiResponse, Report, ReportThreadMessage } from "@/lib/types";

/**
 * POST /api/reports — Generate a new report from a chat thread
 *
 * Body: { messages: ReportThreadMessage[], dataSourceId?: string, threadId?: string }
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<Report>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const messages: ReportThreadMessage[] = body.messages;

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { success: false, error: "messages array is required and must not be empty" },
        { status: 400 }
      );
    }

    const report = await generateReport(messages, {
      dataSourceId: body.dataSourceId ?? undefined,
      userId,
      threadId: body.threadId ?? undefined,
    });

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    console.error("[POST /api/reports] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Report generation failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reports — List reports for the current user
 */
export async function GET(): Promise<NextResponse<ApiResponse<Report[]>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const reports = await getReportsByUser(userId);
    return NextResponse.json({ success: true, data: reports });
  } catch (err) {
    console.error("[GET /api/reports] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch reports",
      },
      { status: 500 }
    );
  }
}
