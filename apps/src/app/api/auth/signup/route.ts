export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createUser } from "@/lib/services/auth-service";
import type { ApiResponse } from "@/lib/types";

/** POST /api/auth/signup — Register a new user */
export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ id: string; email: string; name: string }>>> {
  try {
    const body = await req.json();
    const { email, password, name } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { success: false, error: "Email, password, and name are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    const user = await createUser({ email, password, name });

    return NextResponse.json(
      { success: true, data: { id: user.id, email: user.email, name: user.name } },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create account";
    const status = message.includes("already exists") ? 409 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
