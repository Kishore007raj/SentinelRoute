/**
 * check-assignment-duplicates.ts
 *
 * Pre-deployment migration validation script.
 *
 * PURPOSE
 * -------
 * The production hardening remediation adds two unique partial indexes to the
 * `shipments` collection:
 *
 *   - shipments_driver_active_unique  { companyId, assignedDriverId }
 *   - shipments_vehicle_active_unique { companyId, assignedVehicleId }
 *
 * Both indexes use a partialFilterExpression that covers only documents whose
 * status is one of: draft | pending | assigned | active | at-risk.
 *
 * MongoDB will refuse to build a unique index if existing data contains
 * violations. This script detects any such violations BEFORE the deployment so
 * they can be resolved manually without a failed index build blocking startup.
 *
 * USAGE
 * -----
 *   npx tsx scripts/check-assignment-duplicates.ts
 *
 * Set MONGODB_URI in your environment (or .env.local) before running.
 *
 * EXIT CODES
 * ----------
 *   0 — no violations found, safe to deploy
 *   1 — violations found; resolve them before deploying
 */

import { config } from "dotenv";
import { resolve } from "path";
import { MongoClient } from "mongodb";

// Load .env.local from the project root (same directory as package.json).
// tsx runs from the sentinelroute-app directory, so resolve relative to cwd.
config({ path: resolve(process.cwd(), ".env.local") });

const ACTIVE_STATUSES = ["draft", "pending", "assigned", "active", "at-risk"] as const;

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("[check-assignment-duplicates] ERROR: MONGODB_URI is not set.");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("sentinelroute");
  const col = db.collection("shipments");

  console.log("[check-assignment-duplicates] Checking for duplicate driver assignments...");

  const driverDuplicates = await col
    .aggregate([
      {
        $match: {
          assignedDriverId: { $exists: true, $ne: null, $type: "string" },
          status: { $in: [...ACTIVE_STATUSES] },
        },
      },
      {
        $group: {
          _id: { companyId: "$companyId", assignedDriverId: "$assignedDriverId" },
          count: { $sum: 1 },
          shipmentIds: { $push: "$id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  console.log("[check-assignment-duplicates] Checking for duplicate vehicle assignments...");

  const vehicleDuplicates = await col
    .aggregate([
      {
        $match: {
          assignedVehicleId: { $exists: true, $ne: null, $type: "string" },
          status: { $in: [...ACTIVE_STATUSES] },
        },
      },
      {
        $group: {
          _id: { companyId: "$companyId", assignedVehicleId: "$assignedVehicleId" },
          count: { $sum: 1 },
          shipmentIds: { $push: "$id" },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  await client.close();

  let hasViolations = false;

  if (driverDuplicates.length > 0) {
    hasViolations = true;
    console.error(
      `\n[check-assignment-duplicates] VIOLATION: ${driverDuplicates.length} driver(s) are assigned to multiple active shipments:`
    );
    for (const row of driverDuplicates) {
      console.error(
        `  companyId=${row._id.companyId}  driverId=${row._id.assignedDriverId}  shipments=[${row.shipmentIds.join(", ")}]`
      );
    }
    console.error(
      "\nTo fix: set assignedDriverId=null on all but one of the listed shipments, or move duplicates to status=completed/cancelled."
    );
  }

  if (vehicleDuplicates.length > 0) {
    hasViolations = true;
    console.error(
      `\n[check-assignment-duplicates] VIOLATION: ${vehicleDuplicates.length} vehicle(s) are assigned to multiple active shipments:`
    );
    for (const row of vehicleDuplicates) {
      console.error(
        `  companyId=${row._id.companyId}  vehicleId=${row._id.assignedVehicleId}  shipments=[${row.shipmentIds.join(", ")}]`
      );
    }
    console.error(
      "\nTo fix: set assignedVehicleId=null on all but one of the listed shipments, or move duplicates to status=completed/cancelled."
    );
  }

  if (!hasViolations) {
    console.log(
      "\n[check-assignment-duplicates] OK — no duplicate assignments found. Safe to deploy."
    );
    process.exit(0);
  } else {
    console.error(
      "\n[check-assignment-duplicates] FAIL — resolve the violations above before deploying."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[check-assignment-duplicates] Unexpected error:", err);
  process.exit(1);
});
