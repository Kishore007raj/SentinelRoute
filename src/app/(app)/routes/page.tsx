"use client";

import { fetchApi } from "@/lib/api-client";
import { useState, useEffect, useRef, useMemo } from "react";
import { motion, LayoutGroup } from "framer-motion";
import { ArrowRight, ChevronLeft, AlertTriangle, Navigation, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShipmentPass } from "@/components/shipment/ShipmentPass";
import dynamic from "next/dynamic";
const RouteMapView = dynamic(() => import("@/components/shipment/RouteMapView").then((mod) => mod.RouteMapView), { ssr: false });
import { DispatchedStub } from "@/components/shipment/ShipmentPass";
import { generateShipmentCode, cn, getRiskColor } from "@/lib/utils";
import { useStore } from "@/lib/store";
import type { Route, PendingShipment } from "@/lib/types";
import { recommendationBadge, deriveConfidence } from "@/lib/route-utils";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ─── Breakdown label helpers ──────────────────────────────────────────────────

function breakdownLabel(key: string, score: number): string {
  if (key === "traffic")          return score > 65 ? "Heavy"            : score > 35 ? "Moderate"    : "Light";
  if (key === "weather")          return score > 65 ? "Severe"           : score > 35 ? "Rain risk"   : "Clear";
  if (key === "disruption")       return score > 65 ? "High"             : score > 35 ? "Moderate"    : "Low";
  if (key === "cargoSensitivity") return score > 65 ? "High sensitivity" : score > 35 ? "Moderate"    : "Low";
  return score > 50 ? "Elevated" : "Normal";
}

function breakdownLabelColor(score: number): string {
  if (score > 65) return "text-red-400";
  if (score > 35) return "text-amber-400";
  return "text-emerald-400";
}

// ─── Route card ───────────────────────────────────────────────────────────────

function DominantRoute({
  route, onSelect, selected, cargoType, urgency, allRoutes,
}: {
  route: Route; onSelect: (id: string) => void; selected: boolean;
  cargoType?: string; urgency?: string; allRoutes?: Route[];
}) {
  const riskColor = getRiskColor(route.riskLevel);
  const recBadge = route.recommended
    ? recommendationBadge(route, cargoType ?? "", urgency ?? "Standard", allRoutes ?? [])
    : null;

  return (
    <motion.div
      layoutId={`route-card-${route.id}`}
      layout
      onClick={() => onSelect(route.id)}
      transition={{ layout: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } }}
      className={cn(
        "panel p-5 bg-card cursor-pointer transition-all duration-150 relative overflow-hidden",
        selected ? "border-primary bg-muted/10 shadow-sm" : "hover:border-border/80"
      )}
    >
      <div className={cn("h-1 w-full absolute top-0 left-0", selected ? "bg-primary" : "bg-transparent")} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-foreground capitalize">{route.name}</h3>
            {recBadge && (
              <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border bg-primary/10 text-primary border-primary/20">
                {recBadge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider font-mono">{route.label}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={cn("text-2xl font-bold tabular-nums leading-none", riskColor)}>{route.riskScore}</p>
          <p className="label-meta mt-1">Risk Score</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3 pt-4 mt-4 border-t border-border/40 text-xs">
        <div><p className="label-meta mb-0.5">ETA</p><p className="font-bold text-foreground tabular-nums">{route.eta}</p></div>
        <div><p className="label-meta mb-0.5">Distance</p><p className="font-semibold text-foreground tabular-nums">{route.distance}</p></div>
        <div>
          <p className="label-meta mb-0.5">Disruption</p>
          <p className={cn("font-bold capitalize", breakdownLabelColor(route.riskBreakdown.disruption))}>
            {breakdownLabel("disruption", route.riskBreakdown.disruption)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Success state ────────────────────────────────────────────────────────────

function DispatchedSuccessState({ shipmentCode, origin, destination }: {
  shipmentCode: string; origin: string; destination: string;
}) {
  const router = useRouter();
  return (
    <div className="max-w-7xl mx-auto w-full pb-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.320, 1] }}
        className="flex flex-col items-center justify-center py-24 gap-8 bg-card border border-border rounded-xl"
      >
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ delay: 0.1, duration: 0.3, type: "spring", stiffness: 100 }}
          className="w-20 h-20 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center"
        >
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </motion.div>
        <div className="text-center max-w-md space-y-3">
          <h2 className="text-2xl font-bold text-foreground">Shipment Dispatched</h2>
          <p className="text-sm text-muted-foreground">Route locked · Decision recorded · Audit trail created.</p>
          <p className="text-xs font-mono text-muted-foreground mt-2">{shipmentCode}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" className="h-11 px-8 font-semibold rounded-lg"
            onClick={() => { window.location.href = "/create-shipment"; }}>
            New Shipment
          </Button>
          <Button className="h-11 px-8 font-semibold rounded-lg gap-2"
            onClick={() => router.push("/shipments")}>
            View Shipments <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Page header ──────────────────────────────────────────────────────────────

function PageHeader({ subtitle, showReconfigure }: { subtitle: string; showReconfigure?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
      <div>
        <p className="label-meta flex items-center gap-2 mb-2">
          <Navigation className="w-3.5 h-3.5 text-primary" />
          Route Corridor Analysis & Selection
        </p>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Route Selection</h1>
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      </div>
      {showReconfigure && (
        <Link href="/create-shipment">
          <Button variant="outline" size="sm" className="h-9 px-3.5 text-xs font-bold uppercase tracking-wider gap-2">
            <ChevronLeft className="w-3.5 h-3.5" /> Reconfigure Corridor
          </Button>
        </Link>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const { state, dispatchShipment, pendingShipmentHydrated } = useStore();

  // pendingRef: always holds the latest pending shipment for use inside async
  // dispatch callback — avoids stale-closure issues after state changes.
  const pendingRef = useRef<PendingShipment | null>(state.pendingShipment);
  useEffect(() => {
    pendingRef.current = state.pendingShipment;
  }, [state.pendingShipment]);

  // ── Route fetch state ─────────────────────────────────────────────────────
  const [routes, setRoutes]         = useState<Route[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [analyzedAt, setAnalyzedAt] = useState<string>("");
  // fetching starts false — will be set to true when pendingShipment becomes valid
  const [fetching, setFetching]     = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const fetchAttemptRef             = useRef<number>(0);

  // ── Dispatch state ────────────────────────────────────────────────────────
  const [dispatching, setDispatching]             = useState<boolean>(false);
  const [dispatched, setDispatched]               = useState<boolean>(false);
  const dispatchedRef                             = useRef(false);
  const [dispatchedShipment, setDispatchedShipment] = useState<{
    shipmentCode: string; origin: string; destination: string;
  } | null>(null);
  const [dispatchPassData, setDispatchPassData] = useState<{
    route: Route;
    shipment: { origin: string; destination: string; cargoType: string; vehicleType: string; shipmentCode: string; confidencePercent?: number };
  } | null>(null);
  const [lastDispatchedStub, setLastDispatchedStub] = useState<typeof dispatchPassData>(null);

  // ── Route fetch effect ────────────────────────────────────────────────────
  // Fires ONLY when the actual corridor parameters change OR when pendingShipmentHydrated
  // transitions from false → true (localStorage restore complete).
  //
  // Key insight: We use a stable corridorKey string to deduplicate requests for the
  // same origin/destination/cargo/vehicle/urgency/deadline combination, ignoring
  // object-identity changes from state updates or user token refreshes.
  //
  // The effect waits for pendingShipmentHydrated === true before attempting the first
  // request, preventing a race where we try to fetch routes before the store has
  // finished restoring the pending shipment from localStorage.
  
  // Memoize the corridor key so the effect only fires when actual corridor changes
  const corridorKey = useMemo(() => {
    const p = state.pendingShipment;
    if (!p) return null;
    return [
      p.origin?.trim() || "",
      p.destination?.trim() || "",
      p.cargoType?.trim() || "",
      p.vehicleType?.trim() || "",
      p.urgency?.trim() || "",
      p.deadline || "",
      p.createdAt || "", // Timestamp ensures new shipment → fresh request
    ].join("|");
  }, [state.pendingShipment]);

  const lastPendingKeyRef = useRef<string | null>("");

  useEffect(() => {
    // Don't re-run after dispatch
    if (dispatchedRef.current) return;

    // Wait for localStorage hydration to complete before trying to fetch.
    // This prevents showing "No Shipment Configured" while the store is still
    // restoring the pending shipment from localStorage.
    if (!pendingShipmentHydrated) return;

    const p = state.pendingShipment;

    // Validate: require the fields the API needs
    const isValid = (
      p !== null &&
      typeof p.origin      === "string" && p.origin.trim()      !== "" &&
      typeof p.destination === "string" && p.destination.trim() !== "" &&
      typeof p.cargoType   === "string" && p.cargoType.trim()   !== "" &&
      typeof p.vehicleType === "string" && p.vehicleType.trim() !== "" &&
      typeof p.urgency     === "string" && p.urgency.trim()     !== ""
    );

    if (!isValid) {
      // No valid pending shipment — stop spinner and show empty state
      lastPendingKeyRef.current = "";
      setFetching(false);
      setRoutes([]);
      setSelectedId("");
      setAnalyzedAt("");
      setFetchError(null);
      return;
    }

    // Build a stable key from the corridor parameters.
    // If this key matches the last request, the shipment has not actually changed
    // and we skip the API call to avoid duplicates.
    // NOTE: This check MUST happen BEFORE incrementing attemptId, otherwise
    // React StrictMode effect reruns will create new attemptIds that invalidate
    // the original running request.
    const pendingKey = corridorKey;
    const isDuplicate = pendingKey === lastPendingKeyRef.current;

    if (isDuplicate) {
      // Same corridor, same parameters — do not fire another API request.
      // This guards against:
      //  - state.pendingShipment object identity changes without data changes
      //  - React StrictMode double-invocation in development
      //  - parent component re-renders propagating down
      return;
    }

    // NEW: Only increment attemptId after confirming this is NOT a duplicate.
    // This prevents duplicate effect reruns from creating new attemptIds that
    // would invalidate an already-running request.
    const attemptId = ++fetchAttemptRef.current;
    lastPendingKeyRef.current = pendingKey;

    // Valid pending shipment with new parameters — call the API
    async function loadRoutes() {
      setFetching(true);
      setFetchError(null);

      // Client-side timeout safety net (30s) - ensures UI never hangs forever
      // even if server response is delayed or hangs
      const timeoutId = setTimeout(() => {
        if (attemptId === fetchAttemptRef.current) {
          setFetchError("Route analysis timed out. Please try again.");
          setFetching(false);
        }
      }, 30_000);

      try {
        const res = await fetchApi("/api/analyze-routes", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            origin:         p!.origin,
            destination:    p!.destination,
            cargoType:      p!.cargoType,
            vehicleType:    p!.vehicleType,
            urgency:        p!.urgency,
            originLat:      p!.originLat,
            originLng:      p!.originLng,
            destinationLat: p!.destinationLat,
            destinationLng: p!.destinationLng,
            priority:       p!.urgency,
            deadline:       p!.deadline,
          }),
        });

        clearTimeout(timeoutId);

        // Reject stale responses: only the latest request should update state.
        // Remove unmounted check to allow valid requests from completing during
        // React StrictMode effect cleanup/rerun sequences.
        if (attemptId !== fetchAttemptRef.current) return;

        if (!res.ok) throw new Error(`Failed to load routes (${res.status})`);

        const data = await res.json();
        const apiRoutes: Route[] = data.routes ?? [];
        if (apiRoutes.length === 0) throw new Error("No routes returned for this corridor.");

        setRoutes(apiRoutes);
        setAnalyzedAt(data.analyzedAt ?? new Date().toISOString());
        const recommended = apiRoutes.find((r) => r.recommended) ?? apiRoutes[0];
        setSelectedId(recommended.id);
      } catch (err) {
        clearTimeout(timeoutId);
        if (attemptId !== fetchAttemptRef.current) return;
        setFetchError((err as Error).message ?? "Unable to analyze routes.");
      } finally {
        if (attemptId === fetchAttemptRef.current) {
          setFetching(false);
        }
      }
    }

    loadRoutes();
    // Re-runs when:
    //  1. corridorKey changes (different origin/destination/cargoType/vehicleType/urgency/deadline)
    //  2. pendingShipmentHydrated changes from false → true (localStorage restore complete)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corridorKey, pendingShipmentHydrated]);

  const selectedRoute = routes.find((r) => r.id === selectedId) ?? routes[0];

  // ── Dispatch ──────────────────────────────────────────────────────────────
  const handleConfirmDispatch = async () => {
    if (!selectedRoute || dispatching || dispatched) return;

    // Read from ref — always current even after async gaps
    const p = pendingRef.current;
    if (!p) return;

    setDispatching(true);
    const code       = generateShipmentCode();
    const confidence = deriveConfidence(selectedRoute, routes);

    const currentPending: PendingShipment = {
      origin:             p.origin,
      destination:        p.destination,
      vehicleType:        p.vehicleType,
      cargoType:          p.cargoType,
      urgency:            p.urgency,
      deadline:           p.deadline,
      insurance:          p.insurance,
      tempSensitive:      p.tempSensitive,
      originName:         p.originName,
      originAddress:      p.originAddress,
      originLat:          p.originLat,
      originLng:          p.originLng,
      originPlaceId:      p.originPlaceId,
      destinationName:    p.destinationName,
      destinationAddress: p.destinationAddress,
      destinationLat:     p.destinationLat,
      destinationLng:     p.destinationLng,
      destinationPlaceId: p.destinationPlaceId,
      cargoWeightKg:      p.cargoWeightKg,
      cargoVolumeM3:      p.cargoVolumeM3,
      plannedDeparture:   p.plannedDeparture,
      plannedArrival:     p.plannedArrival,
    };

    try {
      const persisted = await dispatchShipment({
        pending: currentPending,
        route: selectedRoute,
        confidencePercent: confidence,
      });

      const finalCode = persisted.shipmentCode || code;
      dispatchedRef.current = true;
      // Clear the request key so a future new shipment with the same corridor
      // parameters will correctly trigger a fresh analysis.
      lastPendingKeyRef.current = "";
      setDispatched(true);
      toast.success("Shipment dispatched", {
        description: `${p.origin} → ${p.destination} · ${finalCode}`,
      });
      setDispatchedShipment({ shipmentCode: finalCode, origin: p.origin, destination: p.destination });
    } catch {
      setDispatchPassData({
        route: selectedRoute,
        shipment: {
          origin: p.origin, destination: p.destination,
          cargoType: p.cargoType, vehicleType: p.vehicleType,
          shipmentCode: code, confidencePercent: confidence,
        },
      });
      setLastDispatchedStub({
        route: selectedRoute,
        shipment: {
          origin: p.origin, destination: p.destination,
          cargoType: p.cargoType, vehicleType: p.vehicleType,
          shipmentCode: code, confidencePercent: confidence,
        },
      });
      toast.error("Dispatch failed", { description: "Unable to create shipment. Please try again." });
    } finally {
      setDispatching(false);
    }
  };

  // ── Render: post-dispatch success ─────────────────────────────────────────
  if (dispatchedShipment) {
    return (
      <DispatchedSuccessState
        shipmentCode={dispatchedShipment.shipmentCode}
        origin={dispatchedShipment.origin}
        destination={dispatchedShipment.destination}
      />
    );
  }

  // ── Render: no valid pending shipment ─────────────────────────────────────
  // Show "No Shipment Configured" if:
  //   - Hydration is complete (pendingShipmentHydrated === true)
  //   - AND there's no pending shipment in state
  //   - AND we're not currently fetching
  // 
  // This ensures we don't flash the empty state during the brief moment between
  // page load and localStorage restore completion.
  if (pendingShipmentHydrated && !state.pendingShipment && !fetching) {
    return (
      <div className="max-w-7xl mx-auto w-full space-y-7 pb-12">
        <PageHeader subtitle="No shipment configured. Create a shipment first to analyze its route." />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.320, 1] }}
          className="flex flex-col items-center justify-center py-24 gap-8 bg-card border border-border/60 rounded-xl"
        >
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.3, type: "spring", stiffness: 100 }}
            className="w-16 h-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center"
          >
            <Navigation className="w-8 h-8 text-primary" />
          </motion.div>
          <div className="text-center max-w-md space-y-3">
            <h2 className="text-2xl font-bold text-foreground">No Shipment Configured</h2>
            <p className="text-sm text-muted-foreground">Create a shipment first to analyze available routes.</p>
          </div>
          <Link href="/create-shipment">
            <Button className="h-11 px-8 font-semibold rounded-lg gap-2">
              Create Shipment <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  // ── Render: route selection (pending shipment exists) ─────────────────────
  const p           = state.pendingShipment;
  const origin      = p?.origin      ?? "";
  const destination = p?.destination ?? "";

  return (
    <div className="max-w-7xl mx-auto w-full space-y-7 pb-12">
      <PageHeader
        subtitle={
          origin && destination
            ? `Comparing analyzed corridors for ${origin} → ${destination}`
            : "Analyzing corridor…"
        }
        showReconfigure={!!p}
      />

      {fetching ? (
        <div className="panel p-12 text-center space-y-3">
          <span className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto block" />
          <p className="text-xs font-semibold text-foreground">Analyzing corridor risk factors…</p>
        </div>
      ) : fetchError ? (
        <div className="panel p-12 text-center space-y-4 border border-dashed border-red-400/40">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm font-bold text-foreground">{fetchError}</p>
          <p className="text-xs text-muted-foreground">Check your network connection or reconfigure the corridor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Routes list */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="label-meta">{routes.length} Available Corridors</span>
              {analyzedAt && !isNaN(new Date(analyzedAt).getTime()) && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  Analyzed at {new Date(analyzedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            <LayoutGroup>
              <div className="space-y-3">
                {routes.map((r) => (
                  <DominantRoute
                    key={r.id} route={r} onSelect={setSelectedId}
                    selected={r.id === selectedId}
                    cargoType={p?.cargoType} urgency={p?.urgency} allRoutes={routes}
                  />
                ))}
              </div>
            </LayoutGroup>

            {selectedRoute && (
              <Button
                onClick={handleConfirmDispatch}
                disabled={dispatching || dispatched}
                className="w-full h-11 text-xs font-bold uppercase tracking-wider bg-primary hover:bg-primary/90 text-primary-foreground gap-2 mt-4 disabled:opacity-60"
              >
                {dispatching ? "Confirming Dispatch…" : dispatched ? "Dispatched ✓" : "Confirm Route & Dispatch"}
                {!dispatching && !dispatched && <ArrowRight className="w-4 h-4" />}
              </Button>
            )}

            {lastDispatchedStub && (
              <div className="pt-2">
                <DispatchedStub route={lastDispatchedStub.route} shipment={lastDispatchedStub.shipment} />
              </div>
            )}
          </div>

          {/* Map view */}
          <div className="lg:col-span-7 space-y-4">
            <div className="panel p-0 overflow-hidden bg-card border border-border h-125">
              {selectedRoute && (
                <RouteMapView
                  route={selectedRoute} routes={routes} status="active"
                  origin={origin} destination={destination}
                />
              )}
            </div>

            {selectedRoute && (
              <div className="panel p-5 bg-card space-y-3">
                <p className="label-meta">Risk Factor Breakdown — {selectedRoute.name}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  {Object.entries(selectedRoute.riskBreakdown).map(([k, v]) => (
                    <div key={k} className="p-3 bg-muted/10 border border-border/40 rounded-lg">
                      <p className="label-meta capitalize mb-1">{k}</p>
                      <p className={cn("font-bold text-sm", breakdownLabelColor(v))}>{v}/100</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {dispatchPassData && (
        <ShipmentPass
          route={dispatchPassData.route}
          shipment={dispatchPassData.shipment}
          onConfirm={() => setDispatchPassData(null)}
        />
      )}
    </div>
  );
}
