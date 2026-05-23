import { randomUUID } from "node:crypto";
import { logDecision } from "@/lib/clickhouse";
import { planResearchSteps, type PlannedStep } from "@/lib/planner";
import { runEvaluatePipeline } from "@/lib/pipeline";
import type { ResearchRequest, ResearchResult } from "@/lib/schemas/research";
import type { Verdict } from "@/lib/schemas/verdict";
import type { VendorCatalogEntry } from "@/lib/research-fixtures";

function countByDecision(verdicts: Verdict[]) {
  return {
    usable: verdicts.filter((v) => v.decision === "allowed").length,
    blocked: verdicts.filter((v) => v.decision === "blocked").length,
    human_review: verdicts.filter(
      (v) =>
        v.decision === "modify_recommended" ||
        v.machine_instruction.requires_human_review
    ).length,
  };
}

function buildSourcePolicyMap(
  steps: PlannedStep[],
  verdicts: Verdict[]
): ResearchResult["source_policy_map"] {
  return steps.map((step, i) => {
    const v = verdicts[i];
    const domain =
      step.evaluate.target.domain ??
      step.evaluate.target.name.toLowerCase().replace(/\s+/g, "-");
    const allowed: string[] = [];
    const disallowed: string[] = [];

    if (v.decision === "allowed" && v.machine_instruction.proceed) {
      allowed.push(step.evaluate.intended_action.action_type);
    } else {
      disallowed.push(step.evaluate.intended_action.action_type);
    }

    return {
      domain,
      action_type: step.evaluate.intended_action.action_type,
      decision: v.decision,
      risk_level: v.risk_level,
      allowed_actions: allowed,
      disallowed_actions: disallowed,
      decision_id: v.decision_id,
    };
  });
}

function buildVendors(
  vendors: VendorCatalogEntry[],
  steps: PlannedStep[],
  verdicts: Verdict[]
): ResearchResult["vendors"] {
  const results: ResearchResult["vendors"] = [];

  for (const v of vendors) {
    const idx = steps.findIndex(
      (s) => s.kind === "vendor" && s.evaluate.target.domain === v.domain
    );
    if (idx === -1) continue;
    const verdict = verdicts[idx];
    const allowed =
      verdict.decision === "allowed" && verdict.machine_instruction.proceed;

    results.push({
      name: v.name,
      price_per_user: v.price_per_user,
      trial_url: v.trial_url,
      pricing_url: v.pricing_url,
      why_startup: v.why_startup,
      policy_status: verdict.decision,
      collected: allowed,
      source_evidence: allowed
        ? `Collected from ${v.pricing_url} after policy check ${verdict.decision_id}`
        : undefined,
    });
  }

  return results;
}

/**
 * Layer A orchestrator: task → planned actions → /evaluate loop → aggregate packet.
 */
export async function runResearchOrchestrator(
  input: ResearchRequest
): Promise<ResearchResult> {
  const research_id = `res_${randomUUID().slice(0, 8)}`;
  const plan = await planResearchSteps(input);
  const { steps, vendors, planner_mode, planner_fallback } = plan;

  console.info(
    `[research] planner=${planner_mode}${planner_fallback ? " (fallback)" : ""} → ${steps.length} steps, ${vendors.length} vendors`
  );

  const evaluations: ResearchResult["evaluations"] = [];
  const verdicts: Verdict[] = [];

  const demoMode = process.env.POLICYGUARD_DEMO_MODE === "true";
  const skipLlm = !process.env.ANTHROPIC_API_KEY?.trim();
  const skipPublish =
    process.env.POLICYGUARD_RESEARCH_SKIP_PUBLISH !== "false";

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.info(
      `[research] step ${i + 1}/${steps.length}: ${step.label} (live=${!demoMode})`
    );
    const { verdict, meta } = await runEvaluatePipeline(step.evaluate, {
      demoKey: demoMode ? step.demoKey : undefined,
      skipPublish,
      skipLlm,
    });
    console.info(
      `[research]   → ${verdict.decision} | pipeline=${meta.mode} | nimble=${meta.nimble_pages_fetched} | senso_chunks=${meta.senso_chunks}`
    );
    verdicts.push(verdict);
    evaluations.push({
      label: step.label,
      request: step.evaluate,
      verdict,
      pipeline_meta: meta,
    });
    await logDecision(step.evaluate, verdict);
  }

  const counts = countByDecision(verdicts);
  const source_policy_map = buildSourcePolicyMap(steps, verdicts);
  const vendorResults = buildVendors(vendors, steps, verdicts);

  const crmEval = evaluations.find((e) =>
    e.request.intended_action.action_type.includes("crm")
  );
  const linkedinBlocked = evaluations.some(
    (e) =>
      e.request.target.domain === "linkedin.com" &&
      e.verdict.decision === "blocked"
  );
  const aggregatorBlocked = evaluations.some(
    (e) =>
      e.request.intended_action.action_type === "scrape_listing_aggregator" &&
      e.verdict.decision !== "allowed"
  );

  const collectedCount = vendorResults.filter((v) => v.collected).length;

  return {
    research_id,
    task: input.task,
    planner_mode,
    planner_fallback,
    status: collectedCount > 0 ? "completed" : "partial",
    summary: `Checked ${steps.length} planned actions (${planner_mode} planner${planner_fallback ? ", fixed fallback" : ""}) across ${vendors.length} vendor domains. Collected pricing for ${collectedCount} vendors. Blocked risky steps (LinkedIn: ${linkedinBlocked ? "yes" : "no"}, aggregator: ${aggregatorBlocked ? "yes" : "no"}). CRM import requires human review.`,
    sources_discovered: steps.length,
    sources_checked: steps.length,
    sources_usable: counts.usable,
    sources_blocked: counts.blocked,
    sources_human_review: counts.human_review,
    planned_actions_count: steps.length,
    evaluations,
    source_policy_map,
    vendors: vendorResults,
    crm_step: crmEval
      ? {
          decision: crmEval.verdict.decision,
          requires_human_review:
            crmEval.verdict.machine_instruction.requires_human_review,
          reason: crmEval.verdict.reason,
        }
      : undefined,
    machine_instruction_aggregate: {
      proceed_with_vendor_collection: collectedCount > 0,
      disable_linkedin_scraping: linkedinBlocked,
      disable_aggregator_scrape: aggregatorBlocked,
      disable_email_crm_without_review:
        crmEval?.verdict.machine_instruction.requires_human_review ?? true,
      requires_human_review:
        crmEval?.verdict.machine_instruction.requires_human_review ?? false,
    },
  };
}
