import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Next.js 16 proxy convention — edge middleware for authentication gating.
 */
async function handler(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow auth-related routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow the init endpoint (needed for DB setup)
  if (pathname === "/api/init") {
    return NextResponse.next();
  }

  // Allow public report access via share token
  if (
    pathname.match(/^\/api\/reports\/[^/]+$/) &&
    req.nextUrl.searchParams.has("token")
  ) {
    return NextResponse.next();
  }

  // Protect all other API routes — return 401 if not authenticated
  if (pathname.startsWith("/api/")) {
    const token = await getToken({ req, secret: process.env.AUTH_SECRET });
    if (!token) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // For all other routes (pages), let them through — the client handles auth gating
  return NextResponse.next();
}

export const proxy = handler;

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
