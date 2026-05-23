/**
 * Smoke-test Nimble search + extract (organizer API guide).
 * Run: npm run test:nimble
 *      npm run test:nimble -- https://www.linkedin.com/legal/user-agreement
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local";
import { fetchPolicyPage, searchWeb } from "../src/lib/nimble";

loadEnvLocal();

async function main() {
  const key = process.env.NIMBLE_API_KEY?.trim();
  if (!key) {
    const envPath = join(process.cwd(), ".env");
    console.error("Missing NIMBLE_API_KEY after loading .env files.\n");
    console.error(`  cwd:      ${process.cwd()}`);
    console.error(`  .env:     ${existsSync(envPath) ? envPath : "(not found)"}`);
    console.error(
      `  .env.local: ${existsSync(join(process.cwd(), ".env.local")) ? "present" : "(not found)"}`
    );
    console.error(
      "\nFix: open .env in this repo, set NIMBLE_API_KEY=your_key on ONE line, save (Cmd+S), rerun."
    );
    console.error(
      "If the key is only in the editor tab but not saved, the terminal will still see an empty value."
    );
    process.exit(1);
  }

  const url =
    process.argv[2] ?? "https://www.linkedin.com/legal/user-agreement";

  console.log("Nimble search: linkedin terms of service bots\n");
  const results = await searchWeb("linkedin terms of service automated bots", 3);
  for (const r of results) {
    console.log(`- ${r.title}\n  ${r.url}\n  ${r.snippet?.slice(0, 120)}…\n`);
  }

  console.log(`\nNimble extract: ${url}\n`);

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
