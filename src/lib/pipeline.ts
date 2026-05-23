import { randomUUID } from "node:crypto";
import { DEMO_VERDICTS, DEMO_REQUESTS } from "@/lib/demo-fixtures";
import { evaluateRules, normalizeExtractedRules } from "@/lib/rule-engine";
import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { Verdict } from "@/lib/schemas/verdict";
import { searchPolicy } from "@/lib/senso";
import { generateVerdictFromChunks } from "@/lib/verdict-llm";
import { publishVerdictToCited } from "@/lib/verdict-publish";

export type PipelineOptions = {
  demoKey?: keyof typeof DEMO_REQUESTS;
  skipSenso?: boolean;
  skipLlm?: boolean;
  skipPublish?: boolean;
};

/**
 * Evaluate pipeline:
 * 1. (optional) Nimble fetch — Aslan wires nimble.ts
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
    const fixture = {
      ...DEMO_VERDICTS[options.demoKey],
      decision_id: `dec_${randomUUID().slice(0, 8)}`,
    };
    return finalizeVerdict(request, fixture, options);
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
    const engineFromRequest = evaluateRules({
      request,
      normalized_rules: normalizeExtractedRules(
        inferRulesFromRequest(request)
      ),
    });
    try {
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
    } catch (e) {
      console.warn(
        "[pipeline] LLM verdict failed, using Senso chunks + rule engine",
        e
      );
      verdict = heuristicVerdict(
        request,
        engineFromRequest,
        chunks[0]?.chunk_text
      );
    }
  }

  const withMeta: Verdict = {
    ...verdict,
    decision_id: verdict.decision_id ?? `dec_${randomUUID().slice(0, 8)}`,
    policy_version: {
      provider: request.target.name,
      checked_at: new Date().toISOString(),
    },
  };

  return finalizeVerdict(request, withMeta, options);
}

async function finalizeVerdict(
  request: EvaluateRequest,
  verdict: Verdict,
  options: PipelineOptions
): Promise<Verdict> {
  const skipPublish =
    options.skipPublish || process.env.POLICYGUARD_SKIP_PUBLISH === "true";

  if (skipPublish || !process.env.SENSO_API_KEY) {
    return verdict;
  }

  try {
    const url = await publishVerdictToCited(
      request,
      verdict,
      options.demoKey
    );
    if (url) {
      return { ...verdict, cited_md_url: url };
    }
  } catch (e) {
    console.warn("[pipeline] Senso publish failed", e);
  }

  return verdict;
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
