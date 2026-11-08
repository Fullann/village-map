import { z } from "zod";

export const HalloweenSchema = z.object({
  is_distributing: z.boolean(),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  is_self_service: z.boolean(),
  is_accessible_step_free: z.boolean().default(true),
  photo_url: z.string().url().or(z.string().startsWith("/")).optional(),
  access_instructions: z.string().max(280).optional(),
});

export const AdventApplicationSchema = z.object({
  requested_day: z.coerce.number().int().min(1).max(24),
  participation_type: z.enum(["window_only", "hospitality"]),
  activity_label: z.string().trim().min(2).max(120),
  lighting_time: z.string().regex(/^\d{2}:\d{2}$/),
  event_start_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  event_end_time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hospitality_details: z.string().max(350).optional(),
  is_accessible_step_free: z.boolean().default(true),
  photo_url: z.string().url().or(z.string().startsWith("/")).optional(),
});
