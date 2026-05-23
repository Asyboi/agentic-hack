import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { Verdict } from "@/lib/schemas/verdict";

/**
 * ClickHouse logging stub — replace with @clickhouse/client when URL is set.
 * P0: log at least one row per /evaluate for demo analytics.
 */
export async function logDecision(
  request: EvaluateRequest,
  verdict: Verdict
): Promise<void> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[clickhouse:stub]", {
        agent_id: request.agent_id,
        target: request.target.name,
        decision: verdict.decision,
        matched_rules: verdict.matched_rules,
        decision_id: verdict.decision_id,
      });
    }
    return;
  }

  // TODO: INSERT INTO policyguard.decisions ...
  console.info("[clickhouse] would insert", verdict.decision_id);
}
