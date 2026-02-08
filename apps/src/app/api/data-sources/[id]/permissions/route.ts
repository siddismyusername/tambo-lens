export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { updatePermissionsSchema } from "@/lib/schemas";
import {
  getPermissions,
  upsertPermissions,
  assertDataSourceOwnership,
  AccessDeniedError,
  NotFoundError,
} from "@/lib/services/data-source-service";
import { getCurrentUserId } from "@/lib/auth";
import type { ApiResponse, DataSourcePermissions } from "@/lib/types";

/** GET /api/data-sources/[id]/permissions — Get permissions for a data source */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<DataSourcePermissions>>> {
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
    const permissions = await getPermissions(id);
    return NextResponse.json({ success: true, data: permissions });
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

/** PUT /api/data-sources/[id]/permissions — Update permissions */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<DataSourcePermissions>>> {
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
