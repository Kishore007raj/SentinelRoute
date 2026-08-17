"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Download, FileText, FileSpreadsheet, FileIcon, Loader2 } from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/analytics/export-utils";
import { toast } from "sonner";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";
import { auth } from "@/lib/firebase";

/** Flatten any value into a string safe for tabular export. */
function flattenValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/**
 * Convert the raw API response data into a flat array of row objects
 * suitable for CSV / Excel / PDF export.
 *
 * Executive reports → labelled Metric/Value rows.
 * Shipment list     → strip MongoDB _id, flatten nested objects.
 * Any other shape   → best-effort flatten.
 */
function shapeExportData(type: string, data: unknown): Record<string, unknown>[] {
  if (!data) return [];

  // Executive KPI report — convert nested object to labelled rows
  if (type === "executive" && typeof data === "object" && data !== null) {
    const d = data as Record<string, unknown>;
    const rows: Record<string, unknown>[] = [];

    const ship = d.shipments as Record<string, unknown> | undefined;
    if (ship) {
      rows.push(
        { Metric: "Total Shipments",        Value: ship.total         ?? 0 },
        { Metric: "Active Shipments",        Value: ship.active        ?? 0 },
        { Metric: "Completed Shipments",     Value: ship.completed     ?? 0 },
        { Metric: "At-Risk Shipments",       Value: ship.atRisk        ?? 0 },
        { Metric: "Cancelled Shipments",     Value: ship.cancelled     ?? 0 },
        { Metric: "Shipment Success Rate",   Value: `${ship.successRate ?? 0}%` },
        { Metric: "Delivery Performance",    Value: `${ship.deliveryPerformance ?? 0}%` },
      );
    }
    const fleet = d.fleet as Record<string, unknown> | undefined;
    if (fleet) {
      rows.push(
        { Metric: "Total Vehicles",          Value: fleet.total         ?? 0 },
        { Metric: "Available Vehicles",      Value: fleet.available     ?? 0 },
        { Metric: "Assigned Vehicles",       Value: fleet.assigned      ?? 0 },
        { Metric: "Fleet Utilization Rate",  Value: `${fleet.utilizationRate ?? 0}%` },
        { Metric: "Fleet Availability Rate", Value: `${fleet.availabilityRate ?? 0}%` },
      );
    }
    const drivers = d.drivers as Record<string, unknown> | undefined;
    if (drivers) {
      rows.push(
        { Metric: "Total Drivers",           Value: drivers.total          ?? 0 },
        { Metric: "Active Drivers",          Value: drivers.active         ?? 0 },
        { Metric: "Driver Utilization Rate", Value: `${drivers.utilizationRate ?? 0}%` },
      );
    }
    const incidents = d.incidents as Record<string, unknown> | undefined;
    if (incidents) {
      rows.push(
        { Metric: "Total Incidents",         Value: incidents.total    ?? 0 },
        { Metric: "Critical Incidents",      Value: incidents.critical ?? 0 },
        { Metric: "High Incidents",          Value: incidents.high     ?? 0 },
      );
    }
    if (d.healthScore !== undefined) {
      rows.push({ Metric: "Operational Health Score", Value: d.healthScore });
    }
    return rows;
  }

  // Array response (e.g. shipment list) — strip _id, flatten nested fields
  if (Array.isArray(data)) {
    return data.map((item: unknown) => {
      if (typeof item !== "object" || item === null) return { Value: flattenValue(item) };
      const { _id, ...rest } = item as Record<string, unknown>;
      void _id; // strip MongoDB ObjectId
      return Object.fromEntries(
        Object.entries(rest).map(([k, v]) => [k, flattenValue(v)])
      );
    });
  }

  // Fallback: wrap single object as one row
  if (typeof data === "object" && data !== null) {
    return [
      Object.fromEntries(
        Object.entries(data as Record<string, unknown>).map(([k, v]) => [k, flattenValue(v)])
      ),
    ];
  }

  return [];
}

export function ReportGenerator({ type = "executive", title = "Executive Report" }: { type?: string, title?: string }) {
  const [format, setFormat] = useState<"csv" | "excel" | "pdf">("pdf");
  const [isGenerating, setIsGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  const { filters } = useAnalyticsFilters();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Always attach the Firebase ID token — requireAnalyticsAccess rejects unauthenticated calls
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : "";

      const res = await fetch("/api/analytics/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type, filters, format }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(errBody.error ?? `Server error ${res.status}`);
      }

      const { data } = await res.json() as { data: unknown };

      const exportData = shapeExportData(type, data);

      if (exportData.length === 0) {
        toast.warning("No data to export", { description: "The report returned no records for the selected filters." });
        return;
      }

      const filename = `SentinelRoute_${title.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}`;

      if (format === "csv")   exportToCSV(exportData, filename);
      else if (format === "excel") exportToExcel(exportData, filename, title);
      else if (format === "pdf")   exportToPDF(exportData, filename, title);

      toast.success("Report generated successfully", { description: "Your download should begin immediately." });
      setOpen(false);
    } catch (error) {
      console.error("[ReportGenerator]", error);
      toast.error("Generation failed", {
        description: error instanceof Error ? error.message : "An error occurred while generating the report.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="btn-primary text-xs gap-2" />}>
        <Download className="w-4 h-4" />
        Generate Report
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-panel border-border text-foreground">
        <DialogHeader>
          <DialogTitle>Generate Analytics Report</DialogTitle>
          <DialogDescription>
            Export the current view as a downloadable report. Filters currently applied to the page will be included in the generation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <span className="text-right text-sm font-medium">Format</span>
            <div className="col-span-3 flex gap-2">
              <Button 
                variant={format === "pdf" ? "default" : "outline"} 
                className="flex-1 gap-2"
                onClick={() => setFormat("pdf")}
              >
                <FileText className="w-4 h-4" /> PDF
              </Button>
              <Button 
                variant={format === "excel" ? "default" : "outline"} 
                className="flex-1 gap-2"
                onClick={() => setFormat("excel")}
              >
                <FileSpreadsheet className="w-4 h-4" /> Excel
              </Button>
              <Button 
                variant={format === "csv" ? "default" : "outline"} 
                className="flex-1 gap-2"
                onClick={() => setFormat("csv")}
              >
                <FileIcon className="w-4 h-4" /> CSV
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Download
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
