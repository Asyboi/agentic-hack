/**
 * Smoke-test Nimble Extract with NIMBLE_API_KEY from .env
 * Run: npm run test:nimble
 */
import { fetchPolicyPage } from "../src/lib/nimble";

async function main() {
  const url =
    process.argv[2] ?? "https://www.calm.com/terms";

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
