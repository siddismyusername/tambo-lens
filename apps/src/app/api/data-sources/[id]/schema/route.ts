import { NextRequest, NextResponse } from "next/server";
import {
  cacheSchema,
  getCachedSchema,
  assertDataSourceOwnership,
  AccessDeniedError,
  NotFoundError,
} from "@/lib/services/data-source-service";
import { introspectPostgresSchema } from "@/lib/connectors/postgres";
import { getCurrentUserId } from "@/lib/auth";
import type { ApiResponse, DatabaseSchema } from "@/lib/types";

/** GET /api/data-sources/[id]/schema — Get cached or fresh schema */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<DatabaseSchema>>> {
  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 }
      );
    }
    const { id } = await params;

    // Try cache first
    const cached = await getCachedSchema(id);
    if (cached) {
      // Still verify ownership even for cached results
      await assertDataSourceOwnership(id, userId);
      return NextResponse.json({ success: true, data: cached });
    }

    // Fresh introspection — ownership check returns the full DataSource
    const ds = await assertDataSourceOwnership(id, userId);
    const schema = await introspectPostgresSchema(ds);
    await cacheSchema(id, schema);

    return NextResponse.json({ success: true, data: schema });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch schema",
      },
      { status: 500 }
    );
  }
}

/** POST /api/data-sources/[id]/schema — Force re-introspect */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<DatabaseSchema>>> {
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
    const schema = await introspectPostgresSchema(ds);
    await cacheSchema(id, schema);

    return NextResponse.json({ success: true, data: schema });
  } catch (err) {
    if (err instanceof NotFoundError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 404 });
    }
    if (err instanceof AccessDeniedError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Schema introspection failed",
      },
      { status: 500 }
    );
  }
}
