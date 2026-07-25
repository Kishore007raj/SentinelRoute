import { NextRequest, NextResponse } from "next/server";
import { verifyFirebaseToken } from "@/lib/firebase-admin";
import { getDb } from "@/lib/mongodb";

export async function POST(req: NextRequest) {
  try {
    const token = await verifyFirebaseToken(req);
    const body = await req.json();
    
    const db = await getDb();
    
    // Module 5 Audit Format
    await db.collection("route_audits").insertOne({
      ...body,
      userId:    token.uid,
      companyId: null,          // companyId is resolved from userRecord in production flows
      timestamp: new Date().toISOString(),
    });
    
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[audit] Error:", err);
    return NextResponse.json({ error: "Failed to store audit" }, { status: 500 });
  }
}
