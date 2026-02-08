import { NextRequest, NextResponse } from "next/server";
import {
  getDataSourceSafe,
  deleteDataSource,
  updateDataSourceStatus,
  getDataSource,
} from "@/lib/services/data-source-service";
import { testConnection } from "@/lib/connectors/postgres";
import type { ApiResponse, DataSourceSafe } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<DataSourceSafe>>> {
  try {
    const { id } = await params;
    const ds = await getDataSourceSafe(id);
    if (!ds) {
      return NextResponse.json(
        { success: false, error: "Data source not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: ds });
  } catch (err) {
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
    const { id } = await params;
    await deleteDataSource(id);
    return NextResponse.json({ success: true, data: { deleted: true } });
  } catch (err) {
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
    const { id } = await params;
    const ds = await getDataSource(id);
    if (!ds) {
      return NextResponse.json(
        { success: false, error: "Data source not found" },
        { status: 404 }
      );
    }
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
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
