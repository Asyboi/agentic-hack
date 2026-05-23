import { isLlmPlannerEnabled, planResearchStepsLlm } from "@/lib/planner-llm";
import { planResearchStepsFixed } from "@/lib/planner-fixed";
import type { PlannedStep, ResearchPlan } from "@/lib/planner-types";
import type { ResearchRequest } from "@/lib/schemas/research";

export type { PlannedStep, ResearchPlan } from "@/lib/planner-types";

/**
 * Expand a marketplace task into concrete evaluate steps.
 * POLICYGUARD_PLANNER=llm → Claude plan (falls back to fixed on error).
 * Default: fixed hardcoded PM demo plan.
 */
export async function planResearchSteps(
  input: ResearchRequest
): Promise<ResearchPlan> {
  if (isLlmPlannerEnabled()) {
    return planResearchStepsLlm(input);
  }
  return planResearchStepsFixed(input);
}
