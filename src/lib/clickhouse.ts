import { createClient, type ClickHouseClient } from "@clickhouse/client";
import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { Verdict } from "@/lib/schemas/verdict";

let client: ClickHouseClient | null = null;

function getClient(): ClickHouseClient | null {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) return null;

  if (!client) {
    client = createClient({
      url,
      username: process.env.CLICKHOUSE_USER ?? "default",
      password: process.env.CLICKHOUSE_PASSWORD ?? "",
      database: process.env.CLICKHOUSE_DATABASE ?? "policyguard",
    });
  }
  return client;
}

export function isClickHouseConfigured(): boolean {
  return Boolean(process.env.CLICKHOUSE_URL);
}

export async function logDecision(
  request: EvaluateRequest,
  verdict: Verdict
): Promise<void> {
  const ch = getClient();
  const row = {
    decision_id: verdict.decision_id ?? `dec_unknown_${Date.now()}`,
    agent_id: request.agent_id,
    target_name: request.target.name,
    target_domain: request.target.domain ?? "",
    action_type: request.intended_action.action_type,
    decision: verdict.decision,
    risk_level: verdict.risk_level,
    matched_rules: verdict.matched_rules,
    cited_md_url: verdict.cited_md_url ?? "",
    checked_at: verdict.policy_version?.checked_at ?? new Date().toISOString(),
  };

  if (!ch) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[clickhouse:stub]", row);
    }
    return;
  }

  try {
    await ch.insert({
      table: "decisions",
      values: [row],
      format: "JSONEachRow",
    });
  } catch (e) {
    console.warn("[clickhouse] insert failed", e);
  }
}

export async function getDecisionStats(): Promise<{
  configured: boolean;
  total: number;
  blocked: number;
  allowed: number;
  modify_recommended: number;
}> {
  const empty = {
    configured: false,
    total: 0,
    blocked: 0,
    allowed: 0,
    modify_recommended: 0,
  };

  const ch = getClient();
  if (!ch) return empty;

  try {
    const result = await ch.query({
      query: `
        SELECT
          count() AS total,
          countIf(decision = 'blocked') AS blocked,
          countIf(decision = 'allowed') AS allowed,
          countIf(decision = 'modify_recommended') AS modify_recommended
        FROM decisions
      `,
      format: "JSONEachRow",
    });
    const rows = (await result.json()) as Array<{
      total: string;
      blocked: string;
      allowed: string;
      modify_recommended: string;
    }>;
    const r = rows[0];
    if (!r) return { ...empty, configured: true };

    return {
      configured: true,
      total: Number(r.total),
      blocked: Number(r.blocked),
      allowed: Number(r.allowed),
      modify_recommended: Number(r.modify_recommended),
    };
  } catch (e) {
    console.warn("[clickhouse] stats query failed", e);
    return { ...empty, configured: true };
  }
}
