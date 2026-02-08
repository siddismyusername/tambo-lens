import { NextRequest, NextResponse } from "next/server";
import {
  saveDashboard,
  getDashboards,
  getDashboard,
  updateDashboard,
  assertDashboardOwnership,
  AccessDeniedError,
  NotFoundError,
} from "@/lib/services/data-source-service";
import { getCurrentUserId } from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      await assertDashboardOwnership(id, userId);
      const dashboard = await getDashboard(id);
      if (!dashboard) {
        return NextResponse.json(
          { success: false, error: "Dashboard not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: dashboard });
    }

    const dashboards = await getDashboards(userId);
    return NextResponse.json({ success: true, data: dashboards });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const body = await req.json();
    const result = await saveDashboard(body, userId);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Missing dashboard id" },
        { status: 400 }
      );
    }

    await assertDashboardOwnership(id, userId);
    const body = await req.json();
    const result = await updateDashboard(id, body);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
