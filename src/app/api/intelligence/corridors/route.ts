import { NextResponse } from "next/server";
import { requireCompany } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { CorridorStatistic } from "@/lib/types";

// Deterministic mockup for corridor statistics
const MOCK_CORRIDORS: CorridorStatistic[] = [
  {
    corridorId: "corr-1",
    origin: "Chennai",
    destination: "Bengaluru",
    averageDelay: 45,
    riskHistory: [30, 35, 40, 25, 20, 50, 45],
    weatherTrend: "clear",
    incidentDensity: 20,
    roadQuality: 85,
    averageEtaVariance: 30,
    historicalReliability: 92,
    currentOperationalStatus: "optimal",
    confidence: 95,
  },
  {
    corridorId: "corr-2",
    origin: "Mumbai",
    destination: "Pune",
    averageDelay: 120,
    riskHistory: [80, 75, 85, 90, 60, 50, 45],
    weatherTrend: "rainy",
    incidentDensity: 80,
    roadQuality: 70,
    averageEtaVariance: 90,
    historicalReliability: 60,
    currentOperationalStatus: "disrupted",
    confidence: 88,
  },
  {
    corridorId: "corr-3",
    origin: "Hyderabad",
    destination: "Vijayawada",
    averageDelay: 20,
    riskHistory: [10, 15, 20, 10, 5, 10, 15],
    weatherTrend: "clear",
    incidentDensity: 5,
    roadQuality: 95,
    averageEtaVariance: 10,
    historicalReliability: 98,
    currentOperationalStatus: "optimal",
    confidence: 99,
  }
];

export async function GET(req: Request) {
  try {
    const { company } = await requireCompany(req as any);
    const companyId = company.companyId;
    
    // In a full implementation, these would be calculated by aggregating shipment_timelines and route_predictions
    // For this demonstration we use a mix of deterministic static mock and any existing DB records.
    const db = await getDb();
    const dbCorridors = await db.collection("corridor_statistics")
      .find({ $or: [{ companyId: null }, { companyId: { $exists: false } }, { companyId }] })
      .toArray();

    const mapped = dbCorridors.map(doc => {
      const { _id, ...rest } = doc;
      return rest as unknown as CorridorStatistic;
    });

    const corridors = [...MOCK_CORRIDORS, ...mapped];

    // Remove duplicates by ID
    const uniqueCorridors = Array.from(new Map(corridors.map(c => [c.corridorId, c])).values());

    return NextResponse.json({ corridors: uniqueCorridors });
  } catch (err: any) {
    if (err.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[GET /api/intelligence/corridors]", err);
    return NextResponse.json({ error: "Failed to fetch corridors" }, { status: 500 });
  }
}
