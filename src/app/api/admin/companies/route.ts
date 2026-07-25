import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireSuperAdmin, handleAuthError } from "@/lib/auth-helpers";
import { adminLimiter, getClientIp } from "@/lib/rate-limit";
import { ApiErrors } from "@/lib/api-errors";
import type { Company, UserRecord } from "@/lib/types";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = adminLimiter.check(ip);
  if (rl.limited) return ApiErrors.rateLimited(rl.retryAfter);

  try {
    await requireSuperAdmin(req);
    const db = await getDb();

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");
    const searchStr = searchParams.get("search");
    const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip  = (page - 1) * limit;

    const query: Record<string, unknown> = {};
    if (statusFilter && statusFilter !== "all") {
      query.status = statusFilter;
    }
    if (searchStr) {
      const escaped = searchStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { companyName: { $regex: escaped, $options: "i" } },
        { companyId:   { $regex: escaped, $options: "i" } },
      ];
    }

    const [companies, total] = await Promise.all([
      db.collection<Company>("companies")
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      db.collection<Company>("companies").countDocuments(query),
    ]);

    const companyIds = [...new Set(companies.map((c) => c.companyId))];
    const adminUsers = await db
      .collection<UserRecord>("users")
      .find({ companyId: { $in: companyIds }, role: "company_admin" })
      .toArray();

    const adminEmailMap = new Map<string, string>(
      adminUsers.map((u) => [u.companyId, u.email])
    );

    const cleaned = companies.map(({ _id, ...c }: Company & { _id: unknown }) => ({
      ...c,
      adminUserEmail: adminEmailMap.get(c.companyId) ?? null,
    }));

    return NextResponse.json({
      companies: cleaned,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleAuthError(err);
  }
}
