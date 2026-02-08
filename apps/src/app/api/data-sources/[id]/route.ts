export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  getDataSourceSafe,
  deleteDataSource,
  updateDataSourceStatus,
  assertDataSourceOwnership,
  AccessDeniedError,
  NotFoundError,
} from "@/lib/services/data-source-service";
import { testConnection } from "@/lib/connectors/postgres";
import { getCurrentUserId } from "@/lib/auth";
import type { ApiResponse, DataSourceSafe } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<DataSourceSafe>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const { id } = await params;
    await assertDataSourceOwnership(id, userId);
    const ds = await getDataSourceSafe(id);
    if (!ds) {
      return NextResponse.json(
        { success: false, error: "Data source not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: ds });
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ deleted: boolean }>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const { id } = await params;
    await assertDataSourceOwnership(id, userId);
    await deleteDataSource(id);
    return NextResponse.json({ success: true, data: { deleted: true } });
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

/** POST /api/data-sources/[id]/test — Re-test connection */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<{ connected: boolean; error?: string }>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const { id } = await params;
    const ds = await assertDataSourceOwnership(id, userId);
    const result = await testConnection(ds);
    await updateDataSourceStatus(
      id,
      result.success ? "connected" : "error"
    );
    return NextResponse.json({
      success: true,
      data: { connected: result.success, error: result.error },
    });
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
