import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import { fetchPolicyPage } from "@/lib/nimble";
import type { PlannedStep } from "@/lib/planner-types";
import type { VendorCatalogEntry } from "@/lib/research-fixtures";

export type VendorCollectionResult = {
  price_per_user: string;
  trial_url: string;
  why_startup: string;
  pricing_url: string;
  collection_source: "nimble_heuristic" | "nimble_llm" | "catalog_fallback";
  pricing_excerpt?: string;
};

const extractedPricingSchema = z.object({
  price_per_user: z.string().describe('e.g. "$10/user" or "$9 per user/month"'),
  trial_url: z.string().url().describe("Free trial or signup URL"),
  why_startup: z
    .string()
    .max(200)
    .describe("One line why this fits a 50-person startup"),
});

export function isVendorCollectionEnabled(): boolean {
  const flag = process.env.POLICYGUARD_COLLECT_PRICING?.trim().toLowerCase();
  return flag !== "false";
}

function pricingUrlFor(
  vendor: VendorCatalogEntry,
  step: PlannedStep
): string {
  const fromDesc = step.evaluate.intended_action.description?.match(
    /https?:\/\/[^\s)"']+/i
  )?.[0];
  return vendor.pricing_url || fromDesc || `https://${vendor.domain}/pricing`;
}

function extractHeuristic(
  markdown: string,
  vendorName: string,
  pricingUrl: string
): Partial<VendorCollectionResult> | null {
  const text = markdown.slice(0, 30_000);

  const pricePatterns = [
    /\$\s?(\d+(?:\.\d{1,2})?)\s*(?:\/|\s*per\s*)?user(?:\s*\/\s*month)?/i,
    /\$\s?(\d+(?:\.\d{1,2})?)\s*\/\s*user\s*\/\s*mo/i,
    /(\d+(?:\.\d{1,2})?)\s*(?:USD|usd)\s*per\s*user/i,
    /\$\s?(\d+(?:\.\d{1,2})?)\s*\/\s*month/i,
  ];

  let price_per_user: string | undefined;
  for (const re of pricePatterns) {
    const m = text.match(re);
    if (m) {
      price_per_user = m[0].replace(/\s+/g, " ").trim();
      if (!/\/user/i.test(price_per_user) && /\/month|\/mo/i.test(price_per_user)) {
        price_per_user = price_per_user.replace(/\/month|\/mo/i, "/user/month");
      }
      break;
    }
  }

  const trialPatterns = [
    /https?:\/\/[^\s)"'<>]+(?:trial|signup|sign-up|free-trial|get-started)[^\s)"'<>]*/gi,
    /https?:\/\/[^\s)"'<>]*\/(?:trial|signup|sign-up|free)[^\s)"'<>]*/gi,
  ];
  let trial_url: string | undefined;
  for (const re of trialPatterns) {
    const m = text.match(re);
    if (m?.[0]) {
      trial_url = m[0].replace(/[.,;]+$/, "");
      break;
    }
  }

  if (!price_per_user && !trial_url) return null;

  return {
    price_per_user: price_per_user ?? "See pricing page",
    trial_url: trial_url ?? pricingUrl,
    why_startup: `${vendorName} pricing page reviewed for per-seat cost and trial availability.`,
    pricing_url: pricingUrl,
    collection_source: "nimble_heuristic",
    pricing_excerpt: text.slice(0, 400),
  };
}

async function extractWithLlm(
  markdown: string,
  vendorName: string,
  task: string,
  pricingUrl: string
): Promise<VendorCollectionResult | null> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return null;

  try {
    const { object } = await generateObject({
      model: anthropic("claude-sonnet-4-20250514"),
      schema: extractedPricingSchema,
      prompt: `Extract pricing for a marketplace vendor packet from this pricing page markdown.
Vendor: ${vendorName}
Pricing URL: ${pricingUrl}
Buyer task: ${task}

Markdown (truncated):
${markdown.slice(0, 8000)}

Return realistic price_per_user, trial_url, and a one-line why_startup for a 50-person startup.`,
    });

    return {
      ...object,
      pricing_url: pricingUrl,
      collection_source: "nimble_llm",
      pricing_excerpt: markdown.slice(0, 400),
    };
  } catch (e) {
    console.warn(`[vendor-collect] LLM extract failed for ${vendorName}`, e);
    return null;
  }
}

/**
 * After policy allows read_pricing_page, fetch the live pricing URL via Nimble.
 */
export async function collectVendorPricing(
  vendor: VendorCatalogEntry,
  step: PlannedStep,
  task: string
): Promise<VendorCollectionResult | null> {
  if (!isVendorCollectionEnabled()) return null;
  if (!process.env.NIMBLE_API_KEY?.trim()) return null;

  const pricing_url = pricingUrlFor(vendor, step);
  console.info(`[vendor-collect] Nimble pricing fetch: ${pricing_url}`);

  let body: string;
  try {
    const page = await fetchPolicyPage(pricing_url);
    body = page.body;
  } catch (e) {
    console.warn(`[vendor-collect] failed ${pricing_url}`, e);
    return null;
  }

  const heuristic = extractHeuristic(body, vendor.name, pricing_url);
  if (heuristic?.price_per_user && heuristic.price_per_user !== "See pricing page") {
    return heuristic as VendorCollectionResult;
  }

  const llm =
    process.env.POLICYGUARD_COLLECT_LLM !== "false"
      ? await extractWithLlm(body, vendor.name, task, pricing_url)
      : null;
  if (llm) return llm;

  if (heuristic) return heuristic as VendorCollectionResult;

  return null;
}
