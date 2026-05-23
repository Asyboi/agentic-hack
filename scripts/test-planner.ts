/**
 * Print planned research steps without running /api/research.
 * Usage: npm run test:planner
 *        npm run test:planner -- "Find CRM tools under $30/user"
 */
import { loadEnvLocal } from "./load-env-local";
import { planResearchSteps } from "../src/lib/planner";

loadEnvLocal();

const task =
  process.argv.slice(2).join(" ").trim() ||
  "Find 20 project-management tools under $50/user, with current pricing, free-trial links, and a one-line why each fits a 50-person startup. Put everything in our CRM.";

async function main() {
  const plan = await planResearchSteps({
    agent_id: "test-planner",
    task,
    max_vendors: 5,
  });

  console.log("Planner:", plan.planner_mode, plan.planner_fallback ? "(fallback)" : "");
  console.log("Task:", task, "\n");
  for (let i = 0; i < plan.steps.length; i++) {
    const s = plan.steps[i];
    console.log(
      `${i + 1}. [${s.kind}] ${s.label}\n` +
        `   ${s.evaluate.intended_action.action_type} → ${s.evaluate.target.name}` +
        (s.evaluate.target.domain ? ` (${s.evaluate.target.domain})` : "")
    );
  }
  console.log(`\nVendors in packet: ${plan.vendors.map((v) => v.name).join(", ") || "(none)"}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
