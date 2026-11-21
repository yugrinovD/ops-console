import { z } from "zod";

export const serviceHealthSchema = z.object({
  name: z.string(),
  label: z.string(),
  state: z.enum(["ok", "down", "not_configured"]),
  detail: z.string().optional(),
});

export const healthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  checkedAt: z.string(),
  services: z.array(serviceHealthSchema),
});

export type HealthSnapshot = z.infer<typeof healthSchema>;
export type ServiceHealth = z.infer<typeof serviceHealthSchema>;
