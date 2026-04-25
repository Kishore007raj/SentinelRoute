/**
 * types.ts — Single source of truth for all shared types.
 */

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ShipmentStatus = "pending" | "in_transit" | "completed";
export type RouteLabel = "fastest" | "balanced" | "safest";

export interface RiskBreakdown {
  traffic: number;
  weather: number;
  disruption: number;
  cargoSensitivity: number;
}

export interface Route {
  id: string;
  label: RouteLabel;
  name: string;
  distanceKm: number;
  durationHours: number;
  riskScore: number;
  riskLevel: RiskLevel;
  recommended: boolean;
  summary: string;
  riskBreakdown: RiskBreakdown;
  alerts: string[];
  routeGeometry?: {
    type: "LineString";
    coordinates: [number, number][]; // [lng, lat]
  };
}

export interface Shipment {
  id: string;
  shipmentId: string;
  userId: string;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  riskScore: number;
  riskLevel: RiskLevel;
  distanceKm: number;
  durationHours: number;
  routeName: string;
  cargoType: string;
  vehicleType: string;
  weatherScore: number;
  routeGeometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  createdAt: string;
  updatedAt: string;
}

export interface PendingShipment {
  origin: string;
  destination: string;
  vehicleType: string;
  cargoType: string;
  urgency: string;
  deadline?: string;
}

export interface AnalyzeRoutesRequest {
  origin: string;
  destination: string;
  cargoType: string;
  vehicleType: string;
  urgency: string;
}

export interface AnalyzeRoutesResponse {
  routes: Route[];
  analyzedAt: string;
}
