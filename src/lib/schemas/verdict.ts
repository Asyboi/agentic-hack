import { z } from "zod";

/** Locked schema from plans/HANDOFF.md */
export const verdictSchema = z.object({
  decision: z.enum(["allowed", "blocked", "modify_recommended"]),
  risk_level: z.enum(["low", "medium", "high"]),
  reason: z.string(),
  matched_rules: z.array(z.string()),
  machine_instruction: z.object({
    proceed: z.boolean(),
    disable_target_action: z.boolean(),
    requires_human_review: z.boolean(),
    safe_alternative: z.string().optional(),
  }),
  citation: z.object({
    source_url: z.string().url(),
    quoted_text: z.string(),
    policy_section: z.string().optional(),
    fetched_at: z.string().datetime(),
  }),
  cited_md_url: z.string().url().optional(),
  decision_id: z.string().optional(),
  policy_version: z
    .object({
      provider: z.string(),
      checked_at: z.string().datetime(),
      content_hash: z.string().optional(),
    })
    .optional(),
});

export type Verdict = z.infer<typeof verdictSchema>;

/** Normalized rules extracted from policy text — fed to rule engine */
export const normalizedRuleSchema = z.object({
  rule_id: z.string(),
  category: z.enum([
    "automation",
    "data_reuse",
    "pii",
    "robots",
    "api",
    "commercial",
  ]),
  risk: z.enum(["low", "medium", "high", "critical"]),
  summary: z.string().optional(),
});

export type NormalizedRule = z.infer<typeof normalizedRuleSchema>;
