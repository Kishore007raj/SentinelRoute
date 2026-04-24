/**
 * middleware.ts — Route protection for the (app) group.
 *
 * Firebase Auth is client-side only, so we use a session cookie
 * set by the client after sign-in to protect server-rendered routes.
 *
 * Cookie name: "sr_session"
 * Set by: auth/signin and auth/signup pages after successful auth
 * Cleared by: sign-out action
 *
 * Protected paths: everything under /(app) — /dashboard, /shipments, etc.
 * Public paths: /, /auth/*, /demo, /api/*
 */

import { NextRequest, NextResponse } from "next/server";

// Paths that do NOT require authentication
const PUBLIC_PATHS = [
  "/",
  "/auth/signin",
  "/auth/signup",
  "/demo",
];

const SESSION_COOKIE = "sr_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow all API routes and Next.js internals through
  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Allow explicitly public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const session = req.cookies.get(SESSION_COOKIE);

  if (!session?.value) {
    // Not authenticated — redirect to sign-in, preserving the intended destination
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Run middleware on all routes except static files
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
