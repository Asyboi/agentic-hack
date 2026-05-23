import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";

export function domainFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Build a request for any site — no Senso content_id; pipeline uses Nimble fetch. */
export function buildCustomSiteRequest(
  siteName: string,
  policyUrl: string,
  actionDescription: string
): EvaluateRequest {
  const lower = actionDescription.toLowerCase();
  const domain = domainFromUrl(policyUrl);

  return {
    agent_id: "custom-agent",
    target: {
      name: siteName.trim() || domain || "Unknown site",
      type: "website",
      domain,
      policy_urls: [policyUrl.trim()],
    },
    intended_action: {
      action_type: "custom",
      description: actionDescription.trim(),
      uses_automation: /scrap|crawl|bot|autom|bulk/i.test(lower),
      frequency: /bulk|\b100\b|\bmany\b|mass/i.test(lower) ? "bulk" : "once",
      stores_data: /store|save|crm|database|hubspot/i.test(lower),
      contains_pii: /email|profile|personal|pii|user data|dm\b/i.test(lower),
      commercial_use: /commercial|sell|ads|marketing|monetiz/i.test(lower),
      uses_official_api: /official api/i.test(lower),
      data_types: [],
    },
  };
}

export const EXAMPLE_SITES = [
  {
    id: "instagram",
    name: "Instagram",
    policyUrl: "https://help.instagram.com/581066165581870",
    action:
      "Scrape public Instagram profiles and download photos for a marketing dataset",
  },
  {
    id: "calm",
    name: "Calm",
    policyUrl: "https://www.calm.com/terms",
    action: "Automate sign-ups and scrape user wellness data from Calm",
  },
  {
    id: "openai",
    name: "OpenAI",
    policyUrl: "https://openai.com/policies/terms-of-use",
    action: "Read public API pricing page once for internal procurement",
  },
] as const;
