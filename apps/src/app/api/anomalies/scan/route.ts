import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { runAnomalyScan, getLatestScan } from "@/lib/services/anomaly-service";
import type { ApiResponse, AnomalyScan } from "@/lib/types";

/**
 * POST /api/anomalies/scan — Trigger an anomaly detection scan.
 *
 * Body: { dataSourceId: "<uuid>" }
 *
 * Returns immediately with the scan record. The scan runs in-process
 * (awaited) so the response includes the final results.
 */
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ scanId: string; alertsFound: number }>>> {
  try {
    const userId = await getCurrentUserId();
    const body = await req.json();
    const { dataSourceId } = body;

    if (!dataSourceId || typeof dataSourceId !== "string") {
      return NextResponse.json(
        { success: false, error: "dataSourceId is required" },
        { status: 400 }
      );
    }

    const { scanId, alerts } = await runAnomalyScan(
      dataSourceId,
      userId ?? undefined
    );

    return NextResponse.json({
      success: true,
      data: { scanId, alertsFound: alerts.length },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Anomaly scan failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/anomalies/scan?dataSourceId=<uuid> — Get latest scan status.
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<AnomalyScan | null>>> {
  try {
    const { searchParams } = req.nextUrl;
    const dataSourceId = searchParams.get("dataSourceId");

    if (!dataSourceId) {
      return NextResponse.json(
        { success: false, error: "dataSourceId query param is required" },
        { status: 400 }
      );
    }

    const scan = await getLatestScan(dataSourceId);
    return NextResponse.json({ success: true, data: scan });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch scan status",
      },
      { status: 500 }
    );
  }
}
