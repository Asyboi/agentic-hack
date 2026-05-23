/**
 * Verify Senso CLI + API key + LinkedIn policy chunks.
 * Usage: SENSO_API_KEY=tgr_... npm run test:senso
 */
import { searchPolicy } from "../src/lib/senso";
import { runSensoCli, parseSensoJson } from "../src/lib/senso-cli";

const LINKEDIN_POLICY = "a06ff6b1-a867-4b5f-bc33-aa0be186b6a4";

async function main() {
  if (!process.env.SENSO_API_KEY) {
    console.error("Set SENSO_API_KEY (Policy Guard org key from Candy)");
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
