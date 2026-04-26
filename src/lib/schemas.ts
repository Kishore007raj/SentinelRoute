/**
 * schemas.ts — Zod validation schemas for SentinelRoute API routes.
 * Aligned with the canonical types in types.ts.
 */

import { z } from "zod";

export const CreateShipmentSchema = z.object({
  origin:      z.string().min(1),
  destination: z.string().min(1),
  vehicleType: z.string().min(1),
  cargoType:   z.string().min(1),
  urgency:     z.string().min(1),
  routeId:     z.string().min(1),
  routeName:   z.string().min(1),
  riskScore:   z.number().finite(),
  riskLevel:   z.enum(["low", "medium", "high", "critical"]),
  eta:         z.string().min(1),
  distance:    z.string().min(1),
  confidencePercent: z.number().finite(),
  predictiveAlert:   z.string().optional(),
  riskBreakdown: z.object({
    traffic:          z.number(),
    weather:          z.number(),
    disruption:       z.number(),
    cargoSensitivity: z.number(),
  }).optional(),
});

export const UpdateShipmentSchema = z.object({
  status: z.enum(["active", "at-risk", "completed"]),
});

export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof UpdateShipmentSchema>;
