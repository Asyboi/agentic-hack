import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { NormalizedRule, Verdict } from "@/lib/schemas/verdict";

export type RuleEngineInput = {
  request: EvaluateRequest;
  normalized_rules: NormalizedRule[];
};

export type RuleEngineResult = {
  matched_rules: string[];
  suggested_decision: Verdict["decision"];
  suggested_risk: Verdict["risk_level"];
  machine_flags: Partial<Verdict["machine_instruction"]>;
};

const RULE_IDS = {
  NO_BOTS: "no_bots",
  NO_AUTOMATED_ACCESS: "no_automated_access",
  NO_BULK: "no_bulk_automated_collection",
  NO_PROFILE_STORAGE: "no_profile_storage_for_commercial_use",
  PII_CONSENT: "personal_data_consent_required",
  COMMERCIAL_REUSE: "commercial_reuse_restricted",
  ROBOTS_DISALLOW: "robots_disallow_path",
  OFFICIAL_API_REQUIRED: "official_api_required",
} as const;

/**
 * Deterministic layer: maps normalized policy rules + action facts → recommendation.
 * LLM still produces citations/reason text; engine constrains verdict when rules match hard.
 */
export function evaluateRules(input: RuleEngineInput): RuleEngineResult {
  const { request, normalized_rules } = input;
  const action = request.intended_action;
  const ruleIds = new Set(normalized_rules.map((r) => r.rule_id));
  const matched: string[] = [];

  const has = (id: string) => ruleIds.has(id) || inferRuleFromAction(id, action, request);

  if (has(RULE_IDS.NO_BOTS) || has(RULE_IDS.NO_AUTOMATED_ACCESS)) {
    matched.push(RULE_IDS.NO_BOTS, RULE_IDS.NO_AUTOMATED_ACCESS);
  }
  if (has(RULE_IDS.NO_BULK) && action.frequency === "bulk") {
    matched.push(RULE_IDS.NO_BULK);
  }
  if (
    (has(RULE_IDS.NO_PROFILE_STORAGE) || action.action_type === "collect_profiles") &&
    action.contains_pii &&
    action.commercial_use
  ) {
    matched.push(RULE_IDS.NO_PROFILE_STORAGE);
  }
  if (action.contains_pii && action.stores_data && action.commercial_use) {
    if (has(RULE_IDS.PII_CONSENT)) matched.push(RULE_IDS.PII_CONSENT);
    if (has(RULE_IDS.COMMERCIAL_REUSE)) matched.push(RULE_IDS.COMMERCIAL_REUSE);
  }
  if (!action.uses_official_api && has(RULE_IDS.OFFICIAL_API_REQUIRED)) {
    matched.push(RULE_IDS.OFFICIAL_API_REQUIRED);
  }

  const criticalBlock =
    matched.includes(RULE_IDS.NO_BULK) ||
    matched.includes(RULE_IDS.NO_PROFILE_STORAGE) ||
    (matched.includes(RULE_IDS.NO_BOTS) && action.action_type === "collect_profiles") ||
    (matched.includes(RULE_IDS.NO_BULK) &&
      action.action_type === "scrape_listing_aggregator");

  const modify =
    matched.includes(RULE_IDS.PII_CONSENT) ||
    matched.includes(RULE_IDS.COMMERCIAL_REUSE) ||
    action.action_type === "store_emails_in_crm";

  if (criticalBlock) {
    return {
      matched_rules: [...new Set(matched)],
      suggested_decision: "blocked",
      suggested_risk: "high",
      machine_flags: {
        proceed: false,
        disable_target_action: true,
        requires_human_review: false,
      },
    };
  }

  if (modify) {
    return {
      matched_rules: [...new Set(matched)],
      suggested_decision: "modify_recommended",
      suggested_risk: "high",
      machine_flags: {
        proceed: false,
        disable_target_action: false,
        requires_human_review: true,
        safe_alternative:
          "Use opt-in collection or a compliant enrichment API with documented consent.",
      },
    };
  }

  if (action.action_type === "read_pricing_page" && !action.contains_pii) {
    return {
      matched_rules: [],
      suggested_decision: "allowed",
      suggested_risk: "low",
      machine_flags: {
        proceed: true,
        disable_target_action: false,
        requires_human_review: false,
      },
    };
  }

  return {
    matched_rules: [...new Set(matched)],
    suggested_decision: matched.length ? "modify_recommended" : "allowed",
    suggested_risk: matched.length ? "medium" : "low",
    machine_flags: {
      proceed: matched.length === 0,
      disable_target_action: false,
      requires_human_review: matched.length > 0,
    },
  };
}

/** Heuristic rules when Senso/LLM normalization not run yet (demo bootstrap) */
function inferRuleFromAction(
  ruleId: string,
  action: EvaluateRequest["intended_action"],
  request: EvaluateRequest
): boolean {
  if (ruleId === RULE_IDS.NO_BOTS && request.target.domain === "linkedin.com") {
    return action.uses_automation;
  }
  if (ruleId === RULE_IDS.NO_BULK) {
    return action.frequency === "bulk" || action.frequency === "daily";
  }
  if (ruleId === RULE_IDS.PII_CONSENT) {
    return action.contains_pii && action.stores_data;
  }
  return false;
}

/** Map Senso/LLM extracted rule labels → canonical rule_ids */
export function normalizeExtractedRules(raw: string[]): NormalizedRule[] {
  const map: Record<string, NormalizedRule> = {
    "no bots": {
      rule_id: RULE_IDS.NO_BOTS,
      category: "automation",
      risk: "critical",
    },
    "no automated access": {
      rule_id: RULE_IDS.NO_AUTOMATED_ACCESS,
      category: "automation",
      risk: "critical",
    },
    "bulk automated collection": {
      rule_id: RULE_IDS.NO_BULK,
      category: "automation",
      risk: "critical",
    },
    "profile storage": {
      rule_id: RULE_IDS.NO_PROFILE_STORAGE,
      category: "data_reuse",
      risk: "high",
    },
    "personal data consent": {
      rule_id: RULE_IDS.PII_CONSENT,
      category: "pii",
      risk: "high",
    },
    "commercial reuse": {
      rule_id: RULE_IDS.COMMERCIAL_REUSE,
      category: "commercial",
      risk: "high",
    },
  };

  return raw
    .map((r) => {
      const key = r.toLowerCase();
      for (const [needle, rule] of Object.entries(map)) {
        if (key.includes(needle)) return rule;
      }
      return {
        rule_id: r.replace(/\s+/g, "_").toLowerCase(),
        category: "automation" as const,
        risk: "medium" as const,
      };
    })
    .filter(Boolean);
}
