/**
 * Fetch a URL via Nimble and save markdown + print policy-relevant excerpts.
 * Usage: npm run nimble:sample
 *        npm run nimble:sample -- https://www.notion.so/terms
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local";
import { fetchPolicyPage } from "../src/lib/nimble";

loadEnvLocal();

const KEYWORDS = [
  "bot",
  "automated",
  "scrape",
  "crawl",
  "scraping",
  "spider",
  "unauthorized",
];

async function main() {
  const url =
    process.argv[2] ?? "https://www.linkedin.com/legal/user-agreement";
  const page = await fetchPolicyPage(url);

  const dir = join(process.cwd(), "nimble-samples");
  mkdirSync(dir, { recursive: true });
  const slug = url.replace(/https?:\/\//, "").replace(/[^\w.-]+/g, "_");
  const outPath = join(dir, `${slug}.md`);
  writeFileSync(outPath, page.body, "utf8");

  const lines = page.body.split("\n");
  const hits = lines.filter((l) =>
    KEYWORDS.some((k) => l.toLowerCase().includes(k))
  );

  console.log(`URL: ${url}`);
  console.log(`Status: ${page.status_code ?? "?"}`);
  console.log(`Length: ${page.body.length} chars`);
  console.log(`Saved: ${outPath}\n`);
  console.log(`=== Excerpts (lines with ${KEYWORDS.join(", ")}) ===\n`);
  for (const line of hits.slice(0, 30)) {
    const t = line.trim();
    if (t) console.log(t.slice(0, 240));
  }
  console.log(`\n(${hits.length} matching lines total — open file for full text)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
