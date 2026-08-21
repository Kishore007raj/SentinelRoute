import { NextResponse, NextRequest } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    const userId = authResult.userId;

    const { fcmToken } = await req.json();
    if (!fcmToken) {
      return NextResponse.json({ error: "Missing fcmToken" }, { status: 400 });
    }

    const db = await getDb();
    
    await db.collection("users").updateOne(
      { userId: userId },
      { $set: { fcmToken, updatedAt: new Date().toISOString() } }
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    if (error instanceof Response) return handleAuthError(error);
    console.error("[POST /api/auth/fcm-token]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
