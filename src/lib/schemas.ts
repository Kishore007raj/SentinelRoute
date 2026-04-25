import { z } from "zod";

export const CreateShipmentSchema = z.object({
  origin: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  destination: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  deadline: z.string().datetime({ message: "deadline must be a valid ISO 8601 date string" }),
  cargoType: z.enum(["standard", "fragile"]).default("standard"),
});

export const UpdateShipmentSchema = z.object({
  status: z.enum(["pending", "in_transit", "completed"]),
});

export type CreateShipmentInput = z.infer<typeof CreateShipmentSchema>;
export type UpdateShipmentInput = z.infer<typeof UpdateShipmentSchema>;
