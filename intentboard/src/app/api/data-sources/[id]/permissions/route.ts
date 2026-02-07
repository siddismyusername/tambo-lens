import { NextRequest, NextResponse } from "next/server";
import { updatePermissionsSchema } from "@/lib/schemas";
import {
  getPermissions,
  upsertPermissions,
} from "@/lib/services/data-source-service";
import type { ApiResponse, DataSourcePermissions } from "@/lib/types";

/** GET /api/data-sources/[id]/permissions — Get permissions for a data source */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<DataSourcePermissions>>> {
  try {
    const { id } = await params;
    const permissions = await getPermissions(id);
    return NextResponse.json({ success: true, data: permissions });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}

/** PUT /api/data-sources/[id]/permissions — Update permissions */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<DataSourcePermissions>>> {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updatePermissionsSchema.safeParse({
      dataSourceId: id,
      ...body,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues.map((e) => e.message).join(", ") },
        { status: 400 }
      );
    }

    await upsertPermissions(id, parsed.data.permissions);
    const updated = await getPermissions(id);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Error" },
      { status: 500 }
    );
  }
}
