/**
 * Marketplace demo — one natural-language task → planned actions → policy checks → vendor packet.
 *
 * Usage:
 *   npm run demo:research
 *   npm run demo:research -- "Compare 3 affordable CRMs and email founders on LinkedIn"
 *   npm run demo:research -- --task "Your task here" --max-vendors 3
 *   npm run demo:research -- --full
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.POLICYGUARD_BASE_URL ?? "http://localhost:3000";
const outFile = join(process.cwd(), "research-response.json");

const DEFAULT_TASK =
  "Find 20 project-management tools under $50/user, with current pricing, free-trial links, and a one-line why each fits a 50-person startup. Put everything in our CRM.";

function parseArgs(): {
  task: string;
  maxVendors: number;
  printFull: boolean;
} {
  const argv = process.argv.slice(2);
  const printFull = argv.includes("--full");
  const rest = argv.filter((a) => a !== "--full");

  let maxVendors = 5;
  const taskParts: string[] = [];

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "--max-vendors") {
      const n = Number.parseInt(rest[++i] ?? "", 10);
      if (Number.isFinite(n) && n >= 1) maxVendors = Math.min(n, 20);
      continue;
    }
    if (arg === "--task") {
      while (i + 1 < rest.length && !rest[i + 1].startsWith("--")) {
        taskParts.push(rest[++i]);
      }
      continue;
    }
    if (arg.startsWith("--")) {
      console.warn(`Unknown flag ignored: ${arg}`);
      continue;
    }
    taskParts.push(arg);
  }

  const task = taskParts.join(" ").trim() || DEFAULT_TASK;
  if (task.length < 10) {
    console.error("Task must be at least 10 characters (API validation).");
    process.exit(1);
  }

  return { task, maxVendors, printFull };
}

async function main() {
  const { task, maxVendors, printFull } = parseArgs();
  const usingDefault = task === DEFAULT_TASK;

  console.log("PolicyGuard research demo\n");
  console.log("Task:", task);
  if (usingDefault) {
    console.log("(default PM demo task — pass your own: npm run demo:research -- \"…\")\n");
  } else {
    console.log(`max_vendors: ${maxVendors}\n`);
  }
  console.log(
    "Calling POST /api/research (may take 2–5+ min — watch `npm run dev` for [research] logs)\n"
  );

  const started = Date.now();
  const res = await fetch(`${BASE}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      agent_id: "marketplace-buyer-agent",
      task,
      max_vendors: maxVendors,
    }),
  });

  const json = await res.json();
  console.log(`Request finished in ${((Date.now() - started) / 1000).toFixed(1)}s\n`);
  if (!res.ok) {
    console.error("FAILED", res.status, json);
    process.exit(1);
  }

  console.log("=== SUMMARY ===");
  console.log(json.summary);
  console.log("\n=== STATS ===");
  console.log({
    research_id: json.research_id,
    planner_mode: json.planner_mode,
    planner_fallback: json.planner_fallback,
    sources_checked: json.sources_checked,
    sources_usable: json.sources_usable,
    sources_blocked: json.sources_blocked,
    sources_human_review: json.sources_human_review,
    vendors_collected: json.vendors?.filter((v: { collected: boolean }) => v.collected)
      .length,
  });

  console.log("\n=== PLANNED STEPS ===");
  for (const ev of json.evaluations ?? []) {
    const domain = ev.request?.target?.domain ?? ev.request?.target?.name;
    console.log(
      `- ${ev.label} → ${ev.request?.intended_action?.action_type} @ ${domain} (${ev.verdict?.decision})`
    );
  }

  console.log("\n=== AGGREGATE INSTRUCTIONS (what the buyer agent should do) ===");
  console.log(JSON.stringify(json.machine_instruction_aggregate, null, 2));

  console.log("\n=== VENDORS (pricing collected only if policy allowed) ===");
  for (const v of json.vendors ?? []) {
    console.log(
      `- ${v.name} | ${v.price_per_user} | policy: ${v.policy_status} | collected: ${v.collected}` +
        (v.collection_source ? ` | source: ${v.collection_source}` : "")
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

  writeFileSync(outFile, JSON.stringify(json, null, 2), "utf8");
  console.log(`\nFull API response saved → ${outFile}`);

  if (printFull) {
    console.log("\n=== FULL JSON ===\n");
    console.log(JSON.stringify(json, null, 2));
  } else {
    console.log("Tip: npm run demo:research -- --full   (print entire JSON to terminal)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
