import { fetchPolicyPages, type FetchedPolicy } from "@/lib/nimble";
import type { PolicyIngestTarget } from "@/lib/policy-ingest-catalog";
import {
  createRawInPoliciesFolder,
  resolveKbNodeIdForContent,
  updateRawByKbNodeId,
  waitForContentReady,
} from "@/lib/senso-kb";

export type IngestPolicyResult = {
  key: string;
  domain: string;
  content_id: string;
  title: string;
  policy_urls: string[];
  nimble_pages_ok: number;
  nimble_errors: string[];
  updated: boolean;
  fetched_at: string;
};

export function formatPolicyMarkdown(
  target: PolicyIngestTarget,
  pages: FetchedPolicy[]
): string {
  const okPages = pages.filter((p) => !p.body.startsWith("[nimble"));
  const fetchedAt = new Date().toISOString();

  const sections = okPages.map(
    (p) => `## ${p.url}\n\n_Fetched: ${p.fetched_at}_\n\n${p.body}`
  );

  const errorSection =
    pages.length > okPages.length
      ? `\n\n## Fetch errors\n\n${pages
          .filter((p) => p.body.startsWith("[nimble"))
          .map((p) => `- ${p.url}: ${p.body}`)
          .join("\n")}`
      : "";

  return `# ${target.name} — policy text (Nimble → Senso)

**Domain:** ${target.domain}  
**Ingested:** ${fetchedAt}  
**Source URLs:**
${target.policy_urls.map((u) => `- ${u}`).join("\n")}

---

${sections.join("\n\n---\n\n")}${errorSection}
`;
}

function docTitle(target: PolicyIngestTarget): string {
  return `${target.name} policy — ${target.domain} (Nimble)`;
}

/**
 * Fetch policy URLs via Nimble and create or update a Senso raw KB document.
 */
export async function ingestPolicyTarget(
  target: PolicyIngestTarget,
  options: { dryRun?: boolean; skipWait?: boolean } = {}
): Promise<IngestPolicyResult> {
  const pages = await fetchPolicyPages(target.policy_urls);
  const nimble_errors = pages
    .filter((p) => p.body.startsWith("[nimble"))
    .map((p) => `${p.url}: ${p.body.replace(/^\[nimble [^\]]+\]\s*/, "")}`);
  const nimble_pages_ok = pages.filter(
    (p) => p.body.length > 0 && !p.body.startsWith("[nimble")
  ).length;

  if (nimble_pages_ok === 0) {
    throw new Error(
      `No successful Nimble pages for ${target.key} (${target.policy_urls.join(", ")})`
    );
  }

  const title = docTitle(target);
  const text = formatPolicyMarkdown(target, pages);

  if (options.dryRun) {
    return {
      key: target.key,
      domain: target.domain,
      content_id: target.existing_content_id ?? "(dry-run)",
      title,
      policy_urls: target.policy_urls,
      nimble_pages_ok,
      nimble_errors,
      updated: Boolean(target.existing_content_id),
      fetched_at: new Date().toISOString(),
    };
  }

  let content_id: string;

  if (target.existing_content_id) {
    const kbNodeId = await resolveKbNodeIdForContent(
      target.existing_content_id
    );
    if (kbNodeId) {
      const updated = await updateRawByKbNodeId(kbNodeId, { title, text });
      content_id = updated.content_id;
    } else {
      const created = await createRawInPoliciesFolder({ title, text });
      content_id = created.content_id;
    }
  } else {
    const created = await createRawInPoliciesFolder({ title, text });
    content_id = created.content_id;
  }

  if (!options.skipWait) {
    await waitForContentReady(content_id);
  }

  return {
    key: target.key,
    domain: target.domain,
    content_id,
    title,
    policy_urls: target.policy_urls,
    nimble_pages_ok,
    nimble_errors,
    updated: Boolean(target.existing_content_id),
    fetched_at: new Date().toISOString(),
  };
}
