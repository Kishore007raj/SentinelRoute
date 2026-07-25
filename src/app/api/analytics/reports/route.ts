import { NextRequest, NextResponse } from "next/server";
import { requireCompany, handleAuthError } from "@/lib/auth-helpers";
import { getDb } from "@/lib/mongodb";
import { ReportEngine, ReportGenerationRequest } from "@/lib/analytics/report-engine";

export async function POST(req: NextRequest) {
  try {
    const { company, userId } = await requireCompany(req);
    const body = await req.json();

    const { type, filters = {}, format = "csv" } = body;

    if (!type) {
      return NextResponse.json({ error: "Missing required parameter: type" }, { status: 400 });
    }

    const request: ReportGenerationRequest = {
      companyId: company.companyId,
      userId,
      type,
      filters,
      format
    };

    const report = await ReportEngine.generateReportData(request);

    return NextResponse.json(report);
  } catch (error) {
    return handleAuthError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { company } = await requireCompany(req);
    const db = await getDb();

    // List previously generated reports metadata
    const reports = await db.collection("analytics_reports")
      .find({ companyId: company.companyId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({ reports });
  } catch (error) {
    return handleAuthError(error);
  }
}
