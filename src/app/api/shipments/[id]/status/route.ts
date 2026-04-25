import { NextRequest, NextResponse } from "next/server";
import { getShipmentsCollection } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { status } = await req.json();
    const id = params.id;

    if (!["pending", "in_transit", "completed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const collection = await getShipmentsCollection();
    
    let filter: any = {};
    try {
      filter = { _id: new ObjectId(id) };
    } catch {
      filter = { id: id }; // Fallback for custom IDs
    }

    const result = await collection.updateOne(
      filter,
      { 
        $set: { 
          status, 
          updatedAt: new Date().toISOString() 
        } 
      }
    );

    if (result.matchedCount === 0) {
      // Try by shipmentId
      const result2 = await collection.updateOne(
        { shipmentId: id },
        { 
          $set: { 
            status, 
            updatedAt: new Date().toISOString() 
          } 
        }
      );
      if (result2.matchedCount === 0) {
        return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH Shipment Status Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
