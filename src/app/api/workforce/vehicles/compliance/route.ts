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

    let expiredCount = 0;
    let expiringSoonCount = 0;

    const complianceIssues = vehicles.map(v => {
      const issues = [];
      const { insuranceExpiry, permitExpiry, pucExpiry, fitnessExpiry } = v;

      if (fitnessExpiry) {
        const diff = new Date(fitnessExpiry).getTime() - now.getTime();
        if (diff < 0) {
          issues.push({ type: "fitness", label: "Fitness Certificate", status: "expired", expiryDate: fitnessExpiry });
          expiredCount++;
        } else if (diff < THIRTY_DAYS_MS) {
          issues.push({ type: "fitness", label: "Fitness Certificate", status: "expiring_soon", expiryDate: fitnessExpiry });
          expiringSoonCount++;
        }
      }

      if (insuranceExpiry) {
        const diff = new Date(insuranceExpiry).getTime() - now.getTime();
        if (diff < 0) {
          issues.push({ type: "insurance", label: "Insurance", status: "expired", expiryDate: insuranceExpiry });
          expiredCount++;
        } else if (diff < THIRTY_DAYS_MS) {
          issues.push({ type: "insurance", label: "Insurance", status: "expiring_soon", expiryDate: insuranceExpiry });
          expiringSoonCount++;
        }
      }

      if (permitExpiry) {
        const diff = new Date(permitExpiry).getTime() - now.getTime();
        if (diff < 0) {
          issues.push({ type: "permit", label: "National/State Permit", status: "expired", expiryDate: permitExpiry });
          expiredCount++;
        } else if (diff < THIRTY_DAYS_MS) {
          issues.push({ type: "permit", label: "National/State Permit", status: "expiring_soon", expiryDate: permitExpiry });
          expiringSoonCount++;
        }
      }

      if (pucExpiry) {
        const diff = new Date(pucExpiry).getTime() - now.getTime();
        if (diff < 0) {
          issues.push({ type: "puc", label: "PUC Certificate", status: "expired", expiryDate: pucExpiry });
          expiredCount++;
        } else if (diff < THIRTY_DAYS_MS) {
          issues.push({ type: "puc", label: "PUC Certificate", status: "expiring_soon", expiryDate: pucExpiry });
          expiringSoonCount++;
        }
      }

      return {
        vehicleId: v.vehicleId || v.id || v._id?.toString(),
        vehicleNumber: v.vehicleNumber || v.registrationNumber,
        vehicleType: v.vehicleType,
        operationalStatus: v.operationalStatus || v.status,
        issues
      };
    }).filter(v => v.issues.length > 0);

    return NextResponse.json({
      complianceIssues,
      summary: {
        totalVehicles: vehicles.length,
        compliantVehicles: vehicles.length - complianceIssues.length,
        nonCompliantVehicles: complianceIssues.length,
        expiredCount,
        expiringSoonCount,
        complianceRate: vehicles.length > 0 ? Math.round(((vehicles.length - complianceIssues.length) / vehicles.length) * 100) : 100
      }
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
