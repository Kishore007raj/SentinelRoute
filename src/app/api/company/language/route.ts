import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import type { UserRecord } from "@/lib/types";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import { updateCompanySettings } from "@/lib/company-settings";

/**
 * GET /api/company/language
 * Returns the company's language configuration.
 *
 * PATCH /api/company/language
 * Updates preferredLanguage, supportedLanguages, and/or fallbackLanguage.
 * Requires company_admin or super_admin role.
 *
 * Body: {
 *   preferredLanguage?:  string,
 *   supportedLanguages?: string[],
 *   fallbackLanguage?:   string
 * }
 */

export async function GET(req: NextRequest) {
  let userId: string;
  try {
    const verified = await verifyFirebaseToken(req);
    userId = verified.uid;
  } catch (err) {
    if (err instanceof Response) return err;
    return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
  }

  try {
    const db = await getDb();
    const userRecord = await db.collection<UserRecord>("users").findOne({ userId });
    if (!userRecord?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const settings = await db
      .collection("company_settings")
      .findOne({ companyId: userRecord.companyId });

    return NextResponse.json({
      preferredLanguage:  settings?.language ?? "en",
      supportedLanguages: settings?.supportedLanguages ?? ["en"],
      fallbackLanguage:   settings?.fallbackLanguage ?? "en",
    });
  } catch (err) {
    console.error("[GET /api/company/language]", err);
    return NextResponse.json({ error: "Failed to fetch language settings" }, { status: 503 });
  }
}

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

  try {
    const db = await getDb();
    const userRecord = await db.collection<UserRecord>("users").findOne({ userId });
    if (!userRecord?.companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    // Only company_admin or super_admin can change language settings
    if (userRecord.role !== "company_admin" && userRecord.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const validLocales = new Set(SUPPORTED_LOCALES as readonly string[]);

    // Validate preferredLanguage
    const preferred = body.preferredLanguage as string | undefined;
    if (preferred !== undefined && !validLocales.has(preferred)) {
      return NextResponse.json(
        { error: `Unsupported language: ${preferred}. Supported: ${SUPPORTED_LOCALES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate supportedLanguages array
    const supported = body.supportedLanguages as string[] | undefined;
    if (supported !== undefined) {
      if (!Array.isArray(supported) || supported.some((l) => !validLocales.has(l))) {
        return NextResponse.json(
          { error: "supportedLanguages contains unsupported locale codes" },
          { status: 400 }
        );
      }
    }

    // Validate fallbackLanguage
    const fallback = body.fallbackLanguage as string | undefined;
    if (fallback !== undefined && !validLocales.has(fallback)) {
      return NextResponse.json(
        { error: `Unsupported fallback language: ${fallback}` },
        { status: 400 }
      );
    }

    // Build the patch — only include provided fields
    const patch: Record<string, unknown> = {};
    if (preferred !== undefined) patch.language = preferred;
    if (supported !== undefined) patch.supportedLanguages = supported;
    if (fallback  !== undefined) patch.fallbackLanguage = fallback;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Persist via company-settings helper
    const updated = await updateCompanySettings(
      db,
      userRecord.companyId,
      patch as Parameters<typeof updateCompanySettings>[2]
    );

    // Also update the companies collection for quick access
    await db.collection("companies").updateOne(
      { companyId: userRecord.companyId },
      {
        $set: {
          ...(preferred !== undefined && { preferredLanguage: preferred }),
          ...(supported !== undefined && { supportedLanguages: supported }),
          ...(fallback  !== undefined && { fallbackLanguage: fallback }),
        },
      }
    );

    return NextResponse.json({
      preferredLanguage:  updated.language,
      supportedLanguages: updated.supportedLanguages,
      fallbackLanguage:   updated.fallbackLanguage,
    });
  } catch (err) {
    console.error("[PATCH /api/company/language]", err);
    return NextResponse.json({ error: "Failed to update language settings" }, { status: 500 });
  }
}
