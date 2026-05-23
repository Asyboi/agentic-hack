/**
 * Fetch policy pages with Nimble and ingest into Senso KB (policies-under-evaluation).
 *
 * Usage:
 *   npm run kb:ingest                    # all targets (~10–15 min)
 *   npm run kb:ingest -- --only linkedin,notion
 *   npm run kb:ingest -- --dry-run
 *   npm run kb:ingest -- --list
 *
 * Writes policy-content-ids.json — used by planner + pipeline for scoped Senso search.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvLocal } from "./load-env-local";
import {
  DEFAULT_POLICIES_FOLDER_NODE_ID,
  listPoliciesFolderChildren,
} from "../src/lib/senso-kb";
import {
  getIngestTarget,
  POLICY_INGEST_TARGETS,
  type PolicyIngestTarget,
} from "../src/lib/policy-ingest-catalog";
import { ingestPolicyTarget } from "../src/lib/policy-ingest";
import type { PolicyContentManifest } from "../src/lib/policy-content-ids";
import { clearPolicyContentManifestCache } from "../src/lib/policy-content-ids";
import { searchPolicy } from "../src/lib/senso";

loadEnvLocal();

const outPath = join(process.cwd(), "policy-content-ids.json");

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const list = process.argv.includes("--list");
  const onlyIdx = process.argv.indexOf("--only");
  const only =
    onlyIdx >= 0 && process.argv[onlyIdx + 1]
      ? process.argv[onlyIdx + 1].split(",").map((s) => s.trim())
      : null;
  return { dryRun, list, only };
}

function selectTargets(only: string[] | null): PolicyIngestTarget[] {
  if (!only?.length) return POLICY_INGEST_TARGETS;
  const targets: PolicyIngestTarget[] = [];
  for (const key of only) {
    const t = getIngestTarget(key);
    if (!t) {
      console.error(`Unknown target "${key}". Use --list for keys.`);
      process.exit(1);
    }
    targets.push(t);
  }
  return targets;
}

async function verifySearch(contentId: string, query: string) {
  const chunks = await searchPolicy(query, contentId, 2);
  console.log(
    `  verify search: ${chunks.length} chunks` +
      (chunks[0] ? ` (top score ${chunks[0].score.toFixed(3)})` : "")
  );
}

async function main() {
  const { dryRun, list, only } = parseArgs();

  if (!process.env.SENSO_API_KEY?.trim()) {
    console.error("Set SENSO_API_KEY in .env.local");
    process.exit(1);
  }
  if (!dryRun && !process.env.NIMBLE_API_KEY?.trim()) {
    console.error("Set NIMBLE_API_KEY in .env.local");
    process.exit(1);
  }

  if (list) {
    console.log("Ingest targets (--only <key>):\n");
    for (const t of POLICY_INGEST_TARGETS) {
      console.log(
        `  ${t.key.padEnd(16)} ${t.domain.padEnd(14)} ${t.existing_content_id ? "update" : "create  "}  ${t.policy_urls.length} url(s)`
      );
    }
    process.exit(0);
  }

  const folderId =
    process.env.SENSO_POLICIES_FOLDER_NODE_ID?.trim() ||
    DEFAULT_POLICIES_FOLDER_NODE_ID;

  console.log("PolicyGuard — Nimble → Senso KB ingest\n");
  console.log(`Folder: policies-under-evaluation (${folderId})`);
  console.log(`Targets: ${selectTargets(only).map((t) => t.key).join(", ")}`);
  if (dryRun) console.log("Mode: DRY RUN (no Senso writes)\n");
  else console.log();

  const existingManifest: PolicyContentManifest | null =
    existsSync(outPath)
      ? (JSON.parse(readFileSync(outPath, "utf8")) as PolicyContentManifest)
      : null;

  const policies: PolicyContentManifest["policies"] = {
    ...(existingManifest?.policies ?? {}),
  };

  const targets = selectTargets(only);

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    console.log(`[${i + 1}/${targets.length}] ${target.key} (${target.domain})`);

    try {
      const result = await ingestPolicyTarget(target, { dryRun });
      console.log(
        `  ${result.updated ? "updated" : "created"} content_id=${result.content_id}`
      );
      console.log(
        `  nimble: ${result.nimble_pages_ok}/${target.policy_urls.length} ok` +
          (result.nimble_errors.length
            ? ` (${result.nimble_errors.length} errors)`
            : "")
      );

      if (!dryRun && result.content_id) {
        policies[target.key] = {
          content_id: result.content_id,
          domain: result.domain,
          title: result.title,
          policy_urls: result.policy_urls,
          updated_at: result.fetched_at,
        };
        await verifySearch(
          result.content_id,
          `automated access ${target.domain}`
        );
      }
    } catch (e) {
      console.error(`  FAILED:`, e instanceof Error ? e.message : e);
      continue;
    }

    console.log();
  }

  if (dryRun) {
    console.log("Dry run complete — no manifest written.");
    return;
  }

  const manifest: PolicyContentManifest = {
    version: 1,
    generated_at: new Date().toISOString(),
    senso_folder_node_id: folderId,
    policies,
  };

  writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf8");
  clearPolicyContentManifestCache();

  console.log(`Wrote ${outPath}`);
  console.log("\nKB contents in folder:");
  const children = await listPoliciesFolderChildren();
  for (const c of children) {
    console.log(`  - ${c.name} (${c.content_id.slice(0, 8)}…)`);
  }
  console.log(
    "\nRestart npm run dev so /api/research uses per-domain content_ids from the manifest."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
