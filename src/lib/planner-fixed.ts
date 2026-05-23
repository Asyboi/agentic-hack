import type { ResearchRequest } from "@/lib/schemas/research";
import { DEMO_POLICIES } from "@/lib/demo-fixtures";
import { contentIdFor, enrichPlannedStep } from "@/lib/planner-enrich";
import type { ResearchPlan } from "@/lib/planner-types";
import {
  AGGREGATOR_TARGET,
  LINKEDIN_TARGET,
  PM_VENDOR_CATALOG,
} from "@/lib/research-fixtures";

/**
 * Hardcoded PM marketplace plan (reliable for demos and fallback).
 */
export function planResearchStepsFixed(input: ResearchRequest): ResearchPlan {
  const vendors = PM_VENDOR_CATALOG.slice(0, input.max_vendors);
  const taskHint = input.task;
  const steps: ResearchPlan["steps"] = [];

  steps.push(
    enrichPlannedStep(input, {
      label: "Scrape G2/Capterra listing pages for tool names",
      kind: "global",
      evaluate: {
        agent_id: input.agent_id,
        target: {
          name: AGGREGATOR_TARGET.name,
          type: "website",
          domain: AGGREGATOR_TARGET.domain,
          policy_urls: AGGREGATOR_TARGET.policy_urls,
          policy_content_id: contentIdFor(AGGREGATOR_TARGET.domain),
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
    })
  );

  steps.push(
    enrichPlannedStep(input, {
      label: "Scrape LinkedIn for founder contacts",
      kind: "global",
      demo_key: "linkedin_scrape",
      evaluate: {
        agent_id: input.agent_id,
        target: {
          name: LINKEDIN_TARGET.name,
          type: "website",
          domain: LINKEDIN_TARGET.domain,
          policy_urls: LINKEDIN_TARGET.policy_urls,
          policy_content_id: contentIdFor(
            "linkedin",
            DEMO_POLICIES.linkedin
          ),
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
    })
  );

  for (const v of vendors) {
    steps.push(
      enrichPlannedStep(input, {
        label: `Read pricing page: ${v.name}`,
        kind: "vendor",
        demo_key: "pricing_read",
        evaluate: {
          agent_id: input.agent_id,
          target: {
            name: v.name,
            type: "website",
            domain: v.domain,
            policy_urls: v.policy_urls,
            policy_content_id: contentIdFor(v.domain),
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
      })
    );
  }

  steps.push(
    enrichPlannedStep(input, {
      label: "Store collected emails and contacts in CRM",
      kind: "global",
      demo_key: "email_crm",
      evaluate: {
        agent_id: input.agent_id,
        target: {
          name: "HubSpotCRM",
          type: "saas",
          domain: "hubspot.com",
          policy_urls: ["https://stripe.com/privacy"],
          policy_content_id: contentIdFor(
            "stripe_privacy",
            DEMO_POLICIES.stripe_privacy
          ),
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
    })
  );

  return {
    steps,
    vendors,
    planner_mode: "fixed",
  };
}
