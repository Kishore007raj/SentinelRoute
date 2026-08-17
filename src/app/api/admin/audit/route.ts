/**
 * GET /api/admin/audit
 *
 * Platform-level aggregated audit center.
 * Reads from company_audits (the canonical collection used by createAuditEvent).
 * Requires super_admin role.
 *
 * Query params:
 *   page         – page number (default 1)
 *   limit        – page size (default 50, max 100)
 *   companyId    – filter to one tenant
 *   eventType    – exact event type filter
 *   search       – full-text search across description and actorId
 *   start        – ISO date lower bound on timestamp
 *   end          – ISO date upper bound on timestamp
 */
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";
import { adminLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = adminLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    await requireSuperAdmin(req);
    const db = await getDb();

    const { searchParams } = new URL(req.url);
    const page    = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
    const limit   = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
    const skip    = (page - 1) * limit;

    const companyIdFilter = searchParams.get("companyId");
    const eventTypeFilter = searchParams.get("eventType");
    const search          = searchParams.get("search");
    const start           = searchParams.get("start");
    const end             = searchParams.get("end");

    const query: Record<string, unknown> = {};

    if (companyIdFilter) {
      query.companyId = companyIdFilter;
    }
    if (eventTypeFilter) {
      query.eventType = eventTypeFilter;
    }
    // Server-side timestamp range filter
    if (start || end) {
      const ts: Record<string, string> = {};
      if (start) ts["$gte"] = start;
      if (end)   ts["$lte"] = end;
      query.timestamp = ts;
    }
    // Server-side search on description and actorId
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { description: { $regex: escaped, $options: "i" } },
        { actorId:     { $regex: escaped, $options: "i" } },
        { performedBy: { $regex: escaped, $options: "i" } },
        { eventType:   { $regex: escaped, $options: "i" } },
      ];
    }

    // Use company_audits — the canonical audit collection
    const [logs, total] = await Promise.all([
      db.collection("company_audits")
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .project({ _id: 0 })
        .toArray(),
      db.collection("company_audits").countDocuments(query),
    ]);

    // Enrich with company display names in one batched query
    const companyIds = [...new Set(
      logs.map((l) => l.companyId as string).filter(Boolean)
    )];
    const companies = companyIds.length > 0
      ? await db.collection("companies")
          .find({ companyId: { $in: companyIds } })
          .project({ companyId: 1, companyName: 1, _id: 0 })
          .toArray()
      : [];

    const companyMap = new Map(
      companies.map((c) => [c.companyId as string, c.companyName as string])
    );

    const enriched = logs.map((log) => ({
      ...log,
      tenantName: log.companyId
        ? (companyMap.get(log.companyId as string) ?? "Unknown Tenant")
        : "System Platform",
    }));

    return NextResponse.json({
      logs: enriched,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    return handleAuthError(error);
  }
}
