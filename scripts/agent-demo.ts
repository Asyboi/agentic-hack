/**
 * CLI version of the PolicyGuard autonomous agent.
 *
 * Runs the same logic as POST /api/agent-run, but prints events to stdout.
 * Use this as the stage backup if the live SSE stream fails during the demo.
 *
 *   npm run dev      # in another terminal
 *   npm run agent    # this script
 */
import { runAgent, type AgentEvent } from "../src/lib/agent";

const BASE_URL = process.env.POLICYGUARD_BASE_URL ?? "http://localhost:3000";

const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

function paint(color: keyof typeof COLORS, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function renderEvent(e: AgentEvent): string {
  switch (e.type) {
    case "thought":
      return `${paint("cyan", "[agent]")} ${e.text}`;
    case "action":
      return `${paint("blue", "[tool]")}  ${e.tool}(${JSON.stringify(e.input)})`;
    case "x402_attempt":
      return `${paint("magenta", "[x402]")} ${paint(
        "dim",
        `paying $0.001 toll on Base Sepolia → ${e.url}`
      )}\n        wallet: ${e.wallet}`;
    case "x402_settled":
      return `${paint(
        "magenta",
        "[x402]"
      )} payment ${e.mode === "mock" ? "(mock mode)" : "(live)"} ✓`;
    case "x402_skipped":
      return `${paint("yellow", "[x402]")} skipped: ${e.reason}`;
    case "verdict": {
      const v = e.verdict;
      const badge =
        v.decision === "blocked"
          ? paint("red", "BLOCKED")
          : v.decision === "allowed"
          ? paint("green", "ALLOWED")
          : paint("yellow", "MODIFY_RECOMMENDED");
      const rules = v.matched_rules?.length ? v.matched_rules.join(", ") : "(none)";
      return `${paint(
        "bold",
        "[verdict]"
      )} ${e.scenario} → ${badge}  risk=${v.risk_level}\n          rules: ${rules}\n          reason: ${v.reason}`;
    }
    case "decision":
      return `${paint("bold", "[decide]")} ${e.scenario} → ${e.choice} (${e.reasoning})`;
    case "summary":
      return `\n${paint("bold", "═══ AGENT SUMMARY ═══")}\n${e.text}\n`;
    case "error":
      return `${paint("red", "[error]")} ${e.message}`;
  }
}

async function main() {
  console.log(
    paint("bold", "PolicyGuard Agent") +
      paint("dim", `  →  ${BASE_URL}`) +
      "\n" +
      paint("dim", "─".repeat(60))
  );

  await runAgent(BASE_URL, (event) => {
    console.log(renderEvent(event));
  });

  console.log(paint("dim", "─".repeat(60)));
}

main().catch((e) => {
  console.error(paint("red", "[fatal]"), e);
  process.exit(1);
});
