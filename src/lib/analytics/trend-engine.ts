import { getDb } from "@/lib/mongodb";
import { DateRangePreset, buildDateFilter } from "./analytics-utils";

export class TrendEngine {
  /**
   * Generates a time-series trend for a specific metric by aggregating data from the source collection.
   */
  static async getTrendData(
    companyId: string, 
    metric: "shipment_volume" | "incidents" | "risk_score" | "predictions",
    dateRange?: { start?: string, end?: string, preset?: DateRangePreset },
    granularity: "daily" | "weekly" | "monthly" = "daily"
  ) {
    const db = await getDb();
    
    // Map granularities to MongoDB date formats
    const formatMap = {
      daily: "%Y-%m-%d",
      weekly: "%Y-%U",
      monthly: "%Y-%m"
    };

    const dateFormat = formatMap[granularity];
    const matchStage: Record<string, unknown> = { companyId };
    const dateFilter = buildDateFilter(dateRange);

    let collectionName = "";
    let dateField = "createdAt";
    let aggregation: any = { count: { $sum: 1 } };

    // Configure query based on metric
    switch (metric) {
      case "shipment_volume":
        collectionName = "shipments";
        if (dateFilter) matchStage.createdAt = dateFilter;
        break;
      case "incidents":
        collectionName = "incidents";
        dateField = "startTime";
        if (dateFilter) matchStage.startTime = dateFilter;
        break;
      case "risk_score":
        collectionName = "risk_calculations";
        aggregation = { avgScore: { $avg: "$riskFactors.overall" }, count: { $sum: 1 } };
        if (dateFilter) matchStage.createdAt = dateFilter;
        break;
      case "predictions":
        collectionName = "route_predictions";
        aggregation = { avgConfidence: { $avg: "$confidenceScore" }, count: { $sum: 1 } };
        if (dateFilter) matchStage.createdAt = dateFilter;
        break;
      default:
        throw new Error(`Unsupported metric: ${metric}`);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: { $toDate: `$${dateField}` } } },
          ...aggregation
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await db.collection(collectionName).aggregate(pipeline).toArray();

    return results.map(r => ({
      date: r._id,
      value: r.count,
      avgScore: r.avgScore,
      avgConfidence: r.avgConfidence
    }));
  }
}
