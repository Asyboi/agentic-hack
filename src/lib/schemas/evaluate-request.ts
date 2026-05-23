import { z } from "zod";

export const intendedActionSchema = z.object({
  action_type: z.string(),
  description: z.string().optional(),
  uses_automation: z.boolean().default(true),
  frequency: z
    .enum(["once", "daily", "bulk", "user_initiated_only"])
    .default("once"),
  stores_data: z.boolean().default(false),
  data_types: z.array(z.string()).default([]),
  contains_pii: z.boolean().default(false),
  commercial_use: z.boolean().default(false),
  uses_official_api: z.boolean().default(false),
});

export const evaluateTargetSchema = z.object({
  name: z.string(),
  type: z.enum(["website", "api", "saas"]).default("website"),
  domain: z.string().optional(),
  policy_urls: z.array(z.string().url()).default([]),
  /** Pre-ingested Senso content_id (see plans/SENSO_INTEGRATION.md) */
  policy_content_id: z.string().uuid().optional(),
});

export const evaluateRequestSchema = z.object({
  agent_id: z.string(),
  target: evaluateTargetSchema,
  intended_action: intendedActionSchema,
});

export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;
export type IntendedAction = z.infer<typeof intendedActionSchema>;
