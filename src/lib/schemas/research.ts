import { z } from "zod";
import { evaluateRequestSchema } from "@/lib/schemas/evaluate-request";
import { verdictSchema } from "@/lib/schemas/verdict";

export const researchRequestSchema = z.object({
  agent_id: z.string(),
  task: z.string().min(10),
  /** Max vendor domains to evaluate (demo catalog caps at 5) */
  max_vendors: z.number().int().min(1).max(20).default(5),
});

export const vendorResultSchema = z.object({
  name: z.string(),
  price_per_user: z.string(),
  trial_url: z.string().url(),
  pricing_url: z.string().url(),
  why_startup: z.string(),
  policy_status: z.enum(["allowed", "blocked", "modify_recommended"]),
  collected: z.boolean(),
  source_evidence: z.string().optional(),
  collection_source: z
    .enum(["catalog", "nimble_heuristic", "nimble_llm", "catalog_fallback"])
    .optional(),
});

export const sourcePolicyEntrySchema = z.object({
  domain: z.string(),
  action_type: z.string(),
  decision: verdictSchema.shape.decision,
  risk_level: verdictSchema.shape.risk_level,
  allowed_actions: z.array(z.string()),
  disallowed_actions: z.array(z.string()),
  decision_id: z.string().optional(),
});

export const researchResultSchema = z.object({
  research_id: z.string(),
  task: z.string(),
  planner_mode: z.enum(["fixed", "llm"]).optional(),
  planner_fallback: z.boolean().optional(),
  status: z.enum(["completed", "partial"]),
  summary: z.string(),
  sources_discovered: z.number(),
  sources_checked: z.number(),
  sources_usable: z.number(),
  sources_blocked: z.number(),
  sources_human_review: z.number(),
  planned_actions_count: z.number(),
  evaluations: z.array(
    z.object({
      label: z.string(),
      request: evaluateRequestSchema,
      verdict: verdictSchema,
      pipeline_meta: z
        .object({
          mode: z.string(),
          demo_mode: z.boolean(),
          nimble_pages_fetched: z.number(),
          nimble_errors: z.array(z.string()).optional(),
          senso_chunks: z.number(),
        })
        .optional(),
    })
  ),
  source_policy_map: z.array(sourcePolicyEntrySchema),
  vendors: z.array(vendorResultSchema),
  crm_step: z
    .object({
      decision: verdictSchema.shape.decision,
      requires_human_review: z.boolean(),
      reason: z.string(),
    })
    .optional(),
  machine_instruction_aggregate: z.object({
    proceed_with_vendor_collection: z.boolean(),
    disable_linkedin_scraping: z.boolean(),
    disable_aggregator_scrape: z.boolean(),
    disable_email_crm_without_review: z.boolean(),
    requires_human_review: z.boolean(),
  }),
});

export type ResearchRequest = z.infer<typeof researchRequestSchema>;
export type ResearchResult = z.infer<typeof researchResultSchema>;
