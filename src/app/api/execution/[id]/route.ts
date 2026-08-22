import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { requireApprovedCompany, handleAuthError } from "@/lib/auth-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const routeStart = Date.now();
  try {
    const authStart = Date.now();
    const auth = await requireApprovedCompany(req);
    const authTime = Date.now() - authStart;
    console.log(`[GET /api/execution/[id]] requireApprovedCompany took ${authTime}ms`);

    const { id: shipmentId } = await params;
    
    if (!shipmentId) {
      return NextResponse.json({ error: "Missing shipment ID" }, { status: 400 });
    }
    
    const dbStart = Date.now();
    const db = await getDb();
    const dbTime = Date.now() - dbStart;
    console.log(`[GET /api/execution/[id]] getDb() took ${dbTime}ms`);

    const queryStart = Date.now();
    const execution = await db.collection("shipment_executions").findOne({
      shipmentId,
      companyId: auth.company.companyId
    });
    const queryTime = Date.now() - queryStart;
    console.log(`[GET /api/execution/[id]] Query took ${queryTime}ms for shipmentId=${shipmentId}, result=${execution ? "found" : "404"}`);
    
    if (!execution) {
      const totalTime = Date.now() - routeStart;
      console.log(`[GET /api/execution/[id]] Total time (404): ${totalTime}ms`);
      return NextResponse.json({ error: "Execution document not found" }, { status: 404 });
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...cleanExecution } = execution;
    const totalTime = Date.now() - routeStart;
    console.log(`[GET /api/execution/[id]] Total time (200): ${totalTime}ms`);
    return NextResponse.json({ execution: cleanExecution });
  } catch (err) {
    return handleAuthError(err);
  }
}
