/**
 * Marketplace demo — one natural-language task → planned actions → policy checks → vendor packet.
 */
const BASE = process.env.POLICYGUARD_BASE_URL ?? "http://localhost:3000";

const PM_TASK =
  "Find 20 project-management tools under $50/user, with current pricing, free-trial links, and a one-line why each fits a 50-person startup. Put everything in our CRM.";

async function main() {
  console.log("PolicyGuard research demo\n");
  console.log("Task:", PM_TASK, "\n");

  const res = await fetch(`${BASE}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: "marketplace-buyer-agent",
      task: PM_TASK,
      max_vendors: 5,
    }),
  });

  const json = await res.json();
  if (!res.ok) {
    console.error("FAILED", res.status, json);
    process.exit(1);
  }

  console.log("=== SUMMARY ===");
  console.log(json.summary);
  console.log("\n=== STATS ===");
  console.log({
    research_id: json.research_id,
    sources_checked: json.sources_checked,
    sources_usable: json.sources_usable,
    sources_blocked: json.sources_blocked,
    sources_human_review: json.sources_human_review,
    vendors_collected: json.vendors?.filter((v: { collected: boolean }) => v.collected)
      .length,
  });

  console.log("\n=== AGGREGATE INSTRUCTIONS (what the buyer agent should do) ===");
  console.log(JSON.stringify(json.machine_instruction_aggregate, null, 2));

  console.log("\n=== VENDORS (pricing collected only if policy allowed) ===");
  for (const v of json.vendors ?? []) {
    console.log(
      `- ${v.name} | ${v.price_per_user} | policy: ${v.policy_status} | collected: ${v.collected}`
    );
  }

  console.log("\n=== POLICY MAP (sample — first 4 steps) ===");
  for (const entry of (json.source_policy_map ?? []).slice(0, 4)) {
    console.log(
      `  ${entry.domain} / ${entry.action_type} → ${entry.decision} (${entry.risk_level})`
    );
  }

  console.log("\n=== CRM STEP ===");
  console.log(json.crm_step);

  console.log("\n(Full JSON in research-response.json — run from repo root)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
