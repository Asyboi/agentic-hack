/**
 * Demo harness — fires the 3 locked demo scenarios against /api/evaluate.
 * Run: npm run dev (terminal 1) + npm run demo (terminal 2)
 */
import { DEMO_REQUESTS } from "../src/lib/demo-fixtures";

const BASE = process.env.POLICYGUARD_BASE_URL ?? "http://localhost:3000";

const SCENARIOS = [
  { key: "linkedin_scrape", label: "Action 1: LinkedIn scrape → BLOCKED" },
  { key: "pricing_read", label: "Action 2: Pricing read → ALLOWED" },
  { key: "email_crm", label: "Action 3: Email CRM → MODIFY" },
] as const;

async function runScenario(
  key: (typeof SCENARIOS)[number]["key"],
  label: string
) {
  const request = DEMO_REQUESTS[key];
  console.log(`\n${"=".repeat(60)}\n${label}\n${"=".repeat(60)}`);

  const res = await fetch(`${BASE}/api/evaluate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-demo-scenario": key,
    },
    body: JSON.stringify(request),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("FAILED", res.status, json);
    return;
  }

  console.log(JSON.stringify(json, null, 2));
  console.log(
    `\n→ decision: ${json.decision} | risk: ${json.risk_level} | rules: ${json.matched_rules?.join(", ") || "(none)"}`
  );
}

async function main() {
  console.log(`PolicyGuard demo harness → ${BASE}`);
  for (const { key, label } of SCENARIOS) {
    await runScenario(key, label);
  }
  console.log("\nDone. Three verdict types exercised.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
