import { randomUUID } from "node:crypto";
import { DEMO_VERDICTS, DEMO_REQUESTS } from "@/lib/demo-fixtures";
import { evaluateRules, normalizeExtractedRules } from "@/lib/rule-engine";
import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { Verdict } from "@/lib/schemas/verdict";
import { searchPolicy } from "@/lib/senso";
import { generateVerdictFromChunks } from "@/lib/verdict-llm";

export type PipelineOptions = {
  demoKey?: keyof typeof DEMO_REQUESTS;
  skipSenso?: boolean;
  skipLlm?: boolean;
};

/**
 * Evaluate pipeline:
 * 1. (optional) Nimble fetch — Kyle wires nimble.ts
 * 2. Senso search context → policy chunks
 * 3. LLM → structured verdict (grounded in chunks)
 * 4. Rule engine → constrain / merge matched_rules
 * 5. (optional) ClickHouse log — clickhouse.ts
 * 6. (optional) Senso publish → cited.md
 */
export async function runEvaluatePipeline(
  request: EvaluateRequest,
  options: PipelineOptions = {}
): Promise<Verdict> {
  const demoMode = process.env.POLICYGUARD_DEMO_MODE === "true";

  if (demoMode && options.demoKey && DEMO_VERDICTS[options.demoKey]) {
    return {
      ...DEMO_VERDICTS[options.demoKey],
      decision_id: `dec_${randomUUID().slice(0, 8)}`,
    };
  }

  const actionDescription =
    request.intended_action.description ??
    `${request.intended_action.action_type} on ${request.target.name}`;

  let chunks: Awaited<ReturnType<typeof searchPolicy>> = [];
  if (!options.skipSenso && request.target.policy_content_id) {
    try {
      chunks = await searchPolicy(
        actionDescription,
        request.target.policy_content_id
      );
    } catch (e) {
      console.warn("[pipeline] Senso search failed, using rule heuristics only", e);
    }
  }

  let verdict: Verdict;

  if (options.skipLlm || chunks.length === 0) {
    const engine = evaluateRules({
      request,
      normalized_rules: normalizeExtractedRules(
        inferRulesFromRequest(request)
      ),
    });
    verdict = heuristicVerdict(request, engine, chunks[0]?.chunk_text);
  } else {
    verdict = await generateVerdictFromChunks(request, chunks);
    const engine = evaluateRules({
      request,
      normalized_rules: normalizeExtractedRules(verdict.matched_rules),
    });
    verdict = {
      ...verdict,
      decision: engine.suggested_decision,
      risk_level: engine.suggested_risk,
      matched_rules: [
        ...new Set([...verdict.matched_rules, ...engine.matched_rules]),
      ],
      machine_instruction: {
        ...verdict.machine_instruction,
        ...engine.machine_flags,
      } as Verdict["machine_instruction"],
    };
  }

  return {
    ...verdict,
    decision_id: verdict.decision_id ?? `dec_${randomUUID().slice(0, 8)}`,
    policy_version: {
      provider: request.target.name,
      checked_at: new Date().toISOString(),
    },
  };
}

function inferRulesFromRequest(request: EvaluateRequest): string[] {
  const rules: string[] = [];
  const a = request.intended_action;
  if (request.target.domain === "linkedin.com" && a.uses_automation) {
    rules.push("no bots", "no automated access");
  }
  if (a.frequency === "bulk") rules.push("bulk automated collection");
  if (a.action_type === "scrape_listing_aggregator") {
    rules.push("bulk automated collection", "commercial reuse");
  }
  if (a.contains_pii && a.commercial_use) {
    rules.push("personal data consent", "commercial reuse");
  }
  return rules;
}

function heuristicVerdict(
  request: EvaluateRequest,
  engine: ReturnType<typeof evaluateRules>,
  quoted?: string
): Verdict {
  return {
    decision: engine.suggested_decision,
    risk_level: engine.suggested_risk,
    reason: `Policy evaluation for ${request.intended_action.action_type} on ${request.target.name}.`,
    matched_rules: engine.matched_rules,
    machine_instruction: {
      proceed: engine.machine_flags.proceed ?? false,
      disable_target_action: engine.machine_flags.disable_target_action ?? false,
      requires_human_review: engine.machine_flags.requires_human_review ?? false,
      safe_alternative: engine.machine_flags.safe_alternative,
    },
    citation: {
      source_url:
        request.target.policy_urls[0] ??
        `https://${request.target.domain ?? "unknown"}`,
      quoted_text: quoted ?? "Policy text unavailable in bootstrap mode.",
      fetched_at: new Date().toISOString(),
    },
  };
}
