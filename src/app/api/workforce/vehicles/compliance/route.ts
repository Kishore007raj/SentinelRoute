import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const companyId = company.companyId;

    const db = await getDb();
    
    // Find all vehicles for the company
    const vehicles = await db.collection("vehicles").find({ companyId }).toArray();
    
    const now = new Date();
    // Expiry threshold: warn if expiry is within 30 days
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    const complianceIssues = vehicles.map(v => {
      const issues = [];
      const { insuranceExpiry, permitExpiry, pucExpiry } = v;

      if (insuranceExpiry) {
        const diff = new Date(insuranceExpiry).getTime() - now.getTime();
        if (diff < 0) issues.push({ type: "insurance", status: "expired" });
        else if (diff < THIRTY_DAYS_MS) issues.push({ type: "insurance", status: "expiring_soon" });
      }

      if (permitExpiry) {
        const diff = new Date(permitExpiry).getTime() - now.getTime();
        if (diff < 0) issues.push({ type: "permit", status: "expired" });
        else if (diff < THIRTY_DAYS_MS) issues.push({ type: "permit", status: "expiring_soon" });
      }

      if (pucExpiry) {
        const diff = new Date(pucExpiry).getTime() - now.getTime();
        if (diff < 0) issues.push({ type: "puc", status: "expired" });
        else if (diff < THIRTY_DAYS_MS) issues.push({ type: "puc", status: "expiring_soon" });
      }

      return {
        vehicleId: v.id || v._id.toString(),
        registrationNumber: v.registrationNumber,
        issues
      };
    }).filter(v => v.issues.length > 0);

    return NextResponse.json({ complianceIssues });
  } catch (error) {
    return handleAuthError(error);
  }
}
