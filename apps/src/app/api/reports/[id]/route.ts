import { NextRequest, NextResponse } from "next/server";
import {
  getReportById,
  getReportByShareToken,
} from "@/lib/services/report-service";
import { getCurrentUserId } from "@/lib/auth";
import type { ApiResponse, Report } from "@/lib/types";

/**
 * GET /api/reports/[id] — Fetch a single report
 *
 * Supports two access patterns:
 *  1. By ID (requires auth + ownership)
 *  2. By share token: ?token=<shareToken> (public, no auth needed)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<Report>>> {
  try {
    const { id } = await params;
    const url = new URL(_req.url);
    const shareToken = url.searchParams.get("token");

    let report: Report | null = null;

    if (shareToken) {
      // Public access by share token — skip auth (middleware already passed)
      report = await getReportByShareToken(shareToken);
    } else {
      // Authenticated access — verify the report belongs to the user
      const userId = await getCurrentUserId();
      if (!userId) {
        return NextResponse.json(
          { success: false, error: "Authentication required" },
          { status: 401 }
        );
      }
      report = await getReportById(id);
      if (report && report.userId && report.userId !== userId) {
        return NextResponse.json(
          { success: false, error: "Access denied" },
          { status: 403 }
        );
      }
    }

    if (!report) {
      return NextResponse.json(
        { success: false, error: "Report not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: report });
  } catch (err) {
    console.error("[GET /api/reports/[id]] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch report",
      },
      { status: 500 }
    );
  }
}
