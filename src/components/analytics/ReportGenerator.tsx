"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileText, FileSpreadsheet, FileIcon, Loader2 } from "lucide-react";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/analytics/export-utils";
import { toast } from "sonner";
import { useAnalyticsFilters } from "@/hooks/use-analytics-filters";

export function ReportGenerator({ type = "executive", title = "Executive Report" }: { type?: string, title?: string }) {
  const [format, setFormat] = useState<"csv" | "excel" | "pdf">("pdf");
  const [isGenerating, setIsGenerating] = useState(false);
  const [open, setOpen] = useState(false);
  const { filters } = useAnalyticsFilters();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/analytics/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, filters, format })
      });

      if (!res.ok) throw new Error("Failed to generate report");

      const { data } = await res.json();
      
      let exportData = data;
      // Depending on the report type, we might need to flatten or restructure `data` for tabular export
      if (type === "executive" && data.shipments) {
        exportData = [
          { Metric: "Active Shipments", Value: data.shipments.active },
          { Metric: "Shipment Success Rate", Value: `${data.shipments.successRate}%` },
          { Metric: "Fleet Utilization", Value: `${data.fleet.utilizationRate}%` },
          { Metric: "Health Score", Value: data.healthScore }
        ];
      }

      const filename = `SentinelRoute_${title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}`;

      if (format === "csv") exportToCSV(exportData, filename);
      else if (format === "excel") exportToExcel(exportData, filename, title);
      else if (format === "pdf") exportToPDF(exportData, filename, title);

      toast.success("Report generated successfully", { description: "Your download should begin immediately." });
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Generation failed", { description: "An error occurred while generating the report." });
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
