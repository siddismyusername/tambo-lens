import { NextRequest, NextResponse } from "next/server";
import { getDataSource, cacheSchema, getCachedSchema } from "@/lib/services/data-source-service";
import { introspectPostgresSchema } from "@/lib/connectors/postgres";
import type { ApiResponse, DatabaseSchema } from "@/lib/types";

/** GET /api/data-sources/[id]/schema — Get cached or fresh schema */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ApiResponse<DatabaseSchema>>> {
  try {
    const { id } = await params;

    // Try cache first
    const cached = await getCachedSchema(id);
    if (cached) {
      return NextResponse.json({ success: true, data: cached });
    }

    // Fresh introspection
    const ds = await getDataSource(id);
    if (!ds) {
      return NextResponse.json(
        { success: false, error: "Data source not found" },
        { status: 404 }
      );
    }

    const schema = await introspectPostgresSchema(ds);
    await cacheSchema(id, schema);

    return NextResponse.json({ success: true, data: schema });
  } catch (err) {
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
    const { id } = await params;
    const ds = await getDataSource(id);
    if (!ds) {
      return NextResponse.json(
        { success: false, error: "Data source not found" },
        { status: 404 }
      );
    }

    const schema = await introspectPostgresSchema(ds);
    await cacheSchema(id, schema);

    return NextResponse.json({ success: true, data: schema });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Schema introspection failed",
      },
      { status: 500 }
    );
  }
}
