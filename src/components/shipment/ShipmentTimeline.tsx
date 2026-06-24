"use client";

import { useEffect, useState } from "react";
import { Clock, Activity, MessageSquare, AlertTriangle, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function ShipmentTimeline({ shipmentId }: { shipmentId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        const res = await fetch(`/api/intelligence/shipments/${shipmentId}/timeline`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.timeline || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchTimeline();
    // In a real app with websockets we would listen for updates here.
    const interval = setInterval(fetchTimeline, 30000); // poll every 30s as fallback
    return () => clearInterval(interval);
  }, [shipmentId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground animate-pulse border border-border rounded-xl">Loading timeline...</div>;
  if (events.length === 0) return <div className="p-6 text-sm text-muted-foreground border border-border rounded-xl">No timeline events recorded yet.</div>;

  const getIcon = (type: string) => {
    if (type.includes("Alert") || type.includes("Risk")) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    if (type.includes("Message")) return <MessageSquare className="w-4 h-4 text-blue-500" />;
    if (type.includes("System")) return <ShieldCheck className="w-4 h-4 text-primary" />;
    return <Activity className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="panel p-6 bg-card border border-border rounded-xl space-y-6">
      <h3 className="font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" /> Risk Timeline
      </h3>
      
      <div className="relative pl-6 space-y-6 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
        {events.map((event, index) => (
          <div key={event.eventId} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className={cn(
              "flex items-center justify-center w-6 h-6 rounded-full border-2 border-background bg-muted absolute left-[-29px] shadow-sm",
              event.type.includes("Alert") ? "bg-amber-100 dark:bg-amber-900/30 border-amber-500/30" : ""
            )}>
              {getIcon(event.type)}
            </div>
            
            <div className="w-full bg-muted/20 border border-border/50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-1">
                <span className="text-sm font-semibold">{event.type}</span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 bg-background border border-border rounded-full text-muted-foreground">
                  Source: {event.source}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
