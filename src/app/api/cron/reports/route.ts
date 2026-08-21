import { NextResponse } from "next/server";
import { getDb } from "@/lib/mongodb";
import { utcNow } from "@/lib/time";
import { addTimelineEvent } from "@/lib/timeline-service";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // For local testing, we might allow bypass if CRON_SECRET is not set, 
      // but standard practice is to require it.
      if (process.env.NODE_ENV === "production") {
        return new NextResponse("Unauthorized", { status: 401 });
      }
    }

    const db = await getDb();
    
    // In a real system, we'd fetch companies that have scheduled reports enabled
    // For now, let's fetch all companies
    const companies = await db.collection("companies").find({}).toArray();
    
    const now = new Date(utcNow());
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString();
    
    const reportsSent = [];

    for (const company of companies) {
      const companyId = company.companyId;
      
      // Fetch KPIs for the last 24 hours
      const executions = await db.collection("shipment_executions").find({
        companyId,
        lastUpdated: { $gte: yesterdayStr }
      }).toArray();
      
      const totalExecutions = executions.length;
      const completedExecutions = executions.filter(e => e.status === "completed").length;
      
      const incidents = await db.collection("incident_events").find({
        companyId,
        timestamp: { $gte: yesterdayStr }
      }).toArray();

      // Here you would normally use a library like 'resend' or 'nodemailer' to send an email.
      // E.g., await resend.emails.send({ to: company.adminEmail, subject: "Daily Report", text: ... })
      
      const reportLog = {
        companyId,
        type: "daily_summary",
        status: "sent", // Simulated
        metrics: {
          totalActiveShipments: totalExecutions,
          completedShipments: completedExecutions,
          incidentsReported: incidents.length
        },
        sentAt: utcNow()
      };

      await db.collection("report_logs").insertOne(reportLog);
      
      // Timeline events are strictly for shipments, skipping for company report
      
      reportsSent.push({ companyId, metrics: reportLog.metrics });
    }

    return NextResponse.json({ success: true, reportsSent });
  } catch (error) {
    console.error("Cron reports error:", error);
    return NextResponse.json({ error: "Failed to run scheduled reports" }, { status: 500 });
  }
}
