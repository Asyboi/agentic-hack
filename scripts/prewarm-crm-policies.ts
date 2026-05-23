/**
 * Pre-warm CRM policy cache.
 *
 * Run once before the demo:
 *   npx tsx scripts/prewarm-crm-policies.ts
 *
 * Fetches each CRM's privacy/terms page via Nimble, ingests into Senso,
 * and writes the resulting content_id map to scripts/crm-policy-ids.json.
 * The pipeline then reads that file instead of using placeholder Stripe IDs.
 *
 * Requires: NIMBLE_API_KEY and SENSO_API_KEY in env (or ~/.zshrc).
 * Requires: KB_FOLDER_NODE_ID — the Senso folder ID for policy docs.
 *   Get it with: senso kb children <root_id> --output json --quiet
 */

import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchPolicyPage } from "@/lib/nimble";
import { ingestPolicy } from "@/lib/senso";

const KB_FOLDER_NODE_ID =
  process.env.SENSO_KB_FOLDER_ID ??
  (() => {
    throw new Error(
      "Set SENSO_KB_FOLDER_ID env var to the Senso folder node ID for policy docs.\n" +
        "Find it with: senso kb children <root_id> --output json --quiet"
    );
  })();

type CrmTarget = {
  name: string;
  domain: string;
  policyUrl: string;
};

const CRM_TARGETS: CrmTarget[] = [
  {
    name: "HubSpot",
    domain: "hubspot.com",
    policyUrl: "https://legal.hubspot.com/privacy-policy",
  },
  {
    name: "Salesforce",
    domain: "salesforce.com",
    policyUrl: "https://www.salesforce.com/company/privacy/",
  },
  {
    name: "Pipedrive",
    domain: "pipedrive.com",
    policyUrl: "https://www.pipedrive.com/en/privacy",
  },
  {
    name: "Zoho CRM",
    domain: "zoho.com",
    policyUrl: "https://www.zoho.com/privacy.html",
  },
];

async function prewarm(): Promise<void> {
  const output: Record<string, string> = {};

  for (const crm of CRM_TARGETS) {
    process.stdout.write(`[${crm.name}] Fetching ${crm.policyUrl} via Nimble... `);
    let fetched;
    try {
      fetched = await fetchPolicyPage(crm.policyUrl);
    } catch (e) {
      console.error(`FAILED\n  ${e}`);
      continue;
    }
    console.log(`OK (${fetched.body.length} chars)`);

    if (fetched.body.startsWith("[nimble stub]")) {
      console.warn(
        `  WARNING: No NIMBLE_API_KEY set — stub text ingested. ` +
          `Set NIMBLE_API_KEY for real policy content.`
      );
    }

    process.stdout.write(`[${crm.name}] Ingesting into Senso... `);
    try {
      const contentId = await ingestPolicy(
        `${crm.name} Privacy Policy (fetched ${fetched.fetched_at})`,
        fetched.body,
        KB_FOLDER_NODE_ID
      );
      output[crm.domain] = contentId;
      console.log(`OK → content_id: ${contentId}`);
    } catch (e) {
      console.error(`FAILED\n  ${e}`);
    }
  }

  const outPath = resolve(import.meta.dirname ?? __dirname, "crm-policy-ids.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote content IDs to ${outPath}`);
  console.log(JSON.stringify(output, null, 2));
}

prewarm().catch((e) => {
  console.error(e);
  process.exit(1);
});
