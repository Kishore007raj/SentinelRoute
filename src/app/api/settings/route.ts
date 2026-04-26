import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { getUserIdFromRequest } from "@/lib/auth";
import type { UserSettings } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

/**
 * GET /api/settings
 * Returns the authenticated user's settings.
 * Returns defaults if no settings document exists yet.
 *
 * POST /api/settings
 * Upserts the authenticated user's settings.
 */

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let userId: string | null;
  try {
    userId = await getUserIdFromRequest(req);
  } catch {
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = await getDb();
    const doc = await db.collection("user_settings").findOne({ userId });

    if (!doc) {
      // Return defaults — no document yet
      const defaults: UserSettings = {
        ...DEFAULT_SETTINGS,
        userId,
        updatedAt: new Date().toISOString(),
      };
      return NextResponse.json({ settings: defaults });
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...settings } = doc;
    return NextResponse.json({ settings: settings as UserSettings });
  } catch (err) {
    console.error("[GET /api/settings] DB error:", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 503 });
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let userId: string | null;
  try {
    userId = await getUserIdFromRequest(req);
  } catch {
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Partial<Omit<UserSettings, "userId" | "updatedAt">>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const update: Partial<UserSettings> = { ...body, userId, updatedAt: now };

  try {
    const db = await getDb();
    await db.collection("user_settings").updateOne(
      { userId },
      { $set: update },
      { upsert: true }
    );

    // Return the full merged settings
    const doc = await db.collection("user_settings").findOne({ userId });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...settings } = doc!;
    return NextResponse.json({ settings: settings as UserSettings });
  } catch (err) {
    console.error("[POST /api/settings] DB error:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
