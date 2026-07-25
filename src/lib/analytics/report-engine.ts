import { getDb } from "@/lib/mongodb";
import { createAuditEvent } from "@/lib/audit";
import { KPIEngine } from "./kpi-engine";
import type { DateRange } from "./analytics-utils";

export type ReportType = "shipment" | "fleet" | "driver" | "risk" | "incident" | "operational" | "executive";

export interface ReportGenerationRequest {
  companyId: string;
  userId: string;
  type: ReportType;
  filters: {
    dateRange?: DateRange;
    query?: Record<string, unknown>;
    [key: string]: unknown;
  };
  format: "csv" | "excel" | "pdf";
}

export class ReportEngine {
  /**
   * Orchestrates the generation of report data and logs the audit event.
   */
  static async generateReportData(req: ReportGenerationRequest) {
    const startTime = Date.now();
    const db = await getDb();
    
    let reportData: any = {};

    switch (req.type) {
      case "executive":
        reportData = await KPIEngine.getAllKPIs(req.companyId, req.filters.dateRange);
        break;
      case "shipment":
        // For standard reports, we fetch the actual list of matching records up to a limit
        const limit = 10000; // Cap to prevent massive memory usage
        reportData = await db.collection("shipments")
          .find({ companyId: req.companyId, ...req.filters.query })
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray();
        break;
      // Other types would follow a similar pattern
      default:
        // Fallback or generic aggregation
        reportData = await KPIEngine.getAllKPIs(req.companyId, req.filters.dateRange);
    }

    const generationTime = Date.now() - startTime;
    const reportId = `rpt-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const reportRecord = {
      reportId,
      companyId: req.companyId,
      userId: req.userId,
      reportType: req.type,
      filters: req.filters,
      format: req.format,
      generationTime,
      createdAt: new Date().toISOString()
    };

    // Store report metadata
    await db.collection("analytics_reports").insertOne(reportRecord);

    // Audit the action
    await createAuditEvent({
      db,
      companyId: req.companyId,
      performedBy: req.userId,
      eventType: "report_generated",
      details: {
        reportId,
        type: req.type,
        format: req.format,
        generationTimeMs: generationTime
      }
    });

    return {
      metadata: reportRecord,
      data: reportData
    };
  }
}
