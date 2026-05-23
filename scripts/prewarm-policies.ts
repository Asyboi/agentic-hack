/**
 * Offline prewarm script — fetches policy pages via Nimble and ingests them into Senso.
 * Run: npm run prewarm
 * Run (force re-fetch): npm run prewarm:force
 * Run (dry run): npm run prewarm:dry
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fetchPolicyPage } from "../src/lib/nimble";
import { ingestPolicy, pollUntilReady } from "../src/lib/senso";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const FORCE = process.argv.includes("--force");
const DRY_RUN = process.argv.includes("--dry-run");
const CACHE_DIR = path.join(__dirname, "cache");
const POLICY_IDS_PATH = path.join(__dirname, "policy-ids.json");
const CRM_FIXTURES_PATH = path.join(__dirname, "../src/lib/crm-fixtures.ts");

// ---------------------------------------------------------------------------
// Source list
// ---------------------------------------------------------------------------

const POLICY_SOURCES = [
  // Block-case: review aggregator
  { name: "g2_terms", url: "https://www.g2.com/terms", category: "review_aggregator" },
  { name: "g2_robots", url: "https://www.g2.com/robots.txt", category: "review_aggregator" },

  // Block-case: professional network
  { name: "linkedin", url: "https://www.linkedin.com/legal/user-agreement", category: "professional_network" },

  // Allow-with-limits: PM vendors
  { name: "notion_terms", url: "https://www.notion.so/terms", category: "saas_vendor" },
  { name: "notion_robots", url: "https://www.notion.so/robots.txt", category: "saas_vendor" },
  { name: "asana_terms", url: "https://asana.com/terms", category: "saas_vendor" },
  { name: "asana_robots", url: "https://asana.com/robots.txt", category: "saas_vendor" },
  { name: "trello_terms", url: "https://trello.com/legal/terms", category: "saas_vendor" },
  { name: "trello_robots", url: "https://trello.com/robots.txt", category: "saas_vendor" },
  { name: "clickup_terms", url: "https://clickup.com/terms", category: "saas_vendor" },
  { name: "clickup_robots", url: "https://clickup.com/robots.txt", category: "saas_vendor" },
  { name: "monday_terms", url: "https://monday.com/terms", category: "saas_vendor" },
  { name: "monday_robots", url: "https://monday.com/robots.txt", category: "saas_vendor" },

  // Human-review: PII / CRM stand-in
  { name: "stripe_privacy", url: "https://stripe.com/privacy", category: "pii_policy" },
] as const;

type PolicySource = (typeof POLICY_SOURCES)[number];

// ---------------------------------------------------------------------------
// Sanity check keywords / signals
// ---------------------------------------------------------------------------

const POLICY_KEYWORDS = [
  "terms", "agreement", "policy", "automated", "scraping",
  "consent", "prohibited", "acceptable use", "service", "users",
];
const BOT_BLOCKER_SIGNALS = [
  "please sign in", "enable javascript", "captcha",
  "verify you are human", "access denied", "forbidden",
];
const MIN_KEYWORD_MATCHES = 3;
const MIN_CONTENT_LENGTH = 2000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateEnv(): void {
  const required = ["NIMBLE_API_KEY", "SENSO_API_KEY", "SENSO_KB_FOLDER_ID"];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`\nMissing required environment variable: ${key}\n`);
      process.exit(1);
    }
  }
}

function cachePath(name: string): string {
  return path.join(CACHE_DIR, `${name}.json`);
}

function buildTextWithMetadata(source: PolicySource, content: string, iso: string): string {
  return [
    "## Metadata",
    `- source_name: ${source.name}`,
    `- source_url: ${source.url}`,
    `- category: ${source.category}`,
    `- ingested_at: ${iso}`,
    `- ingestion_path: offline_prewarm`,
    "",
    "---",
    "",
    content,
  ].join("\n");
}

function sanitySummary(name: string, content: string): { pass: boolean; warnings: string[] } {
  const lower = content.toLowerCase();
  const warnings: string[] = [];

  if (content.length < MIN_CONTENT_LENGTH) {
    warnings.push(`length: ${content.length} chars (suspicious if <${MIN_CONTENT_LENGTH})`);
  }

  const matchedKeywords = POLICY_KEYWORDS.filter((kw) => lower.includes(kw));
  if (matchedKeywords.length < MIN_KEYWORD_MATCHES) {
    warnings.push(`matched keywords: ${matchedKeywords.length}/${MIN_KEYWORD_MATCHES} minimum (found: ${matchedKeywords.join(", ") || "none"})`);
  }

  const blockerFound = BOT_BLOCKER_SIGNALS.find((s) => lower.includes(s));
  if (blockerFound) {
    warnings.push(`bot-blocker signal detected: "${blockerFound}"`);
  }

  return { pass: warnings.length === 0, warnings };
}

function writeCrmFixtures(manifest: Record<string, string>, failures: Array<{ name: string; reason: string }>, iso: string): void {
  const successNames = Object.keys(manifest);
  const failureLines = failures.map((f) => `//   - ${f.name}: ${f.reason}`).join("\n");

  const entries = successNames
    .map((name) => `  ${name}: "${manifest[name]}",`)
    .join("\n");

  const content = [
    "// AUTO-GENERATED by scripts/prewarm-policies.ts — do not edit manually.",
    `// Generated: ${iso}`,
    "//",
    `// Successfully ingested (${successNames.length}):`,
    `//   ${successNames.join(", ") || "(none)"}`,
    "//",
    failures.length > 0
      ? `// SKIPPED due to failure (${failures.length}):\n${failureLines}\n//\n// Re-run \`npm run prewarm:force\` after resolving issues to regenerate.`
      : "// No failures.",
    "export const CRM_POLICIES: Record<string, string> = {",
    entries,
    "};",
    "",
  ].join("\n");

  fs.writeFileSync(CRM_FIXTURES_PATH, content, "utf-8");
  console.log(`\n[output] src/lib/crm-fixtures.ts written (${successNames.length} entries)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const startMs = Date.now();

  validateEnv();
  const folderNodeId = process.env.SENSO_KB_FOLDER_ID!;

  if (DRY_RUN) {
    console.log("\n=== DRY RUN — no Nimble/Senso calls, no file writes ===\n");
    const existingIds: Record<string, string> = fs.existsSync(POLICY_IDS_PATH)
      ? JSON.parse(fs.readFileSync(POLICY_IDS_PATH, "utf-8"))
      : {};

    let wouldFetch = 0, wouldUseCache = 0, wouldSkipIngest = 0;
    for (const source of POLICY_SOURCES) {
      const cached = fs.existsSync(cachePath(source.name));
      const alreadyIngested = !!(existingIds[source.name]);
      if (cached && !FORCE) {
        console.log(`  [cache] ${source.name}: would use cached`);
        wouldUseCache++;
      } else {
        console.log(`  [nimble] ${source.name}: would fetch ${source.url}`);
        wouldFetch++;
      }
      if (alreadyIngested && !FORCE) {
        console.log(`  [senso] ${source.name}: would skip ingest (already in manifest)`);
        wouldSkipIngest++;
      } else {
        console.log(`  [senso] ${source.name}: would ingest`);
      }
    }
    console.log(`\nSummary: would fetch ${wouldFetch}, would use ${wouldUseCache} cached, would skip ${wouldSkipIngest} already-ingested`);
    process.exit(0);
  }

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const existingIds: Record<string, string> = fs.existsSync(POLICY_IDS_PATH)
    ? JSON.parse(fs.readFileSync(POLICY_IDS_PATH, "utf-8"))
    : {};

  // -------------------------------------------------------------------------
  // Phase 1: Sequential Nimble fetch
  // -------------------------------------------------------------------------
  console.log(`\n=== Phase 1: Nimble fetch (${POLICY_SOURCES.length} sources) ===\n`);

  type FetchResult = {
    source: PolicySource;
    content: string;
    fromCache: boolean;
    failed: boolean;
    failureReason?: string;
  };

  const fetchResults: FetchResult[] = [];

  for (const source of POLICY_SOURCES) {
    const cp = cachePath(source.name);
    if (!FORCE && fs.existsSync(cp)) {
      const cached = JSON.parse(fs.readFileSync(cp, "utf-8"));
      console.log(`[cache] ${source.name} — using cached (${(cached.content as string).length} chars)`);
      fetchResults.push({ source, content: cached.content as string, fromCache: true, failed: false });
      continue;
    }

    const result = await fetchPolicyPage(source.url);
    fs.writeFileSync(cp, JSON.stringify(result, null, 2), "utf-8");

    if (result.status === "failed") {
      fetchResults.push({ source, content: "", fromCache: false, failed: true, failureReason: result.error ?? "unknown" });
    } else {
      fetchResults.push({ source, content: result.content, fromCache: false, failed: false });
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Parallel Senso ingest
  // -------------------------------------------------------------------------
  const toIngest = fetchResults.filter((r) => !r.failed);
  const hardFailures: Array<{ name: string; url: string; reason: string }> = fetchResults
    .filter((r) => r.failed)
    .map((r) => ({ name: r.source.name, url: r.source.url, reason: r.failureReason! }));

  console.log(`\n=== Phase 2: Senso ingest (${toIngest.length} sources in parallel) ===\n`);

  const manifest: Record<string, string> = {};
  let alreadyInSensoCount = 0;
  let cachedCount = fetchResults.filter((r) => r.fromCache).length;

  const ingestErrors: Array<{ name: string; url: string; reason: string }> = [];

  const iso = new Date().toISOString();

  await Promise.all(
    toIngest.map(async ({ source, content, fromCache }) => {
      if (!FORCE && existingIds[source.name]) {
        console.log(`[senso] ${source.name} — already ingested, skipping`);
        manifest[source.name] = existingIds[source.name];
        alreadyInSensoCount++;
        return;
      }

      try {
        const text = buildTextWithMetadata(source, content, iso);
        const title = `${source.name} @ ${iso}`;
        const contentId = await ingestPolicy(title, text, folderNodeId);
        console.log(`[senso] ${source.name} — ingested, content_id: ${contentId}`);
        await pollUntilReady(contentId);
        console.log(`[senso] ${source.name} — ready`);
        manifest[source.name] = contentId;
      } catch (e: unknown) {
        const reason = e instanceof Error ? e.message : String(e);
        console.error(`[senso] ✗ ${source.name} — ${reason}`);
        if (!fromCache) {
          ingestErrors.push({ name: source.name, url: source.url, reason });
        } else {
          ingestErrors.push({ name: source.name, url: source.url, reason });
        }
      }
    })
  );

  // -------------------------------------------------------------------------
  // Write outputs
  // -------------------------------------------------------------------------
  fs.writeFileSync(POLICY_IDS_PATH, JSON.stringify(manifest, null, 2), "utf-8");
  console.log(`\n[output] scripts/policy-ids.json written (${Object.keys(manifest).length} entries)`);

  const allFailures = [
    ...hardFailures.map((f) => ({ name: f.name, reason: `Nimble: ${f.reason}` })),
    ...ingestErrors.map((f) => ({ name: f.name, reason: `Senso: ${f.reason}` })),
  ];
  writeCrmFixtures(manifest, allFailures, iso);

  // -------------------------------------------------------------------------
  // Content sanity checks
  // -------------------------------------------------------------------------
  console.log("\n=== Content sanity checks ===\n");

  const sanityWarnings: Array<{ name: string; warnings: string[] }> = [];
  for (const { source, content, failed } of fetchResults) {
    if (failed) continue;
    const { pass, warnings } = sanitySummary(source.name, content);
    if (!pass) {
      sanityWarnings.push({ name: source.name, warnings });
      console.warn(`[sanity] ⚠  ${source.name}:`);
      for (const w of warnings) console.warn(`         - ${w}`);
      console.warn(`         Cache: ${cachePath(source.name)}`);
    }
  }
  if (sanityWarnings.length === 0) {
    console.log("[sanity] All sources passed sanity checks.");
  }

  // -------------------------------------------------------------------------
  // Content samples (3 representative sources for manual eyeballing)
  // -------------------------------------------------------------------------
  const sampleNames = ["linkedin", "g2_terms", "notion_terms"];
  console.log("\n=== Content samples (first 300 chars) ===");
  for (const name of sampleNames) {
    const result = fetchResults.find((r) => r.source.name === name && !r.failed);
    if (result) {
      console.log(`\n--- ${name} ---`);
      console.log(result.content.slice(0, 300));
    } else {
      // fallback to first non-failed in same category
      const fallback = fetchResults.find((r) => !r.failed && r.source.name !== name);
      if (fallback) {
        console.log(`\n--- ${name} (FAILED — showing ${fallback.source.name} instead) ---`);
        console.log(fallback.content.slice(0, 300));
      }
    }
  }

  // -------------------------------------------------------------------------
  // Final summary
  // -------------------------------------------------------------------------
  const elapsedMs = Date.now() - startMs;
  const elapsedStr = elapsedMs > 60_000
    ? `${Math.floor(elapsedMs / 60_000)}m ${Math.round((elapsedMs % 60_000) / 1000)}s`
    : `${Math.round(elapsedMs / 1000)}s`;

  const ingestedCount = Object.keys(manifest).length - alreadyInSensoCount;
  const failedCount = hardFailures.length + ingestErrors.length;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Completed in ${elapsedStr}`);
  console.log(`  ingested:       ${ingestedCount}`);
  console.log(`  cached:         ${cachedCount}`);
  console.log(`  already-senso:  ${alreadyInSensoCount}`);
  console.log(`  failed:         ${failedCount}`);
  if (sanityWarnings.length > 0) console.log(`  sanity warnings: ${sanityWarnings.length}`);
  console.log("=".repeat(60));

  if (allFailures.length > 0) {
    console.error("\nFailed sources:");
    const allFailureDetails = [
      ...hardFailures.map((f) => ({ name: f.name, url: f.url, reason: `Nimble: ${f.reason}` })),
      ...ingestErrors.map((f) => ({ name: f.name, url: f.url, reason: `Senso: ${f.reason}` })),
    ];
    for (const f of allFailureDetails) {
      console.error(`  - ${f.name}: ${f.url} (${f.reason})`);
    }
  }

  if (sanityWarnings.length > 0) {
    console.warn("\nSanity warnings (content may be login walls / error pages):");
    for (const { name, warnings } of sanityWarnings) {
      console.warn(`  - ${name}: ${warnings.join("; ")}`);
    }
    console.warn(`  Inspect: cat scripts/cache/{name}.json | jq -r '.content' | head -50`);
  }

  console.log("\n=== policy-ids.json ===");
  console.log(JSON.stringify(manifest, null, 2));

  console.log(
    "\nNEXT STEP: verify src/lib/crm-fixtures.ts looks correct, then restart the dev server."
  );

  if (failedCount > 0) process.exit(1);
  if (sanityWarnings.length > 0) process.exit(2);
  process.exit(0);
}

main().catch((e) => {
  console.error("\nFatal error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
