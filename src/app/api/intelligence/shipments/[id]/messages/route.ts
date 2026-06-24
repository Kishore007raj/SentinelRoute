import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { ShipmentMessage } from "@/lib/types";
import { addTimelineEvent } from "@/lib/timeline-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { company } = await requireCompany(req as any);
    const companyId = company.companyId;
    const { id } = await params;

    const db = await getDb();
    
    // Verify shipment access
    const shipment = await db.collection("shipments").findOne({ id, companyId });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const messages = await db.collection("shipment_messages")
      .find({ shipmentId: id, companyId })
      .sort({ timestamp: 1 })
      .toArray();

    return NextResponse.json({ messages: messages.map(({_id, ...rest}) => rest) });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/intelligence/shipments/[id]/messages]", err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userRecord, company } = await requireCompany(req as any);
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

    // Ensure channel exists
    let channel = await db.collection("shipment_channels").findOne({ shipmentId: id, companyId });
    if (!channel) {
      const newChannel = {
        channelId: `ch-${id}`,
        shipmentId: id,
        companyId,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await db.collection("shipment_channels").insertOne(newChannel);
      channel = newChannel as any;
    }

    let senderRole: "Dispatcher" | "Driver" | "Operations Manager" | "System" = "Dispatcher";
    if (userRecord.role === "operations_manager" || userRecord.role === "company_admin" || userRecord.role === "company_manager") {
      senderRole = "Operations Manager";
    }

    const message: ShipmentMessage = {
      messageId: `msg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      channelId: channel!.channelId,
      shipmentId: id,
      companyId,
      senderType: senderRole,
      senderId: userRecord.userId,
      senderName: userRecord.name || "User",
      messageType: body.messageType || "text",
      message: body.message,
      fileUrl: body.fileUrl,
      timestamp: new Date().toISOString(),
      readStatus: false
    };

    await db.collection("shipment_messages").insertOne(message);

    // Add to timeline
    await addTimelineEvent(
      id,
      companyId,
      senderRole === "Operations Manager" ? "Dispatcher Message" : "Dispatcher Message",
      `Message: ${body.message.substring(0, 50)}${body.message.length > 50 ? '...' : ''}`,
      senderRole,
      100
    );

    return NextResponse.json({ success: true, message });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[POST /api/intelligence/shipments/[id]/messages]", err);
    return NextResponse.json({ error: "Failed to post message" }, { status: 500 });
  }
}
