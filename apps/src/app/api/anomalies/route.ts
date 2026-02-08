import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import {
  getAlerts,
  getAlertsByUser,
  markAlertsSeen,
  dismissAlert,
} from "@/lib/services/anomaly-service";
import type { ApiResponse, AnomalyAlert } from "@/lib/types";

/**
 * GET /api/anomalies — Fetch anomaly alerts.
 *
 * Query params:
 *   ?dataSourceId=<uuid>  — alerts for a specific data source
 *   ?dismissed=true        — include dismissed alerts
 *   ?limit=50              — max results
 *
 * If no dataSourceId is given, returns all alerts for the current user.
 */
export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<AnomalyAlert[]>>> {
  try {
    const userId = await getCurrentUserId();
    const { searchParams } = req.nextUrl;
    const dataSourceId = searchParams.get("dataSourceId");
    const includeDismissed = searchParams.get("dismissed") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);

    let alerts: AnomalyAlert[];

    if (dataSourceId) {
      alerts = await getAlerts(dataSourceId, { includeDismissed, limit });
    } else if (userId) {
      alerts = await getAlertsByUser(userId, { includeDismissed, limit });
    } else {
      alerts = [];
    }

    return NextResponse.json({ success: true, data: alerts });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch anomaly alerts",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/anomalies — Mark alerts as seen or dismissed.
 *
 * Body: { action: "seen", alertIds: [...] }
 *   or  { action: "dismiss", alertId: "..." }
 */
export async function PATCH(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ ok: boolean }>>> {
  try {
    const body = await req.json();

    if (body.action === "seen" && Array.isArray(body.alertIds)) {
      await markAlertsSeen(body.alertIds);
      return NextResponse.json({ success: true, data: { ok: true } });
    }

    if (body.action === "dismiss" && typeof body.alertId === "string") {
      await dismissAlert(body.alertId);
      return NextResponse.json({ success: true, data: { ok: true } });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action. Use 'seen' or 'dismiss'." },
      { status: 400 }
    );
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to update alerts",
      },
      { status: 500 }
    );
  }
}
