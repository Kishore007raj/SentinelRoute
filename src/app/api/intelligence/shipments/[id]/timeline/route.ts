import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getShipmentTimeline } from "@/lib/timeline-service";
import { getDb } from "@/lib/mongodb";

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

    const timeline = await getShipmentTimeline(id);

    return NextResponse.json({ timeline });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/intelligence/shipments/[id]/timeline]", err);
    return NextResponse.json({ error: "Failed to fetch timeline" }, { status: 500 });
  }
}
