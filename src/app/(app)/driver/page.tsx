"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from 'next/dynamic';
import { useUser } from "@/lib/auth-context";
import { fetchApi } from "@/lib/api-client";
import { ShipmentExecution, ShipmentCheckpoint } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/dashboard-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { MapPin, Navigation, Truck, AlertTriangle, CheckCircle2, Eraser, TrendingUp, Camera } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import SignatureCanvas from 'react-signature-canvas';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

const DriverLiveMap = dynamic(() => import('@/components/shipment/DriverLiveMap').then(m => m.DriverLiveMap), { ssr: false });

export default function DriverAppPage() {
  const { user } = useUser();
  const { t } = useI18n();
  const [execution, setExecution] = useState<ShipmentExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<{ totalCompleted: number, totalOnTime: number, incidentsCount: number } | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  
  // POD Signature state
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);
  const [podPhotoFile, setPodPhotoFile] = useState<File | null>(null);
  const [podPhotoPreview, setPodPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const podPhotoInputRef = useRef<HTMLInputElement>(null);

  // Incident state
  const [showIncidentDialog, setShowIncidentDialog] = useState(false);
  const [incidentCategory, setIncidentCategory] = useState("Accident");
  const [incidentSeverity, setIncidentSeverity] = useState("high");
  const [incidentDesc, setIncidentDesc] = useState("");
  const [submittingIncident, setSubmittingIncident] = useState(false);

  const fetchActiveExecution = async () => {
    if (!user?.uid) return;
    try {
      const res = await fetchApi(`/api/execution/active?driverId=${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        if (data.executions && data.executions.length > 0) {
          setExecution(data.executions[0]);
        } else {
          setExecution(null);
        }
      }
      
      const statsRes = await fetchApi(`/api/driver/analytics`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setAnalytics(statsData.analytics);
      }
      
      const availRes = await fetchApi(`/api/workforce/drivers/availability`);
      if (availRes.ok) {
        const availData = await availRes.json();
        const me = availData.availability?.find((d: any) => d.userId === user.uid);
        if (me) {
          setIsAvailable(me.status === "available");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveExecution();
    const interval = setInterval(fetchActiveExecution, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Offline Sync
  useEffect(() => {
    const OFFLINE_KEY = "sentinelroute_offline_actions";
    const syncOffline = async () => {
      if (!navigator.onLine) return;
      
      const stored = localStorage.getItem(OFFLINE_KEY);
      if (!stored) return;
      
      let actions = [];
      try {
        actions = JSON.parse(stored);
      } catch(e) {}
      
      if (!Array.isArray(actions) || actions.length === 0) return;
      
      toast.info(`Syncing ${actions.length} offline actions...`);
      const newActions = [];
      
      for (const action of actions) {
        try {
          const res = await fetchApi(action.url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(action.payload)
          });
          if (!res.ok) throw new Error("Sync failed");
        } catch (e) {
          newActions.push(action);
        }
      }
      
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(newActions));
      if (newActions.length === 0) {
        toast.success("All offline actions synced successfully!");
        fetchActiveExecution();
      }
    };

    window.addEventListener('online', syncOffline);
    if (navigator.onLine) {
      syncOffline();
    }
    return () => window.removeEventListener('online', syncOffline);
  }, []);

  const toggleAvailability = async () => {
    try {
      setUpdatingAvailability(true);
      const newStatus = !isAvailable;
      const res = await fetchApi(`/api/workforce/drivers/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: newStatus })
      });
      if (res.ok) {
        setIsAvailable(newStatus);
        toast.success(`You are now ${newStatus ? 'Available' : 'Unavailable'}`);
      } else {
        throw new Error("Failed to update");
      }
    } catch (e) {
      toast.error("Failed to update availability");
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const handleAction = async (action: string, extraPayload: any = {}) => {
    if (!execution) return;
    const payload = { action, notes: `Driver triggered: ${action}`, ...extraPayload };
    const url = `/api/execution/${execution.shipmentId}/workflow`;

    if (!navigator.onLine) {
      const OFFLINE_KEY = "sentinelroute_offline_actions";
      const actions = JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
      actions.push({ url, payload });
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(actions));
      toast.success(`Action saved offline. Will sync when reconnected.`);
      if (action === "complete") setShowSignatureDialog(false);
      return;
    }

    try {
      const res = await fetchApi(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || await res.text());
      }
      toast.success(`Trip ${action} successful`);
      if (action === "complete") {
        setShowSignatureDialog(false);
      }
      fetchActiveExecution();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmittingComplete(false);
    }
  };

  const handleCheckpoint = async (checkpointId: string, action: string) => {
    if (!execution) return;
    const payload = { checkpointId, action, notes: `Driver checkpoint ${action}` };
    const url = `/api/execution/${execution.shipmentId}/checkpoint`;

    if (!navigator.onLine) {
      const OFFLINE_KEY = "sentinelroute_offline_actions";
      const actions = JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
      actions.push({ url, payload });
      localStorage.setItem(OFFLINE_KEY, JSON.stringify(actions));
      toast.success(`Checkpoint saved offline. Will sync when reconnected.`);
      
      // Optimistically update UI if needed, but for now we just show a toast
      // and let the next sync fix the execution state.
      return;
    }

    try {
      const res = await fetchApi(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || await res.text());
      }
      toast.success(`Checkpoint ${action} successful`);
      fetchActiveExecution();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    }
  };

  const submitCompleteTrip = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      toast.error("Proof of Delivery signature is required.");
      return;
    }
    
    setSubmittingComplete(true);
    const signatureSvg = sigCanvas.current.getTrimmedCanvas().toDataURL('image/svg+xml');

    let podPhotoUrl: string | undefined;
    if (podPhotoFile) {
      try {
        setUploadingPhoto(true);
        const { storage } = await import('@/lib/firebase');
        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const fileRef = ref(storage, `pod/${execution!.shipmentId}/${Date.now()}_${podPhotoFile.name}`);
        const snapshot = await uploadBytes(fileRef, podPhotoFile);
        podPhotoUrl = await getDownloadURL(snapshot.ref);
      } catch (e) {
        toast.error("Photo upload failed, submitting without photo.");
      } finally {
        setUploadingPhoto(false);
      }
    }

    handleAction("complete", { podSignatureSvg: signatureSvg, ...(podPhotoUrl ? { podPhotoUrl } : {}) });
  };

  const submitIncident = async () => {
    if (!execution || !incidentDesc) return;
    setSubmittingIncident(true);
    try {
      const payload = {
        title: `Driver Reported: ${incidentCategory}`,
        description: incidentDesc,
        category: incidentCategory,
        severity: incidentSeverity,
        relatedShipmentId: execution.shipmentId,
        latitude: execution.historicalLocations?.[execution.historicalLocations.length - 1]?.latitude || 0,
        longitude: execution.historicalLocations?.[execution.historicalLocations.length - 1]?.longitude || 0,
      };
      const res = await fetchApi(`/api/incidents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error("Failed to report incident");
      }
      toast.success("Incident reported successfully. HQ notified.");
      setShowIncidentDialog(false);
      setIncidentDesc("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Report failed");
    } finally {
      setSubmittingIncident(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-100px)] items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Loading assigned shipment...</p>
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="flex flex-col h-[calc(100vh-100px)] items-center justify-center text-center p-6">
        <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mb-6">
          <Truck className="w-12 h-12 text-muted-foreground opacity-50" />
        </div>
        <h2 className="text-2xl font-bold mb-2">{t("driverApp.noActiveShipment")}</h2>
        <p className="text-muted-foreground max-w-md">
          {t("driverApp.noActiveShipmentSubtitle")}
        </p>
        
        <div className="mt-8 flex flex-col items-center gap-4">
          <Button onClick={() => fetchActiveExecution()}>
            {t("driverApp.refresh")}
          </Button>
          <div className="flex items-center gap-3 bg-card border rounded-full px-4 py-2 mt-2">
            <span className="text-sm font-medium">Duty Status:</span>
            <Button
              variant={isAvailable ? "default" : "secondary"}
              size="sm"
              className={isAvailable ? "bg-emerald-600 hover:bg-emerald-700" : ""}
              onClick={toggleAvailability}
              disabled={updatingAvailability}
            >
              {isAvailable ? "Available" : "Unavailable"}
            </Button>
          </div>
        </div>

        {analytics && (
          <div className="mt-8 w-full">
            <DashboardCard title={t("driverApp.yourPerformance")} icon={TrendingUp}>
              <div className="grid grid-cols-2 gap-4 py-2">
                <div className="bg-primary/5 p-4 rounded-xl flex flex-col items-center">
                  <span className="text-2xl font-black text-primary">{analytics.totalCompleted}</span>
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{t("driverApp.completed")}</span>
                </div>
                <div className="bg-emerald-500/10 p-4 rounded-xl flex flex-col items-center">
                  <span className="text-2xl font-black text-emerald-500">{analytics.totalOnTime}</span>
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{t("driverApp.onTime")}</span>
                </div>
              </div>
              <div className="text-xs text-center text-muted-foreground mt-2">
                {t("driverApp.totalReportedIncidents").replace("{count}", analytics.incidentsCount.toString())}
              </div>
            </DashboardCard>
          </div>
        )}
      </div>
    );
  }

  const nextCheckpoint = execution.checkpoints?.find((cp) => cp.status === "pending");

  return (
    <div className="max-w-md mx-auto w-full pb-20">
      {/* Mobile-optimized Header */}
      <div className="bg-primary/5 border-b border-primary/10 p-6 pt-8 mb-6 sticky top-0 z-10 backdrop-blur-md">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">
              Active Shipment
            </p>
            <h1 className="text-3xl font-black">{execution.shipmentId}</h1>
          </div>
          <StatusBadge status={execution.status} />
        </div>
        
        {execution.currentETA && (
          <div className="flex items-center gap-2 bg-emerald-500/10 text-emerald-500 px-3 py-2 rounded-lg font-medium text-sm">
            <Navigation className="w-4 h-4" />
            ETA: {format(new Date(execution.currentETA), "h:mm a")}
          </div>
        )}
      </div>

      <div className="px-4 space-y-6">
        
        {/* Driver Map */}
        <div className="mb-6">
          <DriverLiveMap execution={execution} />
        </div>

        {/* Core Actions (Giant Touch Targets) */}
        <div className="grid grid-cols-2 gap-4">
          {execution.status === "pending" && execution.driverAccepted === false && (
            <>
              <Button 
                size="lg" 
                variant="outline"
                className="col-span-1 h-16 text-lg border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => handleAction("decline")}
              >
                Decline
              </Button>
              <Button 
                size="lg" 
                className="col-span-1 h-16 text-lg bg-emerald-600 hover:bg-emerald-700"
                onClick={() => handleAction("accept")}
              >
                Accept
              </Button>
            </>
          )}
          {execution.status === "pending" && execution.driverAccepted !== false && (
            <Button 
              size="lg" 
              className="col-span-2 h-16 text-lg"
              onClick={() => handleAction("start")}
            >
              Start Trip
            </Button>
          )}
          {execution.status === "driving" && (
            <>
              <Button 
                size="lg" 
                variant="outline"
                className="h-16 text-lg border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                onClick={() => handleAction("pause")}
              >
                Pause Rest
              </Button>
              <Button 
                size="lg" 
                variant="destructive"
                className="h-16 text-lg"
                onClick={() => setShowIncidentDialog(true)}
              >
                <AlertTriangle className="mr-2 h-5 w-5" /> SOS
              </Button>
            </>
          )}
          {execution.status === "paused" && (
            <Button 
              size="lg" 
              className="col-span-2 h-16 text-lg"
              onClick={() => handleAction("resume")}
            >
              Resume Trip
            </Button>
          )}
        </div>

        {/* Checkpoint Status */}
        {execution.status === "driving" && nextCheckpoint && (
          <DashboardCard title="Next Stop" icon={MapPin}>
            <div className="py-2">
              <h3 className="text-xl font-bold mb-1">{nextCheckpoint.name}</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Status: {nextCheckpoint.status.toUpperCase()}
              </p>
              <Button 
                size="lg" 
                className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleCheckpoint(nextCheckpoint.id, "arrive")}
              >
                I have arrived
              </Button>
            </div>
          </DashboardCard>
        )}

        {/* Complete Trip Section */}
        {execution.status === "driving" && !nextCheckpoint && (
          <DashboardCard title="Route Complete" icon={CheckCircle2}>
            <div className="py-2">
              <h3 className="text-xl font-bold mb-1">All Stops Reached</h3>
              <p className="text-muted-foreground text-sm mb-6">
                You have reached all destinations for this shipment. Please collect a signature and complete the trip.
              </p>
              <Button 
                size="lg" 
                className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => setShowSignatureDialog(true)}
              >
                Complete Trip & Sign
              </Button>
            </div>
          </DashboardCard>
        )}

        {/* Previous/Completed Checkpoints */}
        <div className="space-y-3 mt-8">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest px-2">
            Route Progress
          </h4>
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="relative border-l-2 border-primary/20 ml-3 space-y-6">
              {execution.checkpoints?.map((cp: ShipmentCheckpoint, idx: number) => (
                <div key={cp.id} className="relative pl-6">
                  <span 
                    className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 bg-background ${
                      cp.status === 'arrived' || cp.status === 'departed'
                        ? 'border-emerald-500' 
                        : 'border-muted-foreground'
                    }`} 
                  />
                  <div>
                    <h5 className="font-semibold text-sm">{cp.name}</h5>
                    <p className="text-xs text-muted-foreground capitalize">
                      {cp.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Signature Dialog */}
      <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
        <DialogContent className="sm:max-w-md w-[90vw] rounded-xl p-4 sm:p-6 mx-auto bg-background/95 backdrop-blur-lg border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              Proof of Delivery
            </DialogTitle>
            <DialogDescription>
              Please collect the recipient&apos;s signature to finalize this shipment.
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4">
            <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 overflow-hidden touch-none relative">
              <SignatureCanvas 
                ref={sigCanvas}
                penColor="black"
                canvasProps={{ 
                  className: "w-full h-[200px] touch-none cursor-crosshair",
                  style: { width: '100%', height: '200px' }
                }} 
              />
              <div className="absolute bottom-2 right-2 flex gap-2">
                <Button 
                  size="sm" 
                  variant="secondary" 
                  onClick={() => sigCanvas.current?.clear()}
                  className="bg-white/80 hover:bg-white text-gray-700 shadow-sm backdrop-blur-sm"
                >
                  <Eraser className="w-4 h-4 mr-1" /> Clear
                </Button>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2 font-medium">
              By signing, you confirm receipt of {execution.shipmentId}
            </p>

            {/* Photo Upload */}
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Delivery Photo (Optional)</p>
              <input
                ref={podPhotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setPodPhotoFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => setPodPhotoPreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
              {podPhotoPreview ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={podPhotoPreview} alt="POD photo" className="w-full h-32 object-cover rounded-lg border" />
                  <Button
                    size="sm"
                    variant="destructive"
                    className="absolute top-1 right-1"
                    onClick={() => { setPodPhotoFile(null); setPodPhotoPreview(null); }}
                  >
                    Remove
                  </Button>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed border-muted rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => podPhotoInputRef.current?.click()}
                >
                  <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Tap to take photo or upload</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowSignatureDialog(false)}
              className="flex-1 sm:flex-none"
              disabled={submittingComplete || uploadingPhoto}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={submitCompleteTrip}
              className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700"
              disabled={submittingComplete || uploadingPhoto}
            >
              {uploadingPhoto ? "Uploading..." : submittingComplete ? "Submitting..." : "Submit & Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Incident Dialog */}
      <Dialog open={showIncidentDialog} onOpenChange={setShowIncidentDialog}>
        <DialogContent className="sm:max-w-md w-[90vw] rounded-xl p-4 sm:p-6 mx-auto bg-background/95 backdrop-blur-lg border-border/50">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Report Incident (SOS)
            </DialogTitle>
            <DialogDescription>
              Report an issue immediately to the Command Center.
            </DialogDescription>
          </DialogHeader>
          
          <div className="my-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <select 
                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={incidentCategory}
                onChange={(e) => setIncidentCategory(e.target.value)}
              >
                <option value="Accident">Accident</option>
                <option value="Breakdown">Breakdown</option>
                <option value="Traffic">Traffic / Road Block</option>
                <option value="Weather">Severe Weather</option>
                <option value="Security">Security Threat</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Severity</label>
              <select 
                className="w-full flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={incidentSeverity}
                onChange={(e) => setIncidentSeverity(e.target.value)}
              >
                <option value="critical">Critical (Immediate Assistance Required)</option>
                <option value="high">High (Major Delay/Issue)</option>
                <option value="medium">Medium (Moderate Delay)</option>
                <option value="low">Low (Minor Issue)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea 
                className="w-full flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Briefly describe the situation..."
                value={incidentDesc}
                onChange={(e) => setIncidentDesc(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowIncidentDialog(false)}
              className="flex-1 sm:flex-none"
              disabled={submittingIncident}
            >
              Cancel
            </Button>
            <Button 
              type="button" 
              onClick={submitIncident}
              className="flex-1 sm:flex-none"
              variant="destructive"
              disabled={submittingIncident || !incidentDesc}
            >
              {submittingIncident ? "Sending..." : "Submit SOS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
