import { getDb } from "@/lib/mongodb";
import { HealthScore } from "@/lib/intelligence/health-score";
import { DateRange, buildDateFilter } from "./analytics-utils";

export class KPIEngine {
  /**
   * Retrieves high-level shipment KPIs (total, active, completed, delayed, success rate, ETA accuracy).
   */
  static async getShipmentKPIs(companyId: string, dateRange?: DateRange) {
    const db = await getDb();
    const matchStage: Record<string, unknown> = { companyId };

    const dateFilter = buildDateFilter(dateRange);
    if (dateFilter) {
      matchStage.createdAt = dateFilter;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          // ShipmentStatus in types.ts: "draft"|"active"|"at-risk"|"completed"|"cancelled"
          completed: {
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          },
          active: {
            $sum: { $cond: [{ $in: ["$status", ["active", "at-risk", "draft"]] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] }
          },
          atRisk: {
            $sum: { $cond: [{ $eq: ["$status", "at-risk"] }, 1, 0] }
          },
          // Delayed = deadline exceeded and not yet completed/cancelled
          delayed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$status", ["active", "at-risk"]] },
                    { $gt: ["$deadline", ""] },
                    { $lt: ["$deadline", new Date().toISOString()] }
                  ]
                },
                1, 0
              ]
            }
          }
        }
      }
    ];

    const results = await db.collection("shipments").aggregate(pipeline).toArray();
    const data = results[0] || { total: 0, completed: 0, active: 0, cancelled: 0, atRisk: 0, delayed: 0 };

    // successRate = completed / (completed + cancelled) to exclude in-progress from denominator
    const resolved = data.completed + data.cancelled;
    const successRate = resolved > 0 ? ((data.completed / resolved) * 100).toFixed(1) : "0.0";
    // deliveryPerformance = completed shipments delivered without being at-risk
    const onTimeCompleted = data.completed - (data.delayed ?? 0);
    const deliveryPerformance = data.completed > 0
      ? Math.max(0, Math.round((onTimeCompleted / data.completed) * 100))
      : 0;

    return {
      total: data.total,
      active: data.active,
      completed: data.completed,
      cancelled: data.cancelled,
      atRisk: data.atRisk,
      delayed: data.delayed ?? 0,
      successRate: parseFloat(successRate),
      deliveryPerformance
    };
  }

  /**
   * Retrieves high-level fleet KPIs (total, available, assigned, maintenance).
   */
  static async getFleetKPIs(companyId: string) {
    const db = await getDb();
    const pipeline = [
      { $match: { companyId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ["$status", "available"] }, 1, 0] } },
          assigned: { $sum: { $cond: [{ $eq: ["$status", "assigned"] }, 1, 0] } },
          maintenance: { $sum: { $cond: [{ $eq: ["$status", "maintenance"] }, 1, 0] } }
        }
      }
    ];

    const results = await db.collection("vehicles").aggregate(pipeline).toArray();
    const data = results[0] || { total: 0, available: 0, assigned: 0, maintenance: 0 };

    const availabilityRate = data.total > 0 ? ((data.available / data.total) * 100).toFixed(1) : "0.0";
    const utilizationRate = data.total > 0 ? ((data.assigned / data.total) * 100).toFixed(1) : "0.0";

    return {
      total: data.total,
      available: data.available,
      assigned: data.assigned,
      maintenance: data.maintenance,
      availabilityRate: parseFloat(availabilityRate),
      utilizationRate: parseFloat(utilizationRate)
    };
  }

  /**
   * Retrieves driver KPIs (total, available, assigned).
   */
  static async getDriverKPIs(companyId: string) {
    const db = await getDb();
    // Driver.status = "active" | "inactive" | "suspended"
    // Driver.operationalStatus = "Available" | "Assigned" | "Driving" | "Paused" | "Offline" | "Completed"
    const pipeline = [
      { $match: { companyId } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          // Active (not suspended/inactive) drivers
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          // Operationally assigned/driving/paused
          assigned: {
            $sum: {
              $cond: [
                { $in: ["$operationalStatus", ["Assigned", "Driving", "Paused"]] },
                1, 0
              ]
            }
          },
          // Available for dispatch
          available: {
            $sum: {
              $cond: [
                { $eq: ["$operationalStatus", "Available"] },
                1, 0
              ]
            }
          },
          offDuty: {
            $sum: {
              $cond: [
                { $in: ["$operationalStatus", ["Offline", "Completed"]] },
                1, 0
              ]
            }
          },
          suspended: { $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] } }
        }
      }
    ];

    const results = await db.collection("drivers").aggregate(pipeline).toArray();
    const data = results[0] || { total: 0, active: 0, available: 0, assigned: 0, offDuty: 0, suspended: 0 };

    // Utilization = operationally assigned/driving/paused out of all active drivers
    const utilizationRate = data.active > 0
      ? ((data.assigned / data.active) * 100).toFixed(1)
      : "0.0";

    return {
      total: data.total,
      active: data.active,
      available: data.available,
      assigned: data.assigned,
      offDuty: data.offDuty,
      suspended: data.suspended,
      utilizationRate: parseFloat(utilizationRate)
    };
  }

  /**
   * Retrieves incident KPIs.
   */
  static async getIncidentKPIs(companyId: string, dateRange?: DateRange) {
    const db = await getDb();
    const matchStage: Record<string, unknown> = { companyId };

    const dateFilter = buildDateFilter(dateRange);
    if (dateFilter) {
      matchStage.startTime = dateFilter;
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          critical: { $sum: { $cond: [{ $eq: ["$severity", "critical"] }, 1, 0] } },
          high: { $sum: { $cond: [{ $eq: ["$severity", "high"] }, 1, 0] } },
          medium: { $sum: { $cond: [{ $eq: ["$severity", "medium"] }, 1, 0] } },
          low: { $sum: { $cond: [{ $eq: ["$severity", "low"] }, 1, 0] } }
        }
      }
    ];

    const results = await db.collection("incidents").aggregate(pipeline).toArray();
    const data = results[0] || { total: 0, critical: 0, high: 0, medium: 0, low: 0 };

    return data;
  }

  /**
   * Combines all executive KPIs.
   */
  static async getAllKPIs(companyId: string, dateRange?: DateRange) {
    const [
      shipments,
      fleet,
      drivers,
      incidents,
      health
    ] = await Promise.all([
      this.getShipmentKPIs(companyId, dateRange),
      this.getFleetKPIs(companyId), // Fleet is typically current state
      this.getDriverKPIs(companyId), // Drivers is typically current state
      this.getIncidentKPIs(companyId, dateRange),
      HealthScore.calculateForCompany(companyId)
    ]);

    return {
      shipments,
      fleet,
      drivers,
      incidents,
      healthScore: health.score
    };
  }
}
