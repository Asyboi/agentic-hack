/**
 * Live Senso path (no fixture shortcuts).
 * Run: npm run test:senso:live
 */
import { loadEnvLocal } from "./load-env-local";
import { DEMO_REQUESTS } from "../src/lib/demo-fixtures";
import { runEvaluatePipeline } from "../src/lib/pipeline";

loadEnvLocal();

const SCENARIOS = [
  { key: "linkedin_scrape" as const, expect: "blocked" },
  { key: "pricing_read" as const, expect: "allowed" },
  { key: "email_crm" as const, expect: "modify_recommended" },
];

async function main() {
  if (process.env.POLICYGUARD_DEMO_MODE === "true") {
    console.error(
      "POLICYGUARD_DEMO_MODE is true — set false in .env for live Senso test"
    );
    process.exit(1);
  }

  console.log("Live Senso test (search context + rules/LLM, no fixtures)\n");
  console.log(`SENSO_API_KEY: ${process.env.SENSO_API_KEY ? "set" : "MISSING"}`);
  console.log(
    `ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? "set" : "(optional — rule fallback)"}\n`
  );

  let failed = 0;

  for (const { key, expect } of SCENARIOS) {
    console.log(`${"=".repeat(60)}\n${key} (expect ${expect})\n${"=".repeat(60)}`);
    const { verdict, meta } = await runEvaluatePipeline(DEMO_REQUESTS[key], {
      skipPublish: process.env.POLICYGUARD_SKIP_PUBLISH === "true",
    });
    console.log(`pipeline: ${meta.mode} (senso chunks: ${meta.senso_chunks})`);
    const ok = verdict.decision === expect;
    console.log(`decision: ${verdict.decision} ${ok ? "✓" : `✗ expected ${expect}`}`);
    console.log(`risk: ${verdict.risk_level}`);
    console.log(`reason: ${verdict.reason.slice(0, 120)}…`);
    console.log(`citation: ${verdict.citation.source_url}`);
    if (!ok) failed++;
  }

  console.log(failed === 0 ? "\nAll scenarios passed.\n" : `\n${failed} mismatch(es).\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
