import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { Verdict } from "@/lib/schemas/verdict";

/**
 * Optional GEO prompt IDs for cited.md publish (`senso prompts list`).
 * Set in env: SENSO_GEO_PROMPT_LINKEDIN, SENSO_GEO_PROMPT_PRICING, SENSO_GEO_PROMPT_EMAIL
 */
export const DEMO_GEO_PROMPT_ENV_KEYS = {
  linkedin_scrape: "SENSO_GEO_PROMPT_LINKEDIN",
  pricing_read: "SENSO_GEO_PROMPT_PRICING",
  email_crm: "SENSO_GEO_PROMPT_EMAIL",
} as const;

/** Pre-loaded Senso content IDs — plans/SENSO_INTEGRATION.md */
export const DEMO_POLICIES = {
  linkedin: "a06ff6b1-a867-4b5f-bc33-aa0be186b6a4",
  openai: "f46f5b14-6286-407f-b09a-abf53a4c53b7",
  stripe_privacy: "43800835-3fce-44e6-b860-c406805b23a8",
} as const;

/** Three demo scenarios for the 3-minute pitch */
export const DEMO_REQUESTS: Record<string, EvaluateRequest> = {
  linkedin_scrape: {
    agent_id: "sales-prospecting-agent",
    target: {
      name: "LinkedIn",
      type: "website",
      domain: "linkedin.com",
      policy_urls: ["https://www.linkedin.com/legal/user-agreement"],
      policy_content_id: DEMO_POLICIES.linkedin,
    },
    intended_action: {
      action_type: "collect_profiles",
      description:
        "Scrape 100 profiles from linkedin.com matching software engineer",
      uses_automation: true,
      frequency: "bulk",
      stores_data: true,
      data_types: ["name", "job_title", "company", "email"],
      contains_pii: true,
      commercial_use: true,
      uses_official_api: false,
    },
  },
  pricing_read: {
    agent_id: "procurement-bot",
    target: {
      name: "OpenAI",
      type: "website",
      domain: "openai.com",
      policy_urls: [
        "https://openai.com/policies/terms-of-use",
        "https://openai.com/robots.txt",
      ],
      policy_content_id: DEMO_POLICIES.openai,
    },
    intended_action: {
      action_type: "read_pricing_page",
      description:
        "Read public pricing pages from openai.com/api/pricing once",
      uses_automation: true,
      frequency: "once",
      stores_data: true,
      data_types: ["product_name", "price"],
      contains_pii: false,
      commercial_use: true,
      uses_official_api: false,
    },
  },
  email_crm: {
    agent_id: "sales-prospecting-agent",
    target: {
      name: "CompanyAboutPages",
      type: "website",
      policy_urls: ["https://stripe.com/privacy"],
      policy_content_id: DEMO_POLICIES.stripe_privacy,
    },
    intended_action: {
      action_type: "store_emails_in_crm",
      description:
        "Extract emails from 50 company about-pages and store in HubSpot",
      uses_automation: true,
      frequency: "bulk",
      stores_data: true,
      data_types: ["email", "name"],
      contains_pii: true,
      commercial_use: true,
      uses_official_api: false,
    },
  },
};

/** Deterministic fixtures when DEMO_MODE=true (no LLM required) */
export const DEMO_VERDICTS: Record<string, Verdict> = {
  linkedin_scrape: {
    decision: "blocked",
    risk_level: "high",
    reason:
      "Automated bulk profile collection and commercial storage of personal data conflicts with platform restrictions on bots and unauthorized automated access.",
    matched_rules: ["no_bots", "no_automated_access", "no_bulk_automated_collection"],
    machine_instruction: {
      proceed: false,
      disable_target_action: true,
      requires_human_review: false,
      safe_alternative: "Use an approved API or licensed data provider.",
    },
    citation: {
      source_url: "https://www.linkedin.com/legal/user-agreement",
      quoted_text:
        "Use bots or other unauthorized automated methods to access the Services...",
      policy_section: "Dos and Don'ts",
      fetched_at: new Date().toISOString(),
    },
    cited_md_url: "https://cited.md/policy-guard-3480/linkedin-scrape-blocked",
  },
  pricing_read: {
    decision: "allowed",
    risk_level: "low",
    reason:
      "Reading public pricing metadata once, without PII, is within typical allowances for public marketing pages.",
    matched_rules: [],
    machine_instruction: {
      proceed: true,
      disable_target_action: false,
      requires_human_review: false,
    },
    citation: {
      source_url: "https://openai.com/policies/terms-of-use",
      quoted_text:
        "No prohibition found for low-volume automated reading of public pricing information.",
      fetched_at: new Date().toISOString(),
    },
    cited_md_url: "https://cited.md/policy-guard-3480/openai-pricing-allowed",
  },
  email_crm: {
    decision: "modify_recommended",
    risk_level: "high",
    reason:
      "Storing extracted emails for commercial outreach requires consent and may restrict automated collection of personal data.",
    matched_rules: [
      "personal_data_consent_required",
      "commercial_reuse_restricted",
    ],
    machine_instruction: {
      proceed: false,
      disable_target_action: false,
      requires_human_review: true,
      safe_alternative:
        "Use opt-in forms or a compliant enrichment API (Clearbit, Apollo).",
    },
    citation: {
      source_url: "https://stripe.com/privacy",
      quoted_text:
        "Personal data may only be used for purposes disclosed at collection, with appropriate consent where required.",
      policy_section: "Personal Data",
      fetched_at: new Date().toISOString(),
    },
    cited_md_url: "https://cited.md/policy-guard-3480/email-crm-modify",
  },
};
