import { NextRequest, NextResponse } from "next/server";
import { getDb, withTransaction } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";
import { createAuditEvent } from "@/lib/audit";
import { addTimelineEvent } from "@/lib/timeline-service";
import { utcNow } from "@/lib/time";
import { ShipmentExecution, TimelineEventType } from "@/lib/types";
import { emitToCompany } from "@/lib/socket-server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireApprovedCompany(req);
    const { id: shipmentId } = await params;

    if (!shipmentId) {
      return NextResponse.json({ error: "Missing shipment ID" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, notes, podSignatureSvg, podPhotoUrl } = body; // action: accept, decline, start, pause, resume, complete, cancel

    if (!["accept", "decline", "start", "pause", "resume", "complete", "cancel"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const db = await getDb();

    // Check if shipment exists and is assigned.
    // NOTE: shipments collection uses field "id" (not "shipmentId") as the primary lookup key.
    const shipment = await db.collection("shipments").findOne({
      id: shipmentId,
      companyId: auth.company.companyId,
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    if (!shipment.assignedDriverId || !shipment.assignedVehicleId) {
      return NextResponse.json(
        { error: "Shipment must be assigned to a driver and vehicle first" },
        { status: 400 }
      );
    }

    const execution = await db.collection("shipment_executions").findOne({
      shipmentId,
      companyId: auth.company.companyId,
    });

    const now = utcNow();

    // ── accept ──────────────────────────────────────────────────────────────
    if (action === "accept") {
      if (!execution) {
        // Create pending execution — single-collection insert is inherently atomic.
        const checkpoints = (
          shipment.route?.stops as
            | Array<{ address?: string; location?: { lat?: number; lng?: number } }>
            | undefined
        )
          ?.map((stop, index) => ({
            id: `chk-${index}`,
            name: stop.address ?? `Stop ${index + 1}`,
            latitude: stop.location?.lat ?? 0,
            longitude: stop.location?.lng ?? 0,
            status: "pending" as const,
          })) ?? [];

        await db.collection("shipment_executions").insertOne({
          shipmentId,
          companyId: auth.company.companyId,
          driverId: shipment.assignedDriverId,
          vehicleId: shipment.assignedVehicleId,
          plannedRoute: shipment.route,
          currentRoute: shipment.route,
          routeVersion: 1,
          driverAccepted: true,
          tripStartTime: null,
          historicalLocations: [],
          lastUpdated: now,
          completedCheckpoints: 0,
          remainingCheckpoints: checkpoints.length,
          checkpoints,
          travelledDistance: 0,
          averageSpeed: 0,
          maximumSpeed: 0,
          idleDuration: 0,
          drivingDuration: 0,
          fuelEstimate: 0,
          status: "pending",
        });
      } else {
        await db.collection("shipment_executions").updateOne(
          { shipmentId, companyId: auth.company.companyId },
          { $set: { driverAccepted: true, lastUpdated: now } }
        );
      }
    }

    // ── decline ─────────────────────────────────────────────────────────────
    // Wraps all four collections atomically so a partial failure cannot leave
    // the driver/vehicle locked to a ghost shipment.
    else if (action === "decline") {
      await withTransaction(async (txDb, session) => {
        const opts = session ? { session } : {};

        if (execution) {
          await txDb.collection("shipment_executions").updateOne(
            { shipmentId, companyId: auth.company.companyId },
            { $set: { status: "cancelled", lastUpdated: now } },
            opts
          );
        }

        await txDb.collection("shipments").updateOne(
          { id: shipmentId, companyId: auth.company.companyId },
          { $set: { status: "pending", assignedDriverId: null, assignedVehicleId: null } },
          opts
        );

        // Reset driver so they are immediately available for dispatch.
        await txDb.collection("drivers").updateOne(
          { driverId: shipment.assignedDriverId, companyId: auth.company.companyId },
          { $set: { operationalStatus: "Available", assignedVehicleId: null, updatedAt: now } },
          opts
        );

        // Reset vehicle so it is immediately available for dispatch.
        await txDb.collection("vehicles").updateOne(
          { vehicleId: shipment.assignedVehicleId, companyId: auth.company.companyId },
          {
            $set: {
              operationalStatus: "Available",
              status: "available",
              currentDriverId: null,
              updatedAt: now,
            },
          },
          opts
        );
      });
    }

    // ── start ────────────────────────────────────────────────────────────────
    else if (action === "start") {
      if (execution && execution.status !== "pending") {
        return NextResponse.json({ error: "Execution already started" }, { status: 400 });
      }

      if (!execution) {
        // Build checkpoints from route if available.
        const checkpoints = (
          shipment.route?.stops as
            | Array<{ address?: string; location?: { lat?: number; lng?: number } }>
            | undefined
        )
          ?.map((stop, index) => ({
            id: `chk-${index}`,
            name: stop.address ?? `Stop ${index + 1}`,
            latitude: stop.location?.lat ?? 0,
            longitude: stop.location?.lng ?? 0,
            status: "pending" as const,
          })) ?? [];

        const newExecution = {
          shipmentId,
          companyId: auth.company.companyId,
          driverId: shipment.assignedDriverId,
          vehicleId: shipment.assignedVehicleId,
          plannedRoute: shipment.route,
          currentRoute: shipment.route,
          routeVersion: 1,
          tripStartTime: now,
          historicalLocations: [],
          lastUpdated: now,
          completedCheckpoints: 0,
          remainingCheckpoints: checkpoints.length,
          checkpoints,
          travelledDistance: 0,
          averageSpeed: 0,
          maximumSpeed: 0,
          idleDuration: 0,
          drivingDuration: 0,
          fuelEstimate: 0,
          status: "driving",
        };

        // Wrap all writes in a transaction to prevent partial state on failure.
        await withTransaction(async (txDb, session) => {
          const opts = session ? { session } : {};
          await txDb.collection("shipment_executions").insertOne(newExecution, opts);
          await txDb.collection("shipments").updateOne(
            { id: shipmentId, companyId: auth.company.companyId },
            { $set: { status: "active" } },
            opts
          );
          await txDb.collection("drivers").updateOne(
            { driverId: shipment.assignedDriverId, companyId: auth.company.companyId },
            { $set: { operationalStatus: "Driving", updatedAt: now } },
            opts
          );
          await txDb.collection("vehicles").updateOne(
            { vehicleId: shipment.assignedVehicleId, companyId: auth.company.companyId },
            { $set: { operationalStatus: "In Transit", updatedAt: now } },
            opts
          );
        });
      } else {
        await withTransaction(async (txDb, session) => {
          const opts = session ? { session } : {};
          await txDb.collection("shipment_executions").updateOne(
            { shipmentId, companyId: auth.company.companyId },
            { $set: { status: "driving", tripStartTime: now, lastUpdated: now } },
            opts
          );
          await txDb.collection("shipments").updateOne(
            { id: shipmentId, companyId: auth.company.companyId },
            { $set: { status: "active" } },
            opts
          );
          await txDb.collection("drivers").updateOne(
            { driverId: shipment.assignedDriverId, companyId: auth.company.companyId },
            { $set: { operationalStatus: "Driving", updatedAt: now } },
            opts
          );
          await txDb.collection("vehicles").updateOne(
            { vehicleId: shipment.assignedVehicleId, companyId: auth.company.companyId },
            { $set: { operationalStatus: "In Transit", updatedAt: now } },
            opts
          );
        });
      }

      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Trip Started",
        notes || "Trip execution has started",
        "system",
        100
      );

      await createAuditEvent({
        db,
        companyId: auth.company.companyId,
        eventType: "trip_started",
        performedBy: auth.userId,
        details: {
          shipmentId,
          driverId: shipment.assignedDriverId,
          vehicleId: shipment.assignedVehicleId,
        },
      });

      return NextResponse.json({ success: true, status: "driving" });
    }

    // For all remaining actions the execution document must already exist.
    if (!execution) {
      return NextResponse.json(
        { error: "Execution document not found. Start the trip first." },
        { status: 400 }
      );
    }

    // ── pause ────────────────────────────────────────────────────────────────
    // Atomically updates execution and driver so they cannot diverge on failure.
    if (action === "pause") {
      if (execution.status !== "driving") {
        return NextResponse.json({ error: "Can only pause a driving trip" }, { status: 400 });
      }

      await withTransaction(async (txDb, session) => {
        const opts = session ? { session } : {};
        await txDb.collection("shipment_executions").updateOne(
          { shipmentId, companyId: auth.company.companyId },
          { $set: { status: "paused", lastUpdated: now } },
          opts
        );
        await txDb.collection("drivers").updateOne(
          { driverId: shipment.assignedDriverId, companyId: auth.company.companyId },
          { $set: { operationalStatus: "Paused", updatedAt: now } },
          opts
        );
      });

      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Trip Paused",
        notes || "Trip execution has been paused",
        "system",
        100
      );

      await createAuditEvent({
        db,
        companyId: auth.company.companyId,
        eventType: "trip_paused",
        performedBy: auth.userId,
        details: { shipmentId, driverId: shipment.assignedDriverId },
      });

      return NextResponse.json({ success: true, status: "paused" });
    }

    // ── resume ───────────────────────────────────────────────────────────────
    // Atomically updates execution and driver so they cannot diverge on failure.
    if (action === "resume") {
      if (execution.status !== "paused") {
        return NextResponse.json({ error: "Can only resume a paused trip" }, { status: 400 });
      }

      await withTransaction(async (txDb, session) => {
        const opts = session ? { session } : {};
        await txDb.collection("shipment_executions").updateOne(
          { shipmentId, companyId: auth.company.companyId },
          { $set: { status: "driving", lastUpdated: now } },
          opts
        );
        await txDb.collection("drivers").updateOne(
          { driverId: shipment.assignedDriverId, companyId: auth.company.companyId },
          { $set: { operationalStatus: "Driving", updatedAt: now } },
          opts
        );
      });

      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Trip Resumed",
        notes || "Trip execution has been resumed",
        "system",
        100
      );

      await createAuditEvent({
        db,
        companyId: auth.company.companyId,
        eventType: "trip_resumed",
        performedBy: auth.userId,
        details: { shipmentId, driverId: shipment.assignedDriverId },
      });

      return NextResponse.json({ success: true, status: "driving" });
    }

    // ── complete ─────────────────────────────────────────────────────────────
    if (action === "complete") {
      if (execution.status === "completed" || execution.status === "cancelled") {
        return NextResponse.json(
          { error: "Trip is already completed or cancelled" },
          { status: 400 }
        );
      }

      if (!podSignatureSvg) {
        return NextResponse.json(
          { error: "Proof of Delivery signature is required to complete a shipment" },
          { status: 400 }
        );
      }

      // Wrap all terminal-state writes in a transaction to prevent partial completion.
      await withTransaction(async (txDb, session) => {
        const opts = session ? { session } : {};
        await txDb.collection("shipment_executions").updateOne(
          { shipmentId, companyId: auth.company.companyId },
          {
            $set: {
              status: "completed",
              tripEndTime: now,
              lastUpdated: now,
              podSignatureSvg,
              ...(podPhotoUrl ? { podPhotoUrl } : {}),
            },
          },
          opts
        );
        await txDb.collection("shipments").updateOne(
          { id: shipmentId, companyId: auth.company.companyId },
          { $set: { status: "completed", updatedAt: now } },
          opts
        );
        await txDb.collection("drivers").updateOne(
          { driverId: shipment.assignedDriverId, companyId: auth.company.companyId },
          {
            $set: {
              operationalStatus: "Available",
              status: "active",
              assignedVehicleId: null,
              updatedAt: now,
            },
          },
          opts
        );
        await txDb.collection("vehicles").updateOne(
          { vehicleId: shipment.assignedVehicleId, companyId: auth.company.companyId },
          {
            $set: {
              operationalStatus: "Available",
              status: "available",
              currentDriverId: null,
              updatedAt: now,
            },
          },
          opts
        );
      });

      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Shipment Completed",
        notes || "Trip execution has been completed successfully",
        "system",
        100
      );

      await createAuditEvent({
        db,
        companyId: auth.company.companyId,
        eventType: "shipment_completed",
        performedBy: auth.userId,
        details: { shipmentId },
      });

      // The drivers change stream handles driver availability reactivity;
      // manual emit is retained until the drivers change stream is fully deployed.
      emitToCompany(auth.company.companyId, "driver:availability", {
        driverId: shipment.assignedDriverId,
        operationalStatus: "Available",
      });

      return NextResponse.json({ success: true, status: "completed" });
    }

    // ── cancel ───────────────────────────────────────────────────────────────
    if (action === "cancel") {
      if (execution.status === "completed" || execution.status === "cancelled") {
        return NextResponse.json(
          { error: "Trip is already completed or cancelled" },
          { status: 400 }
        );
      }

      // Wrap all terminal-state writes in a transaction to prevent partial cancellation.
      await withTransaction(async (txDb, session) => {
        const opts = session ? { session } : {};
        await txDb.collection("shipment_executions").updateOne(
          { shipmentId, companyId: auth.company.companyId },
          { $set: { status: "cancelled", tripEndTime: now, lastUpdated: now } },
          opts
        );
        await txDb.collection("shipments").updateOne(
          { id: shipmentId, companyId: auth.company.companyId },
          { $set: { status: "cancelled", updatedAt: now } },
          opts
        );
        await txDb.collection("drivers").updateOne(
          { driverId: shipment.assignedDriverId, companyId: auth.company.companyId },
          {
            $set: {
              operationalStatus: "Available",
              status: "active",
              assignedVehicleId: null,
              updatedAt: now,
            },
          },
          opts
        );
        await txDb.collection("vehicles").updateOne(
          { vehicleId: shipment.assignedVehicleId, companyId: auth.company.companyId },
          {
            $set: {
              operationalStatus: "Available",
              status: "available",
              currentDriverId: null,
              updatedAt: now,
            },
          },
          opts
        );
      });

      await addTimelineEvent(
        shipmentId,
        auth.company.companyId,
        "Shipment Cancelled",
        notes || "Trip execution has been cancelled",
        "system",
        100
      );

      await createAuditEvent({
        db,
        companyId: auth.company.companyId,
        eventType: "trip_cancelled",
        performedBy: auth.userId,
        details: { shipmentId, reason: notes },
      });

      // Manual emit retained until the drivers change stream is fully deployed.
      emitToCompany(auth.company.companyId, "driver:availability", {
        driverId: shipment.assignedDriverId,
        operationalStatus: "Available",
      });

      return NextResponse.json({ success: true, status: "cancelled" });
    }

    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  } catch (err) {
    return handleAuthError(err);
  }
}
