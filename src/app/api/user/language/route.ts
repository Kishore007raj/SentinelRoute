import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { UserRecord } from "@/lib/types";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

/**
 * PATCH /api/user/language
 *
 * Updates the authenticated user's personal preferredLanguage.
 * Every user can change their own language — no admin role required.
 *
 * Body: { language: string }
 *
 * This is separate from /api/company/language which changes the company default.
 */
export async function PATCH(req: NextRequest) {
  let userId: string;
  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const language = body.language as string | undefined;
  if (!language || typeof language !== "string") {
    return NextResponse.json({ error: "Missing required field: language" }, { status: 400 });
  }

  const validLocales = new Set(SUPPORTED_LOCALES as readonly string[]);
  if (!validLocales.has(language)) {
    return NextResponse.json(
      { error: `Unsupported language: ${language}. Supported: ${SUPPORTED_LOCALES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    const db = await getDb();

    // Update UserRecord.preferredLanguage
    await db.collection<UserRecord>("users").updateOne(
      { userId },
      { $set: { preferredLanguage: language } },
      { upsert: false } // user must already exist
    );

    // Also sync to user_settings.language so the settings context stays in sync
    await db.collection("user_settings").updateOne(
      { userId },
      { $set: { language, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );

    return NextResponse.json({ language, message: "Language preference updated" });
  } catch (err) {
    console.error("[PATCH /api/user/language]", err);
    return NextResponse.json({ error: "Failed to update language" }, { status: 500 });
  }
}
