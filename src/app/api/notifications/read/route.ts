import { NextResponse, NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    const userId = authResult.userId;

    const { notificationId } = await req.json();
    if (!notificationId) {
      return NextResponse.json({ error: "Missing notificationId" }, { status: 400 });
    }

    const db = await getDb();
    
    const result = await db.collection("notifications").updateOne(
      { id: notificationId, userId: userId },
      { $set: { read: true, readAt: new Date().toISOString() } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Notification not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("[POST /api/notifications/read]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
