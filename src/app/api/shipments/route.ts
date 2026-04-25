import { NextRequest, NextResponse } from "next/server";
import { getShipmentsCollection } from "@/lib/mongodb";
import { Shipment } from "@/lib/types";

function getUserId(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return "demo-user"; // Default for demo if no auth
  return auth.replace("Bearer ", "").trim() || "demo-user";
}

export async function GET(req: NextRequest) {
  const userId = getUserId(req);
  
  try {
    const collection = await getShipmentsCollection();
    const shipments = await collection.find({ userId }).sort({ createdAt: -1 }).toArray();
    // Convert _id to string for the frontend
    const formatted = shipments.map(s => ({ ...s, id: s._id.toString() }));
    return NextResponse.json({ shipments: formatted });
  } catch (error) {
    console.error("GET Shipments Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const userId = getUserId(req);

  try {
    const body = await req.json();
    const { origin, destination, cargoType, vehicleType, route } = body;

    const shipmentId = `SR-${Math.floor(1000 + Math.random() * 9000)}`;
    const collection = await getShipmentsCollection();

    const newShipment = {
      shipmentId,
      userId,
      origin,
      destination,
      cargoType,
      vehicleType,
      status: "pending",
      riskScore: route.riskScore,
      riskLevel: route.riskLevel,
      distanceKm: route.distanceKm,
      durationHours: route.durationHours,
      weatherScore: route.riskBreakdown?.weather || 1,
      routeName: route.name,
      routeGeometry: route.routeGeometry,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await collection.insertOne(newShipment);
    return NextResponse.json({ 
      shipment: { ...newShipment, id: result.insertedId.toString() } 
    }, { status: 201 });

  } catch (error) {
    console.error("POST Shipment Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
