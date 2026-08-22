import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { ShipmentMessage } from "@/lib/types";
import { addTimelineEvent } from "@/lib/timeline-service";
import { createIntelligenceAudit } from "@/lib/intelligence-audit";
import { encryptObjectFields, decryptObjectFields } from "@/lib/encryption";
import { emitToCompany } from "@/lib/socket-server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(req);
    const isSuperAdmin = userRecord.role === "super_admin";

    let companyId = company.companyId;
    const url = new URL(req.url);
    const targetCompanyId = url.searchParams.get("companyId");
    if (isSuperAdmin && targetCompanyId) {
      companyId = targetCompanyId;
    }

    const { id } = await params;

    const db = await getDb();
    
    // Verify shipment access
    const shipment = await db.collection("shipments").findOne({ id, companyId });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // super_admin audit (fire-and-forget)
    if (isSuperAdmin && targetCompanyId) {
      createIntelligenceAudit({
        companyId,
        userId:    userRecord.userId,
        eventType: "super_admin_read",
        source:    "ShipmentMessagesRoute",
        metadata: {
          companyIdViewed: companyId,
          shipmentId:      id,
          endpoint:        `/api/intelligence/shipments/${id}/messages`,
          timestamp:       new Date().toISOString(),
        },
      }).catch(() => {});
    }

    const messages = await db.collection("shipment_messages")
      .find({ shipmentId: id, companyId })
      .sort({ timestamp: 1 })
      .toArray();

    return NextResponse.json({ 
      messages: messages.map(({ _id: _omit, ...rest }) => decryptObjectFields(rest, ["message", "caption", "notes", "textPayload"])) 
    });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(req);
    const companyId = company.companyId;
    const { id } = await params;
    const body = await req.json();

    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    const db = await getDb();
    const shipment = await db.collection("shipments").findOne({ id, companyId });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    if (shipment.status === "completed") {
      return NextResponse.json({ error: "Cannot send messages for completed shipments" }, { status: 400 });
    }

    // Ensure channel exists - atomic upsert to prevent duplicate key errors
    // Note: The unique index is on shipmentId only (not compound with companyId)
    const channel = await db.collection("shipment_channels").findOneAndUpdate(
      { shipmentId: id },
      {
        $setOnInsert: {
          channelId: `ch-${id}`,
          shipmentId: id,
          companyId,
          active: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      },
      { upsert: true, returnDocument: "after" }
    );
    const channelId = channel?.channelId as string;
    if (!channelId) {
      return NextResponse.json({ error: "Failed to create message channel" }, { status: 500 });
    }

    let senderRole: "Dispatcher" | "Driver" | "Operations Manager" | "System" = "Dispatcher";
    if (userRecord.role === "operations_manager" || userRecord.role === "company_admin" || userRecord.role === "company_manager") {
      senderRole = "Operations Manager";
    }

    const message: ShipmentMessage = {
      messageId:   `msg-${crypto.randomUUID()}`,
      channelId,
      shipmentId: id,
      companyId,
      senderType: senderRole,
      senderId: userRecord.userId,
      senderName: userRecord.name || "User",
      messageType: body.messageType || "text",
      message: body.message,
      fileUrl: body.fileUrl,
      fileName: body.fileName,
      fileSize: body.fileSize,
      fileType: body.fileType,
      timestamp: new Date().toISOString(),
      readStatus: false
    };

    const encryptedMessage = encryptObjectFields(message as unknown as Record<string, unknown>, ["message", "caption", "notes", "textPayload"]);

    await db.collection("shipment_messages").insertOne(encryptedMessage);

    // Add to timeline
    await addTimelineEvent(
      id,
      companyId,
      senderRole === "Operations Manager" ? "Dispatcher Message" : "Dispatcher Message",
      `Message: ${body.message.substring(0, 50)}${body.message.length > 50 ? '...' : ''}`,
      senderRole,
      100
    );

    createIntelligenceAudit({
      companyId,
      shipmentId: id,
      userId: userRecord.userId,
      eventType: "shipment_channel_message",
      source: "ShipmentMessagesRoute",
      metadata: {
        messageId: message.messageId,
        senderType: message.senderType,
        messageLength: message.message.length
      }
    }).catch(() => {});

    // Broadcast Real-time Events
    emitToCompany(companyId, "message:new", message);
    emitToCompany(companyId, "feed:updated", { type: "timeline", shipmentId: id });

    return NextResponse.json({ success: true, message });
  } catch (err: unknown) {
    return handleAuthError(err);
  }
}
