export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { initializeDatabase } from "@/lib/db";
import { ensureDemoUser, associateOrphanedDataWithDemoUser } from "@/lib/services/auth-service";
import { ensureDemoDataSource } from "@/lib/services/data-source-service";
import type { ApiResponse } from "@/lib/types";

/**
 * POST /api/init — Initialize the internal metadata database.
 * Call once during first setup.
 */
export async function POST(): Promise<NextResponse<ApiResponse<{ initialized: boolean }>>> {
  try {
    await initializeDatabase();
    // Seed the demo user and assign any orphaned data
    const demoUser = await ensureDemoUser();
    await associateOrphanedDataWithDemoUser();
    // Provision a demo data source so the demo user has something to query
    await ensureDemoDataSource(demoUser.id);
    return NextResponse.json({
      success: true,
      data: { initialized: true },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Initialization failed",
      },
      { status: 500 }
    );
  }
}
