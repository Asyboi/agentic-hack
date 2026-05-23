import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEMO_POLICIES } from "@/lib/demo-fixtures";

export type PolicyContentManifest = {
  version: 1;
  generated_at: string;
  senso_folder_node_id: string;
  policies: Record<
    string,
    {
      content_id: string;
      domain: string;
      title: string;
      policy_urls: string[];
      updated_at: string;
    }
  >;
};

const MANIFEST_PATH = join(process.cwd(), "policy-content-ids.json");

let cached: PolicyContentManifest | null | undefined;

export function getPolicyContentManifestPath(): string {
  return MANIFEST_PATH;
}

export function loadPolicyContentManifest(): PolicyContentManifest | null {
  if (cached !== undefined) return cached;
  if (!existsSync(MANIFEST_PATH)) {
    cached = null;
    return null;
  }
  try {
    cached = JSON.parse(
      readFileSync(MANIFEST_PATH, "utf8")
    ) as PolicyContentManifest;
    return cached;
  } catch {
    cached = null;
    return null;
  }
}

/** Resolve Senso content_id: manifest by domain/key → legacy demo fixtures. */
export function getPolicyContentId(
  domainOrKey: string
): string | undefined {
  const manifest = loadPolicyContentManifest();
  if (manifest?.policies[domainOrKey]) {
    return manifest.policies[domainOrKey].content_id;
  }

  const byDomain = manifest
    ? Object.values(manifest.policies).find((p) => p.domain === domainOrKey)
    : undefined;
  if (byDomain) return byDomain.content_id;

  const legacy: Record<string, string> = {
    linkedin: DEMO_POLICIES.linkedin,
    "linkedin.com": DEMO_POLICIES.linkedin,
    stripe_privacy: DEMO_POLICIES.stripe_privacy,
    "stripe.com": DEMO_POLICIES.stripe_privacy,
    openai: DEMO_POLICIES.openai,
  };

  return legacy[domainOrKey];
}

export function clearPolicyContentManifestCache(): void {
  cached = undefined;
}
