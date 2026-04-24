export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ShipmentStatus = "active" | "at-risk" | "completed" | "pending";
export type RouteLabel = "fastest" | "balanced" | "safest";

export interface Route {
  id: string;
  label: RouteLabel;
  name: string;
  eta: string;
  etaMinutes: number;
  distance: string;
  distanceKm: number;
  riskScore: number;
  riskLevel: RiskLevel;
  recommended: boolean;
  summary: string;
  riskBreakdown: {
    traffic: number;
    weather: number;
    disruption: number;
    cargoSensitivity: number;
  };
  alerts: string[];
}

export interface Shipment {
  id: string;
  shipmentCode: string;
  origin: string;
  destination: string;
  selectedRoute: RouteLabel;
  routeName: string;
  riskScore: number;
  riskLevel: RiskLevel;
  eta: string;
  status: ShipmentStatus;
  lastUpdate: string;
  cargoType: string;
  vehicleType: string;
  distance: string;
  departureTime: string;
  confidencePercent: number;
  predictiveAlert?: string;
}

export interface KPI {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
}

// Routes for Chennai → Bangalore demo
export const demoRoutes: Route[] = [
  {
    id: "route-a",
    label: "fastest",
    name: "Route A — Fastest",
    eta: "4h 20m",
    etaMinutes: 260,
    distance: "347 km",
    distanceKm: 347,
    riskScore: 72,
    riskLevel: "high",
    recommended: false,
    summary: "NH44 expressway via Krishnagiri. Fastest path but elevated risk due to heavy congestion near Hosur and predicted rainfall along NH44 corridor.",
    riskBreakdown: { traffic: 80, weather: 65, disruption: 70, cargoSensitivity: 55 },
    alerts: [
      "Congestion expected near Hosur toll (NH44)",
      "Rain intensity increasing — delay possible",
      "Roadwork may add 22 minutes to arrival",
    ],
  },
  {
    id: "route-b",
    label: "balanced",
    name: "Route B — Balanced",
    eta: "5h 05m",
    etaMinutes: 305,
    distance: "362 km",
    distanceKm: 362,
    riskScore: 37,
    riskLevel: "medium",
    recommended: true,
    summary: "Via Krishnagiri–Dharmapuri bypass. Balanced tradeoff between ETA and risk. Lower disruption probability with good cargo integrity scores.",
    riskBreakdown: { traffic: 40, weather: 30, disruption: 35, cargoSensitivity: 25 },
    alerts: ["Minor congestion possible near Dharmapuri bypass"],
  },
  {
    id: "route-c",
    label: "safest",
    name: "Route C — Safest",
    eta: "6h 10m",
    etaMinutes: 370,
    distance: "398 km",
    distanceKm: 398,
    riskScore: 14,
    riskLevel: "low",
    recommended: false,
    summary: "State highway via Salem–Dharmapuri. Longest path but minimal disruption risk. Ideal for heat-sensitive or high-value cargo.",
    riskBreakdown: { traffic: 15, weather: 10, disruption: 12, cargoSensitivity: 8 },
    alerts: [],
  },
];

export const mockShipments: Shipment[] = [
  {
    id: "shp-001",
    shipmentCode: "SR-2026-0041",
    origin: "Chennai",
    destination: "Bangalore",
    selectedRoute: "balanced",
    routeName: "Route B",
    riskScore: 37,
    riskLevel: "medium",
    eta: "5h 05m",
    status: "active",
    lastUpdate: "12 min ago",
    cargoType: "Electronics",
    vehicleType: "Container Truck",
    distance: "362 km",
    departureTime: "08:30 AM",
    confidencePercent: 82,
    predictiveAlert: "Rain intensity increasing on NH48",
  },
  {
    id: "shp-002",
    shipmentCode: "SR-2026-0039",
    origin: "Bangalore",
    destination: "Hyderabad",
    selectedRoute: "fastest",
    routeName: "Route A",
    riskScore: 68,
    riskLevel: "high",
    eta: "6h 45m",
    status: "at-risk",
    lastUpdate: "3 min ago",
    cargoType: "Pharmaceuticals",
    vehicleType: "Reefer Truck",
    distance: "574 km",
    departureTime: "07:00 AM",
    confidencePercent: 61,
    predictiveAlert: "Congestion expected near urban toll segment",
  },
  {
    id: "shp-003",
    shipmentCode: "SR-2026-0037",
    origin: "Pune",
    destination: "Mumbai",
    selectedRoute: "balanced",
    routeName: "Route B",
    riskScore: 22,
    riskLevel: "low",
    eta: "3h 15m",
    status: "completed",
    lastUpdate: "2 hrs ago",
    cargoType: "Industrial Parts",
    vehicleType: "Mini Truck",
    distance: "148 km",
    departureTime: "06:00 AM",
    confidencePercent: 95,
  },
  {
    id: "shp-004",
    shipmentCode: "SR-2026-0035",
    origin: "Coimbatore",
    destination: "Chennai",
    selectedRoute: "safest",
    routeName: "Route C",
    riskScore: 18,
    riskLevel: "low",
    eta: "5h 30m",
    status: "completed",
    lastUpdate: "5 hrs ago",
    cargoType: "Cold Chain Goods",
    vehicleType: "Reefer Truck",
    distance: "491 km",
    departureTime: "05:30 AM",
    confidencePercent: 91,
  },
  {
    id: "shp-005",
    shipmentCode: "SR-2026-0043",
    origin: "Mumbai",
    destination: "Pune",
    selectedRoute: "balanced",
    routeName: "Route B",
    riskScore: 45,
    riskLevel: "medium",
    eta: "3h 50m",
    status: "active",
    lastUpdate: "8 min ago",
    cargoType: "Electronics",
    vehicleType: "Express Van",
    distance: "156 km",
    departureTime: "09:15 AM",
    confidencePercent: 78,
    predictiveAlert: "Roadwork may add 22 minutes to arrival",
  },
];

export const kpiData: KPI[] = [
  { label: "Total Shipments", value: "247", delta: "+18 this week", deltaPositive: true },
  { label: "Avg Risk Score", value: "31", delta: "-4 vs last week", deltaPositive: true },
  { label: "High-Risk Avoided", value: "43", delta: "+12 this week", deltaPositive: true },
  { label: "Avg ETA Accuracy", value: "94%", delta: "+2% vs target", deltaPositive: true },
];

export const analyticsVolumeData = [
  { week: "W14", shipments: 38, highRisk: 9 },
  { week: "W15", shipments: 42, highRisk: 11 },
  { week: "W16", shipments: 35, highRisk: 7 },
  { week: "W17", shipments: 51, highRisk: 8 },
  { week: "W18", shipments: 47, highRisk: 6 },
  { week: "W19", shipments: 54, highRisk: 7 },
  { week: "W20", shipments: 61, highRisk: 5 },
];

export const analyticsRiskData = [
  { name: "Low (0–30)", value: 38, color: "#10B981" },
  { name: "Medium (31–60)", value: 42, color: "#F59E0B" },
  { name: "High (61–80)", value: 14, color: "#EF4444" },
  { name: "Critical (81+)", value: 6, color: "#DC2626" },
];

export const analyticsEtaRiskData = [
  { route: "Fastest", avgEta: 4.3, avgRisk: 71 },
  { route: "Balanced", avgEta: 5.1, avgRisk: 34 },
  { route: "Safest", avgEta: 6.2, avgRisk: 16 },
];

export const routeCategoryData = [
  { name: "Balanced", value: 52 },
  { name: "Fastest", value: 29 },
  { name: "Safest", value: 19 },
];

export const insightCards = [
  {
    id: "ins-1",
    title: "Safer routes increased travel time by 12% but reduced disruption risk by 35%",
    context: "Across 247 shipments this period, Route C selection correlated with a 35% drop in disruption events.",
    tag: "Route Tradeoff",
    tagColor: "green" as const,
  },
  {
    id: "ins-2",
    title: "Balanced routes produced the lowest combined delay-to-risk ratio this week",
    context: "Route B consistently delivered the best ETA predictability vs. risk exposure ratio across all cargo types.",
    tag: "Decision Pattern",
    tagColor: "blue" as const,
  },
  {
    id: "ins-3",
    title: "High-value cargo shipments were routed more conservatively than standard freight",
    context: "Electronics and Pharmaceutical cargo was routed via Route C in 67% of cases this week.",
    tag: "Cargo Sensitivity",
    tagColor: "amber" as const,
  },
];
