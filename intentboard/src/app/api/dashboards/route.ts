import { NextRequest, NextResponse } from "next/server";
import { saveDashboard, getDashboards, getDashboard } from "@/lib/services/data-source-service";
import type { ApiResponse } from "@/lib/types";

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const dashboard = await getDashboard(id);
      if (!dashboard) {
        return NextResponse.json(
          { success: false, error: "Dashboard not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, data: dashboard });
    }

    const dashboards = await getDashboards();
    return NextResponse.json({ success: true, data: dashboards });
  } catch (err) {
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
    const body = await req.json();
    const result = await saveDashboard(body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
