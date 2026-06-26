"use client";

import { useEffect, useState } from "react";
import { Clock, Activity, MessageSquare, AlertTriangle, ShieldCheck, MapPin, Navigation, CloudRain, ShieldAlert, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

export function ShipmentTimeline({ shipmentId }: { shipmentId: string }) {
  const { t } = useI18n();
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
    const interval = setInterval(fetchTimeline, 30000);
    return () => clearInterval(interval);
  }, [shipmentId]);

  if (loading) return <div className="p-6 text-sm text-muted-foreground animate-pulse border border-border rounded-xl">{t('shipmentDetail.loadingTimeline')}</div>;
  if (events.length === 0) return <div className="p-6 text-sm text-muted-foreground border border-border rounded-xl">{t('shipmentDetail.noTimelineEvents')}</div>;

  const getStyle = (type: string) => {
    const tLower = type.toLowerCase();
    if (tLower.includes("dispatch") || tLower.includes("start")) return { icon: <Navigation className="w-4 h-4 text-emerald-500" />, bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (tLower.includes("weather") || tLower.includes("rain")) return { icon: <CloudRain className="w-4 h-4 text-blue-500" />, bg: "bg-blue-500/10 border-blue-500/20" };
    if (tLower.includes("traffic") || tLower.includes("congestion") || tLower.includes("delay")) return { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, bg: "bg-amber-500/10 border-amber-500/20" };
    if (tLower.includes("reroute") || tLower.includes("critical") || tLower.includes("incident")) return { icon: <ShieldAlert className="w-4 h-4 text-red-500" />, bg: "bg-red-500/10 border-red-500/20" };
    if (tLower.includes("complete") || tLower.includes("arrive")) return { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, bg: "bg-emerald-500/10 border-emerald-500/20" };
    if (tLower.includes("system")) return { icon: <ShieldCheck className="w-4 h-4 text-primary" />, bg: "bg-primary/10 border-primary/20" };
    return { icon: <Activity className="w-4 h-4 text-muted-foreground" />, bg: "bg-muted border-border" };
  };

  // Group by date
  const grouped = events.reduce((acc, event) => {
    const date = new Date(event.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="panel p-6 bg-card border border-border rounded-xl space-y-6">
      <h3 className="font-semibold flex items-center gap-2">
        <Clock className="w-4 h-4 text-primary" /> Live Operational Timeline
      </h3>
      
      <div className="relative space-y-8 pl-4">
        <div className="absolute top-0 bottom-0 left-[27px] w-0.5 bg-gradient-to-b from-transparent via-border to-transparent -z-10" />
        
        {Object.entries(grouped).map(([date, dateEvents]) => (
          <div key={date} className="space-y-6">
            <div className="sticky top-0 z-10 -ml-2 pb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground bg-background px-2">{date}</span>
            </div>
            <div className="space-y-6">
              {(dateEvents as any[]).map((event: any) => {
                const style = getStyle(event.type);
                return (
                  <div key={event.eventId} className="relative flex gap-4 group">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full border border-background shadow-sm shrink-0 z-10",
                      style.bg, "bg-background"
                    )}>
                      {style.icon}
                    </div>
                    
                    <div className="flex-1 min-w-0 bg-muted/20 border border-border/50 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow group-hover:border-border/80">
                      <div className="flex items-start justify-between mb-1 gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{event.type}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                          {new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{event.description}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 bg-background border border-border rounded-full text-muted-foreground">
                          {t('shipmentDetail.source')}: {event.source}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
