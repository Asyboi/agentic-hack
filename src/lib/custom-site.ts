import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";

export function domainFromUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Canonical ToS URLs for sites we know — overrides whatever URL the LLM picked. */
const KNOWN_TOS: Record<string, string[]> = {
  "airbnb.com": [
    "https://www.airbnb.com/help/article/2855/terms-of-service",
    "https://www.airbnb.com/terms",
  ],
  "linkedin.com": ["https://www.linkedin.com/legal/user-agreement"],
  "twitter.com": ["https://x.com/en/tos"],
  "x.com": ["https://x.com/en/tos"],
  "facebook.com": ["https://www.facebook.com/legal/terms"],
  "instagram.com": ["https://help.instagram.com/581066165581870"],
  "etsy.com": ["https://www.etsy.com/legal/policy/terms-of-use"],
  "reddit.com": ["https://www.redditinc.com/policies/user-agreement"],
  "tiktok.com": ["https://www.tiktok.com/legal/page/us/terms-of-service/en"],
  "shopify.com": ["https://www.shopify.com/legal/terms"],
  "stripe.com": ["https://stripe.com/legal/ssa"],
  "openai.com": ["https://openai.com/policies/terms-of-use"],
  "anthropic.com": ["https://www.anthropic.com/legal/consumer-terms"],
  "google.com": ["https://policies.google.com/terms"],
  "youtube.com": ["https://www.youtube.com/static?template=terms"],
  "github.com": ["https://docs.github.com/en/site-policy/github-terms/github-terms-of-service"],
  "amazon.com": ["https://www.amazon.com/gp/help/customer/display.html?nodeId=508088"],
};

/**
 * If the user (or the agent's LLM) passed a homepage / domain root, try a few
 * common ToS path conventions in addition. Nimble fetches each — pipeline picks
 * the body with usable content.
 */
function expandPolicyUrls(
  policyUrl: string,
  domain: string | undefined
): string[] {
  if (domain && KNOWN_TOS[domain]) {
    return KNOWN_TOS[domain];
  }
  if (!policyUrl) return [];
  let parsed: URL;
  try {
    parsed = new URL(policyUrl);
  } catch {
    return [policyUrl];
  }
  const path = parsed.pathname.replace(/\/$/, "");
  const looksLikeTos = /(terms|tos|legal|user-agreement|policy|privacy)/i.test(
    path
  );
  if (looksLikeTos) return [policyUrl];

  const base = `${parsed.protocol}//${parsed.host}`;
  const candidates = [
    policyUrl,
    `${base}/terms`,
    `${base}/terms-of-service`,
    `${base}/legal/terms`,
    `${base}/legal/user-agreement`,
    `${base}/policies/terms-of-use`,
  ];
  return Array.from(new Set(candidates));
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
      policy_urls: expandPolicyUrls(policyUrl.trim(), domain),
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
