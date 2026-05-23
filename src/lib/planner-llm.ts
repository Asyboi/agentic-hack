import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import {
  enrichPlannedStep,
  mergeVendorCatalog,
  normalizePolicyUrls,
} from "@/lib/planner-enrich";
import { planResearchStepsFixed } from "@/lib/planner-fixed";
import type { ResearchPlan } from "@/lib/planner-types";
import {
  evaluateRequestSchema,
  evaluateTargetSchema,
  intendedActionSchema,
} from "@/lib/schemas/evaluate-request";
import type { ResearchRequest } from "@/lib/schemas/research";
import { PM_VENDOR_CATALOG } from "@/lib/research-fixtures";

const llmEvaluateSchema = z.object({
  target: evaluateTargetSchema
    .extend({
      policy_urls: z.array(z.string()).default([]),
      policy_content_id: z.string().optional(),
    })
    .omit({ policy_content_id: true })
    .extend({ policy_content_id: z.string().optional() }),
  intended_action: intendedActionSchema,
});

const llmStepSchema = z.object({
  label: z.string().min(3).max(200),
  kind: z.enum(["global", "vendor"]),
  demo_key: z
    .enum(["linkedin_scrape", "pricing_read", "email_crm"])
    .optional(),
  evaluate: llmEvaluateSchema,
});

const llmVendorSchema = z.object({
  name: z.string(),
  domain: z.string(),
  pricing_url: z.string(),
  trial_url: z.string(),
  price_per_user: z.string(),
  why_startup: z.string(),
  policy_urls: z.array(z.string()).min(1),
});

const llmPlanSchema = z.object({
  reasoning: z.string().max(500),
  steps: z.array(llmStepSchema).min(2).max(20),
  vendors: z.array(llmVendorSchema).max(20).optional(),
});

function catalogHint(maxVendors: number): string {
  return PM_VENDOR_CATALOG.slice(0, maxVendors)
    .map(
      (v) =>
        `- ${v.name} (${v.domain}): pricing ${v.pricing_url}, ~${v.price_per_user}`
    )
    .join("\n");
}

function buildPlannerPrompt(input: ResearchRequest): string {
  return `You are the planning module for a marketplace buyer agent. Turn the user's task into a concrete list of web actions to policy-check BEFORE execution.

User task:
${input.task}

Constraints:
- agent_id will be injected later; omit it from evaluate objects
- Propose at most ${input.max_vendors} vendor pricing reads (kind: "vendor")
- Include risky steps the agent might naively try if the task implies them (e.g. LinkedIn scraping, bulk aggregator scrape, CRM email storage)
- Each step must be policy-checkable: include target.name, target.domain (when applicable), policy_urls (terms/privacy/robots URLs), and a specific intended_action
- action_type examples: scrape_listing_aggregator, collect_profiles, read_pricing_page, store_emails_in_crm, scrape_public_page
- Set contains_pii, commercial_use, frequency, stores_data realistically
- policy_content_id: omit (filled server-side from KB manifest)

Optional vendor catalog (you may use these or pick others fitting the task):
${catalogHint(input.max_vendors)}

Return JSON only matching the schema. Order steps in execution order.`;
}

export async function planResearchStepsLlm(
  input: ResearchRequest
): Promise<ResearchPlan> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.warn("[planner-llm] ANTHROPIC_API_KEY missing — using fixed plan");
    return { ...planResearchStepsFixed(input), planner_fallback: true };
  }

  try {
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-20250514"),
      schema: llmPlanSchema,
      prompt: buildPlannerPrompt(input),
    });

    console.info(
      `[planner-llm] ${object.steps.length} steps — ${object.reasoning.slice(0, 120)}…`
    );

    const steps = object.steps.map((s) =>
      enrichPlannedStep(input, {
        label: s.label,
        kind: s.kind,
        demo_key: s.demo_key,
        evaluate: {
          ...s.evaluate,
          agent_id: input.agent_id,
        },
      })
    );

    const vendors = mergeVendorCatalog(
      object.vendors?.map((v) => ({
        ...v,
        pricing_url: normalizePolicyUrls([v.pricing_url], v.domain)[0] ?? v.pricing_url,
        trial_url: normalizePolicyUrls([v.trial_url], v.domain)[0] ?? v.trial_url,
        policy_urls: normalizePolicyUrls(v.policy_urls, v.domain),
      })),
      steps,
      input.max_vendors
    );

    return {
      steps,
      vendors,
      planner_mode: "llm",
    };
  } catch (e) {
    console.warn("[planner-llm] failed, using fixed plan", e);
    return { ...planResearchStepsFixed(input), planner_fallback: true };
  }
}

export function isLlmPlannerEnabled(): boolean {
  const mode = process.env.POLICYGUARD_PLANNER?.trim().toLowerCase();
  return mode === "llm" || mode === "anthropic";
}
