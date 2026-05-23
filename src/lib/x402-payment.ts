import { facilitator } from "@coinbase/x402";
import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { RouteConfig, RoutesConfig } from "@x402/core/http";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  bazaarResourceServerExtension,
  declareDiscoveryExtension,
} from "@x402/extensions/bazaar";
import type { Network } from "x402-next";

// ============================================================================
// Active v1 stack — consumed by `withPaywall` + `x402-next`. This is the
// payment path the live request handlers actually run.
// ============================================================================

export type EvmAddress = `0x${string}`;
type HttpUrl = `${string}://${string}`;

export const x402Mode: "live" | "mock" =
  process.env.X402_MODE === "live" ? "live" : "mock";

export const x402HasCdpCredentials = Boolean(
  process.env.CDP_API_KEY_ID && process.env.CDP_API_KEY_SECRET
);

export const x402PayTo: EvmAddress =
  "0x6B842e0F980EE89182e6aD0C4FFE36Df8D544a4a";

export const x402Network: Network = "base-sepolia";

export const x402Price = "$0.001";

export const x402Facilitator = facilitator;

// ============================================================================
// Legacy v2 stack — kept so leftover modules (`src/middleware.ts`,
// `src/lib/x402-route-handler.ts`) still compile. They are no longer wired
// into the request path. Safe to remove once those files are no longer needed.
// ============================================================================

export const x402NetworkCaip = "eip155:84532" as const;
export const x402FacilitatorClient = new HTTPFacilitatorClient(facilitator);

export const x402ResourceServerInstance = new x402ResourceServer(
  x402FacilitatorClient
)
  .register(x402NetworkCaip, new ExactEvmScheme())
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
      network: x402NetworkCaip,
    },
    description,
    mimeType: "application/json",
    ...(resource ? { resource } : {}),
    extensions,
  };
}

function paidDemoExtension() {
  return declareDiscoveryExtension({
    input: {},
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    output: {
      example: { ok: true, paid: true, service: "PolicyGuard paid demo" },
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

export function createX402Routes(origin?: HttpUrl): RoutesConfig {
  const resource = (path: string) =>
    origin ? (`${origin}${path}` as HttpUrl) : undefined;

  return {
    "GET /api/paid-demo": createRouteConfig(
      "PolicyGuard Base Sepolia x402 self-payment demo",
      resource("/api/paid-demo"),
      paidDemoExtension()
    ),
  };
}

export const x402Routes: RoutesConfig = createX402Routes();
