import { DEMO_POLICIES } from "@/lib/demo-fixtures";
import {
  AGGREGATOR_TARGET,
  LINKEDIN_TARGET,
  PM_VENDOR_CATALOG,
} from "@/lib/research-fixtures";

/** One Senso KB document per domain — Nimble-fetched terms/robots combined. */
export type PolicyIngestTarget = {
  key: string;
  name: string;
  domain: string;
  policy_urls: string[];
  /** When set, `kb:ingest` patches this content instead of creating a new node. */
  existing_content_id?: string;
};

export const POLICY_INGEST_TARGETS: PolicyIngestTarget[] = [
  {
    key: "linkedin",
    name: LINKEDIN_TARGET.name,
    domain: LINKEDIN_TARGET.domain,
    policy_urls: LINKEDIN_TARGET.policy_urls,
    existing_content_id: DEMO_POLICIES.linkedin,
  },
  {
    key: "g2",
    name: AGGREGATOR_TARGET.name,
    domain: AGGREGATOR_TARGET.domain,
    policy_urls: AGGREGATOR_TARGET.policy_urls,
  },
  {
    key: "stripe_privacy",
    name: "Stripe Privacy (CRM / PII reference)",
    domain: "stripe.com",
    policy_urls: ["https://stripe.com/privacy"],
    existing_content_id: DEMO_POLICIES.stripe_privacy,
  },
  ...PM_VENDOR_CATALOG.map((v) => ({
    key: v.domain.replace(/\./g, "_"),
    name: v.name,
    domain: v.domain,
    policy_urls: v.policy_urls,
  })),
];

export function getIngestTarget(key: string): PolicyIngestTarget | undefined {
  return POLICY_INGEST_TARGETS.find((t) => t.key === key);
}
