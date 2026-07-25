import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const db = await getDb();

    // Parallel aggregation for performance
    const [
      companiesTotal,
      companiesActive,
      companiesPending,
      usersTotal,
      shipmentsTotal,
      shipmentsActive,
      incidentsOpen
    ] = await Promise.all([
      db.collection("companies").countDocuments(),
      db.collection("companies").countDocuments({ status: "approved" }),
      db.collection("companies").countDocuments({ status: "pending" }),
      db.collection("users").countDocuments(),
      db.collection("shipments").countDocuments(),
      db.collection("shipments").countDocuments({ status: { $in: ["draft", "active", "at-risk"] } }),
      db.collection("incidents").countDocuments({ status: "open" })
    ]);

    // Memory usage (indicative of Node load)
    const memoryUsage = process.memoryUsage();
    const memoryUsedMb = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    return NextResponse.json({
      companies: {
        total: companiesTotal,
        active: companiesActive,
        pending: companiesPending,
      },
      users: {
        total: usersTotal,
      },
      shipments: {
        total: shipmentsTotal,
        active: shipmentsActive,
      },
      incidents: {
        open: incidentsOpen,
      },
      health: {
        status: "healthy",
        uptime: process.uptime(),
        memoryUsedMb,
      }
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
