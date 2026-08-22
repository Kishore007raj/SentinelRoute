import { NextResponse, NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    const userId = authResult.userId;

    const db = await getDb();
    
    await db.collection("notifications").updateMany(
      { userId: userId, read: false },
      { $set: { read: true, readAt: new Date().toISOString() } }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Response) return handleAuthError(error);
    console.error("[POST /api/notifications/read-all]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
