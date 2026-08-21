import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { utcNow } from "@/lib/time";
import { emitToCompany } from "@/lib/socket-server";

/**
 * POST /api/intelligence/shipments/[id]/messages/read
 * Marks all unread messages in this channel as read by the current user.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, company } = await requireCompany(req);
    const { id: shipmentId } = await params;

    const db = await getDb();
    const now = utcNow();

    const result = await db.collection("shipment_messages").updateMany(
      {
        shipmentId,
        companyId: company.companyId,
        readStatus: false,
        senderId: { $ne: userId }, // don't mark our own messages
      },
      {
        $set: {
          readStatus: true,
          readAt: now,
        },
      }
    );

    // Emit socket event so the sender sees the read receipt
    emitToCompany(company.companyId, "message:read", {
      shipmentId,
      readBy: userId,
      readAt: now,
      count: result.modifiedCount,
    });

    return NextResponse.json({
      success: true,
      markedRead: result.modifiedCount,
      readAt: now,
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
