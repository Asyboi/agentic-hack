import { DEMO_POLICIES } from "@/lib/demo-fixtures";
import { getPolicyContentId } from "@/lib/policy-content-ids";
import type { PlannedStep } from "@/lib/planner-types";
import type { ResearchRequest } from "@/lib/schemas/research";
import { z } from "zod";
import {
  evaluateRequestSchema,
  type EvaluateRequest,
} from "@/lib/schemas/evaluate-request";
import {
  PM_VENDOR_CATALOG,
  type VendorCatalogEntry,
} from "@/lib/research-fixtures";

export function contentIdFor(
  domain: string,
  fallback?: string
): string | undefined {
  return (
    getPolicyContentId(domain) ??
    getPolicyContentId(domain.replace(/\./g, "_")) ??
    fallback
  );
}

const DEMO_KEY_BY_ACTION: Partial<
  Record<string, PlannedStep["demoKey"]>
> = {
  collect_profiles: "linkedin_scrape",
  read_pricing_page: "pricing_read",
  store_emails_in_crm: "email_crm",
};

/** Guess policy URLs when the planner omits them. */
export function defaultPolicyUrls(domain: string): string[] {
  const d = domain.replace(/^www\./, "");
  return [`https://${d}/terms`, `https://${d}/robots.txt`];
}

/** Claude often returns bare domains or paths — coerce to https URLs for Zod. */
export function normalizePolicyUrls(urls: string[], domain?: string): string[] {
  const out: string[] = [];
  for (const raw of urls) {
    const u = raw.trim();
    if (!u) continue;
    if (/^https?:\/\//i.test(u)) {
      out.push(u);
      continue;
    }
    if (u.startsWith("//")) {
      out.push(`https:${u}`);
      continue;
    }
    if (u.startsWith("/") && domain) {
      out.push(`https://${domain.replace(/^www\./, "")}${u}`);
      continue;
    }
    if (u.includes(".") && !u.includes(" ")) {
      out.push(u.startsWith("www.") ? `https://${u}` : `https://${u}`);
      continue;
    }
  }
  if (out.length === 0 && domain) return defaultPolicyUrls(domain);
  return [...new Set(out)].filter((u) => z.string().url().safeParse(u).success);
}

function stripInvalidContentId(id?: string): string | undefined {
  if (!id?.trim()) return undefined;
  return z.string().uuid().safeParse(id.trim()).success ? id.trim() : undefined;
}

export function enrichPlannedStep(
  input: ResearchRequest,
  raw: {
    label: string;
    kind: "global" | "vendor";
    demo_key?: PlannedStep["demoKey"];
    evaluate: EvaluateRequest;
  }
): PlannedStep {
  const domain = raw.evaluate.target.domain;
  const policy_urls = normalizePolicyUrls(
    raw.evaluate.target.policy_urls ?? [],
    domain
  );

  const resolvedUrls =
    policy_urls.length > 0
      ? policy_urls
      : domain
        ? defaultPolicyUrls(domain)
        : [];

  const targetInput = {
    ...raw.evaluate.target,
    policy_urls: resolvedUrls,
    policy_content_id:
      stripInvalidContentId(raw.evaluate.target.policy_content_id) ??
      (domain
        ? contentIdFor(
            domain,
            domain.includes("linkedin") ? DEMO_POLICIES.linkedin : undefined
          )
        : undefined),
  };

  let parsed = evaluateRequestSchema.safeParse({
    ...raw.evaluate,
    agent_id: input.agent_id,
    target: targetInput,
  });

  if (!parsed.success && domain) {
    parsed = evaluateRequestSchema.safeParse({
      ...raw.evaluate,
      agent_id: input.agent_id,
      target: {
        ...targetInput,
        policy_urls: defaultPolicyUrls(domain),
        policy_content_id: targetInput.policy_content_id,
      },
    });
  }

  if (!parsed.success) {
    throw parsed.error;
  }

  const demoKey =
    raw.demo_key ??
    DEMO_KEY_BY_ACTION[parsed.data.intended_action.action_type];

  return {
    label: raw.label,
    kind: raw.kind,
    evaluate: parsed.data,
    demoKey,
  };
}

export function mergeVendorCatalog(
  llmVendors: VendorCatalogEntry[] | undefined,
  steps: PlannedStep[],
  maxVendors: number
): VendorCatalogEntry[] {
  const byDomain = new Map<string, VendorCatalogEntry>();

  for (const v of PM_VENDOR_CATALOG) {
    byDomain.set(v.domain, v);
  }
  for (const v of llmVendors ?? []) {
    byDomain.set(v.domain, v);
  }

  const vendorDomains = steps
    .filter((s) => s.kind === "vendor" && s.evaluate.target.domain)
    .map((s) => s.evaluate.target.domain!);

  const merged: VendorCatalogEntry[] = [];
  for (const domain of vendorDomains) {
    const catalog = byDomain.get(domain);
    const step = steps.find(
      (s) => s.kind === "vendor" && s.evaluate.target.domain === domain
    );
    if (catalog) {
      merged.push(catalog);
      continue;
    }
    if (!step) continue;
    const name = step.evaluate.target.name;
    const pricingUrl =
      step.evaluate.intended_action.description?.match(/https:\/\/[^\s)]+/)?.[0] ??
      `https://${domain}/pricing`;
    merged.push({
      name,
      domain,
      pricing_url: pricingUrl,
      trial_url: `https://${domain}`,
      price_per_user: "TBD",
      why_startup: `Selected for task: ${step.label}`,
      policy_urls: step.evaluate.target.policy_urls,
    });
  }

  return merged.slice(0, maxVendors);
}
