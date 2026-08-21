import { NextRequest, NextResponse } from "next/server";
import { runCompanyEscalationRules } from "@/lib/escalation-engine";

/**
 * GET /api/cron/sla-check
 * Cron route that executes the Escalation Rules Engine (SLA breaches, stagnant trips).
 * Called automatically by Vercel Cron every 15 minutes.
 */
export async function GET(req: NextRequest) {
  // Basic security: only allow internal cron calls if CRON_SECRET is configured
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runCompanyEscalationRules();
    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: unknown) {
    console.error("[sla-check cron] Error:", error);
    return NextResponse.json({ error: "SLA check failed" }, { status: 500 });
  }
}
