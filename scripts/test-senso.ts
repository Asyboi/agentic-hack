/**
 * Verify Senso CLI + API key + LinkedIn policy chunks.
 * Usage: npm run test:senso   (reads SENSO_API_KEY from .env.local)
 */
import { loadEnvLocal } from "./load-env-local";
import { searchPolicy } from "../src/lib/senso";
import { runSensoCli, parseSensoJson } from "../src/lib/senso-cli";

loadEnvLocal();

const LINKEDIN_POLICY = "a06ff6b1-a867-4b5f-bc33-aa0be186b6a4";

async function main() {
  const key = process.env.SENSO_API_KEY?.trim();
  if (!key) {
    console.error(
      "Missing SENSO_API_KEY.\n" +
        "  1. Get the Policy Guard org key from Candy (starts with tgr_…)\n" +
        "  2. Add to .env.local:  SENSO_API_KEY=tgr_...\n" +
        "  (Not the MeloMed org key — see plans/SENSO_INTEGRATION.md)"
    );
    process.exit(1);
  }

  console.log("1. senso whoami …");
  const whoami = await runSensoCli(["whoami", "--output", "json", "--quiet"]);
  console.log(parseSensoJson(whoami));

  console.log("\n2. search context (LinkedIn policy) …");
  const chunks = await searchPolicy("scrape LinkedIn profiles", LINKEDIN_POLICY, 3);
  if (chunks.length === 0) {
    console.error("No chunks returned — check content_id / org");
    process.exit(1);
  }
  console.log(
    chunks.map((c) => ({ score: c.score, title: c.title, preview: c.chunk_text.slice(0, 120) }))
  );
  console.log("\nSenso OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
