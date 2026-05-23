/**
 * Smoke-test Nimble Extract with NIMBLE_API_KEY from .env.local
 * Run: npm run test:nimble
 *      npm run test:nimble -- https://www.linkedin.com/legal/user-agreement
 */
import { loadEnvLocal } from "./load-env-local";
import { fetchPolicyPage } from "../src/lib/nimble";

loadEnvLocal();

async function main() {
  if (!process.env.NIMBLE_API_KEY?.trim()) {
    console.error(
      "Missing NIMBLE_API_KEY. Add it to .env.local (see .env.example)"
    );
    process.exit(1);
  }

  const url =
    process.argv[2] ?? "https://www.linkedin.com/legal/user-agreement";

  console.log(`Fetching policy page via Nimble: ${url}\n`);

  const page = await fetchPolicyPage(url);
  console.log(`status: ${page.status_code ?? "?"}`);
  console.log(`fetched: ${page.fetched_at}`);
  console.log(`body length: ${page.body.length} chars`);
  console.log("\n--- preview ---\n");
  console.log(page.body.slice(0, 600));
  console.log("\n--- end preview ---\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
