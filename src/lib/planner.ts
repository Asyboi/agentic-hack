import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { ResearchRequest } from "@/lib/schemas/research";
import { DEMO_POLICIES } from "@/lib/demo-fixtures";
import {
  AGGREGATOR_TARGET,
  LINKEDIN_TARGET,
  PM_VENDOR_CATALOG,
  type VendorCatalogEntry,
} from "@/lib/research-fixtures";

export type PlannedStep = {
  label: string;
  kind: "global" | "vendor";
  evaluate: EvaluateRequest;
  /** Use canned /evaluate demo fixture when POLICYGUARD_DEMO_MODE=true */
  demoKey?: "linkedin_scrape" | "pricing_read" | "email_crm";
};

function isPmToolsTask(task: string): boolean {
  const t = task.toLowerCase();
  return (
    (t.includes("project") && t.includes("management")) ||
    t.includes("pm tool") ||
    t.includes("project-management")
  );
}

/**
 * Naive planner: expands a marketplace task into concrete evaluate requests.
 * Kyle/Nimble can replace vendor discovery with live search results.
 */
export function planResearchSteps(
  input: ResearchRequest
): { steps: PlannedStep[]; vendors: VendorCatalogEntry[] } {
  const vendors = PM_VENDOR_CATALOG.slice(0, input.max_vendors);
  const steps: PlannedStep[] = [];

  const taskHint = input.task;

  // What a naive agent would try first
  steps.push({
    label: "Scrape G2/Capterra listing pages for tool names",
    kind: "global",
    evaluate: {
      agent_id: input.agent_id,
      target: {
        name: AGGREGATOR_TARGET.name,
        type: "website",
        domain: AGGREGATOR_TARGET.domain,
        policy_urls: AGGREGATOR_TARGET.policy_urls,
      },
      intended_action: {
        action_type: "scrape_listing_aggregator",
        description: `Bulk scrape ${AGGREGATOR_TARGET.domain} listings for: ${taskHint}`,
        uses_automation: true,
        frequency: "bulk",
        stores_data: true,
        data_types: ["product_name", "rating", "review_text"],
        contains_pii: false,
        commercial_use: true,
        uses_official_api: false,
      },
    },
  });

  steps.push({
    label: "Scrape LinkedIn for founder contacts",
    kind: "global",
    demoKey: "linkedin_scrape",
    evaluate: {
      agent_id: input.agent_id,
      target: {
        name: LINKEDIN_TARGET.name,
        type: "website",
        domain: LINKEDIN_TARGET.domain,
        policy_urls: LINKEDIN_TARGET.policy_urls,
        policy_content_id: DEMO_POLICIES.linkedin,
      },
      intended_action: {
        action_type: "collect_profiles",
        description:
          "Collect founder profiles and emails from LinkedIn for vendor outreach",
        uses_automation: true,
        frequency: "bulk",
        stores_data: true,
        data_types: ["name", "job_title", "company", "email"],
        contains_pii: true,
        commercial_use: true,
        uses_official_api: false,
      },
    },
  });

  for (const v of vendors) {
    steps.push({
      label: `Read pricing page: ${v.name}`,
      kind: "vendor",
      demoKey: "pricing_read",
      evaluate: {
        agent_id: input.agent_id,
        target: {
          name: v.name,
          type: "website",
          domain: v.domain,
          policy_urls: v.policy_urls,
          policy_content_id: DEMO_POLICIES.openai,
        },
        intended_action: {
          action_type: "read_pricing_page",
          description: `Read ${v.pricing_url} once for price and trial link`,
          uses_automation: true,
          frequency: "once",
          stores_data: true,
          data_types: ["product_name", "price", "trial_url"],
          contains_pii: false,
          commercial_use: true,
          uses_official_api: false,
        },
      },
    });
  }

  steps.push({
    label: "Store collected emails and contacts in CRM",
    kind: "global",
    demoKey: "email_crm",
    evaluate: {
      agent_id: input.agent_id,
      target: {
        name: "HubSpotCRM",
        type: "saas",
        policy_urls: ["https://stripe.com/privacy"],
        policy_content_id: DEMO_POLICIES.stripe_privacy,
      },
      intended_action: {
        action_type: "store_emails_in_crm",
        description: `Import vendor research and emails into CRM for: ${taskHint}`,
        uses_automation: true,
        frequency: "bulk",
        stores_data: true,
        data_types: ["email", "name", "company"],
        contains_pii: true,
        commercial_use: true,
        uses_official_api: false,
      },
    },
  });

  if (!isPmToolsTask(input.task)) {
    // Still run PM catalog for hackathon demo; flag in summary via orchestrator
  }

  return { steps, vendors };
}
