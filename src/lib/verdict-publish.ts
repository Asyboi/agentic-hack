import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { Verdict } from "@/lib/schemas/verdict";
import { publishDecision } from "@/lib/senso";

/** Override with `senso prompts list` — see plans/SENSO_INTEGRATION.md */
export function geoQuestionIdForDemoKey(
  demoKey?: string
): string | undefined {
  if (!demoKey) return undefined;
  const envMap: Record<string, string | undefined> = {
    linkedin_scrape: process.env.SENSO_GEO_PROMPT_LINKEDIN,
    pricing_read: process.env.SENSO_GEO_PROMPT_PRICING,
    email_crm: process.env.SENSO_GEO_PROMPT_EMAIL,
  };
  const id = envMap[demoKey];
  return id && id.length > 0 ? id : undefined;
}

export function formatVerdictMarkdown(
  request: EvaluateRequest,
  verdict: Verdict
): string {
  const action =
    request.intended_action.description ??
    request.intended_action.action_type;
  const rules =
    verdict.matched_rules.length > 0
      ? verdict.matched_rules.map((r) => `- \`${r}\``).join("\n")
      : "- _(none)_";

  return `# PolicyGuard Decision

**Decision ID:** ${verdict.decision_id ?? "n/a"}  
**Target:** ${request.target.name}  
**Action:** ${action}  
**Verdict:** ${verdict.decision.toUpperCase()}  
**Risk:** ${verdict.risk_level}

## Reason

${verdict.reason}

## Matched rules

${rules}

## Machine instruction

- proceed: ${verdict.machine_instruction.proceed}
- disable_target_action: ${verdict.machine_instruction.disable_target_action}
- requires_human_review: ${verdict.machine_instruction.requires_human_review}
${verdict.machine_instruction.safe_alternative ? `- safe_alternative: ${verdict.machine_instruction.safe_alternative}` : ""}

## Citation

> ${verdict.citation.quoted_text}

Source: ${verdict.citation.source_url}  
${verdict.citation.policy_section ? `Section: ${verdict.citation.policy_section}` : ""}  
Fetched: ${verdict.citation.fetched_at}

---
*Powered by Senso.*
`;
}

export async function publishVerdictToCited(
  request: EvaluateRequest,
  verdict: Verdict,
  demoKey?: string
): Promise<string | undefined> {
  const action =
    request.intended_action.description ??
    request.intended_action.action_type;
  const markdown = formatVerdictMarkdown(request, verdict);
  const seoTitle = `PolicyGuard: ${verdict.decision} — ${request.target.name}`;
  const summary = `PolicyGuard ${verdict.decision} for "${action}" on ${request.target.name}. ${verdict.reason}`;

  return publishDecision(markdown, {
    seo_title: seoTitle.slice(0, 120),
    summary: summary.slice(0, 280),
    geo_question_id: geoQuestionIdForDemoKey(demoKey),
  });
}
