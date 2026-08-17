/**
 * POST /api/analytics/reports  — generate a report and return its data
 * GET  /api/analytics/reports  — list previously generated report metadata
 *
 * Both require ANALYTICS_READ_ROLES.
 * companyId is always resolved from auth — never from the request body.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAccess, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { ReportEngine, type ReportGenerationRequest } from "@/lib/analytics/report-engine";
import { apiLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";
import { logger } from "@/lib/logger";

const VALID_REPORT_TYPES = ["executive", "shipment", "fleet", "driver", "risk", "incident", "operational"] as const;
type ReportType = typeof VALID_REPORT_TYPES[number];

const VALID_FORMATS = ["csv", "excel", "pdf"] as const;
type ExportFormat = typeof VALID_FORMATS[number];

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = apiLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    const { userId, companyId } = await requireAnalyticsAccess(req);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return ApiErrors.badRequest("Invalid JSON body");
    }

    const { type, filters = {}, format = "csv" } = body as {
      type: unknown;
      filters?: Record<string, unknown>;
      format?: unknown;
    };

    if (!type || !VALID_REPORT_TYPES.includes(type as ReportType)) {
      return ApiErrors.badRequest(
        `Missing or invalid report type. Must be one of: ${VALID_REPORT_TYPES.join(", ")}`,
        "INVALID_REPORT_TYPE",
        "type"
      );
    }

    if (!VALID_FORMATS.includes(format as ExportFormat)) {
      return ApiErrors.badRequest(
        `Invalid format. Must be one of: ${VALID_FORMATS.join(", ")}`,
        "INVALID_FORMAT",
        "format"
      );
    }

    const request: ReportGenerationRequest = {
      // companyId from auth — never from body
      companyId,
      userId,
      type:    type as ReportType,
      filters: filters as ReportGenerationRequest["filters"],
      format:  format as ExportFormat,
    };

    const report = await ReportEngine.generateReportData(request);
    return NextResponse.json(report, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return handleAuthError(error);
    logger.error("analytics.reports.POST.unhandled", {}, error);
    return ApiErrors.internal(error, "analytics.reports.POST");
  }
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = apiLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    const { companyId } = await requireAnalyticsAccess(req);
    const db = await getDb();

    const reports = await db.collection("analytics_reports")
      .find({ companyId })
      .sort({ createdAt: -1 })
      .limit(50)
      .project({ _id: 0 })
      .toArray();

    return NextResponse.json({ reports });
  } catch (error) {
    return handleAuthError(error);
  }
}
