import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin(req);
    const db = await getDb();

    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const skip  = (page - 1) * limit;
    const companyIdFilter = searchParams.get("companyId");
    const eventTypeFilter = searchParams.get("eventType");

    const query: Record<string, unknown> = {};
    if (companyIdFilter) query.companyId = companyIdFilter;
    if (eventTypeFilter) query.eventType = eventTypeFilter;

    const [logs, total] = await Promise.all([
      db.collection("audit_logs")
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection("audit_logs").countDocuments(query),
    ]);

    const companyIds = [...new Set(logs.map(log => log.companyId).filter(Boolean))];
    const companies = await db.collection("companies")
      .find({ companyId: { $in: companyIds } })
      .project({ companyId: 1, companyName: 1 })
      .toArray();

    const companyMap = new Map(companies.map(c => [c.companyId as string, c.companyName as string]));

    const enhancedLogs = logs.map(({ _id: _omit, ...cleanLog }) => ({
      ...cleanLog,
      tenantName: companyMap.get(cleanLog.companyId as string)
        ?? (cleanLog.companyId ? "Unknown Tenant" : "System Platform"),
    }));

    return NextResponse.json({
      logs: enhancedLogs,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
