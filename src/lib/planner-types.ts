import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import type { VendorCatalogEntry } from "@/lib/research-fixtures";

export type PlannedStep = {
  label: string;
  kind: "global" | "vendor";
  evaluate: EvaluateRequest;
  /** Use canned /evaluate demo fixture when POLICYGUARD_DEMO_MODE=true */
  demoKey?: "linkedin_scrape" | "pricing_read" | "email_crm";
};

export type ResearchPlan = {
  steps: PlannedStep[];
  vendors: VendorCatalogEntry[];
  planner_mode: "fixed" | "llm";
  planner_fallback?: boolean;
};
