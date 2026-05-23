import { facilitator as cdpFacilitator } from "@coinbase/x402";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { RouteConfig, RoutesConfig } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar";

type EvmAddress = `0x${string}`;
type HttpUrl = `${string}://${string}`;

export const x402Mode = process.env.X402_MODE === "live" ? "live" : "mock";
export const x402HasCdpCredentials = Boolean(
  process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET
);
export const x402PayTo: EvmAddress = "0x6B842e0F980EE89182e6aD0C4FFE36Df8D544a4a";
export const x402Price = "$0.001";
export const x402Network = "eip155:84532";
export const x402NetworkCaip = x402Network;
export const x402Facilitator = new HTTPFacilitatorClient(cdpFacilitator);

export const x402ResourceServerInstance = new x402ResourceServer(x402Facilitator)
  .register(x402Network, new ExactEvmScheme())
  .registerExtension(bazaarResourceServerExtension);

function createRouteConfig(
  description: string,
  resource?: HttpUrl,
  extensions?: Record<string, unknown>
): RouteConfig {
  return {
    accepts: {
      scheme: "exact",
      payTo: x402PayTo,
      price: x402Price,
      network: x402Network,
    },
    description,
    mimeType: "application/json",
    ...(resource ? { resource } : {}),
    extensions,
  };
}

const evaluateInputExample = {
  agent_id: "marketplace-buyer-agent",
  target: {
    name: "LinkedIn",
    type: "website",
    domain: "linkedin.com",
    policy_urls: ["https://www.linkedin.com/legal/user-agreement"],
  },
  intended_action: {
    action_type: "scrape_profiles",
    description: "Scrape 100 public profiles matching software engineer.",
    uses_automation: true,
    frequency: "bulk",
    stores_data: true,
    data_types: ["profile"],
    contains_pii: true,
    commercial_use: true,
    uses_official_api: false,
  },
};

const evaluateInputSchema = {
  type: "object",
  properties: {
    agent_id: { type: "string" },
    target: {
      type: "object",
      properties: {
        name: { type: "string" },
        type: { type: "string", enum: ["website", "api", "saas"] },
        domain: { type: "string" },
        policy_urls: {
          type: "array",
          items: { type: "string", format: "uri" },
        },
      },
      required: ["name"],
    },
    intended_action: {
      type: "object",
      properties: {
        action_type: { type: "string" },
        description: { type: "string" },
        uses_automation: { type: "boolean" },
        frequency: {
          type: "string",
          enum: ["once", "daily", "bulk", "user_initiated_only"],
        },
        stores_data: { type: "boolean" },
        data_types: { type: "array", items: { type: "string" } },
        contains_pii: { type: "boolean" },
        commercial_use: { type: "boolean" },
        uses_official_api: { type: "boolean" },
      },
      required: ["action_type"],
    },
  },
  required: ["agent_id", "target", "intended_action"],
};

const verdictOutputExample = {
  decision: "blocked",
  risk_level: "high",
  reason: "The proposed automated collection is not allowed by the target policy.",
  matched_rules: ["no_automated_access"],
  machine_instruction: {
    proceed: false,
    disable_target_action: true,
    requires_human_review: false,
  },
  citation: {
    source_url: "https://www.linkedin.com/legal/user-agreement",
    quoted_text: "Use bots or other automated methods to access the Services...",
    fetched_at: "2026-05-23T17:00:00.000Z",
  },
};

const verdictOutputSchema = {
  type: "object",
  properties: {
    decision: {
      type: "string",
      enum: ["allowed", "blocked", "modify_recommended"],
    },
    risk_level: { type: "string", enum: ["low", "medium", "high"] },
    reason: { type: "string" },
    matched_rules: { type: "array", items: { type: "string" } },
    machine_instruction: { type: "object" },
    citation: { type: "object" },
    cited_md_url: { type: "string", format: "uri" },
  },
  required: [
    "decision",
    "risk_level",
    "reason",
    "matched_rules",
    "machine_instruction",
    "citation",
  ],
};

const researchInputExample = {
  agent_id: "marketplace-buyer-agent",
  task: "Find 20 project-management tools under $50/user and check whether collecting pricing data is policy-compliant.",
  max_vendors: 5,
};

const researchInputSchema = {
  type: "object",
  properties: {
    agent_id: { type: "string" },
    task: { type: "string", minLength: 10 },
    max_vendors: { type: "integer", minimum: 1, maximum: 20 },
  },
  required: ["agent_id", "task"],
};

const researchOutputExample = {
  research_id: "research-demo",
  status: "completed",
  summary: "Found candidate vendors and policy-checked the planned collection.",
  vendors: [],
};

const researchOutputSchema = {
  type: "object",
  properties: {
    research_id: { type: "string" },
    task: { type: "string" },
    status: { type: "string", enum: ["completed", "partial"] },
    summary: { type: "string" },
    vendors: { type: "array" },
  },
  required: ["research_id", "task", "status", "summary"],
};

function paidDemoExtension() {
  return declareDiscoveryExtension({
    input: {},
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    output: {
      example: {
        ok: true,
        paid: true,
        service: "PolicyGuard paid demo",
      },
      schema: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          paid: { type: "boolean" },
          service: { type: "string" },
        },
        required: ["ok", "paid", "service"],
      },
    },
  });
}

function evaluateExtension(method: "GET" | "POST") {
  if (method === "GET") {
    return declareDiscoveryExtension({
      input: {},
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      output: {
        example: {
          service: "PolicyGuard",
          endpoint: "POST /api/evaluate",
        },
      },
    });
  }

  return declareDiscoveryExtension({
    input: evaluateInputExample,
    inputSchema: evaluateInputSchema,
    bodyType: "json",
    output: {
      example: verdictOutputExample,
      schema: verdictOutputSchema,
    },
  });
}

function researchExtension(method: "GET" | "POST") {
  if (method === "GET") {
    return declareDiscoveryExtension({
      input: {},
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      output: {
        example: {
          service: "PolicyGuard Research",
          endpoint: "POST /api/research",
        },
      },
    });
  }

  return declareDiscoveryExtension({
    input: researchInputExample,
    inputSchema: researchInputSchema,
    bodyType: "json",
    output: {
      example: researchOutputExample,
      schema: researchOutputSchema,
    },
  });
}

export function createX402Routes(origin?: HttpUrl): RoutesConfig {
  const resource = (path: string) => (origin ? (`${origin}${path}` as HttpUrl) : undefined);

  return {
    "GET /api/paid-demo": createRouteConfig(
      "PolicyGuard Base Sepolia x402 self-payment demo",
      resource("/api/paid-demo"),
      paidDemoExtension()
    ),
    "GET /api/evaluate": createRouteConfig(
      "PolicyGuard compliance verdict API",
      resource("/api/evaluate"),
      evaluateExtension("GET")
    ),
    "POST /api/evaluate": createRouteConfig(
      "PolicyGuard compliance verdict API",
      resource("/api/evaluate"),
      evaluateExtension("POST")
    ),
    "GET /api/research": createRouteConfig(
      "PolicyGuard marketplace research API",
      resource("/api/research"),
      researchExtension("GET")
    ),
    "POST /api/research": createRouteConfig(
      "PolicyGuard marketplace research API",
      resource("/api/research"),
      researchExtension("POST")
    ),
  };
}

export const x402Routes: RoutesConfig = createX402Routes();
