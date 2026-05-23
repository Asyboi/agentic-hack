import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  withX402,
  type RouteConfig,
  type Resource,
} from "x402-next";
import { facilitator as cdpFacilitator } from "@coinbase/x402";
import {
  x402HasCdpCredentials,
  x402Mode,
  x402Network,
  x402PayTo,
  x402Price,
} from "@/lib/x402-payment";

/**
 * Route handlers commonly return `NextResponse<A> | NextResponse<B>` (success
 * vs. error shapes), so we accept the broadest signature and let `withX402`
 * see it through a single cast. This avoids forcing every route to unify
 * its response types.
 */
type Handler = (request: NextRequest) => Promise<NextResponse>;

export interface PaywallOptions {
  description: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
}

/**
 * Selects the x402 facilitator to use.
 *
 * - `X402_FACILITATOR=cdp` forces Coinbase Developer Platform
 *   (`https://api.cdp.coinbase.com/platform/v2/x402`). Required for Bazaar
 *   indexing and mainnet revenue tracking, but currently rejects Coinbase
 *   Smart Wallet (ERC-1271 / ERC-6492) signatures with `invalid_payload` on
 *   the v2 EIP-3009 path — see https://github.com/coinbase/x402/issues/1171.
 * - Anything else falls back to the public testnet facilitator at
 *   `https://x402.org/facilitator` (x402-next's built-in default), which
 *   accepts smart-wallet signatures on Base Sepolia.
 *
 * Default for this app is the public testnet facilitator so that the
 * Coinbase Payments MCP wallet (a Smart Wallet) can actually pay.
 */
function selectFacilitator(): Parameters<typeof withX402>[3] {
  const explicit = (process.env.X402_FACILITATOR ?? "").toLowerCase();
  if (explicit === "cdp" && x402HasCdpCredentials) {
    return cdpFacilitator as unknown as Parameters<typeof withX402>[3];
  }
  return undefined;
}

/**
 * Wraps a Next.js route handler with an x402 paywall.
 *
 * Behavior:
 *   - `X402_MODE !== "live"`: returns the handler untouched (mock-friendly).
 *   - `X402_MODE === "live"`: uses x402-next's `withX402`, which verifies the
 *     payment, runs the handler, and only settles when the handler succeeds
 *     (status < 400) — the recommended pattern from the x402-next docs.
 */
export function withPaywall(
  handler: Handler,
  options: PaywallOptions
): Handler {
  if (x402Mode !== "live") {
    return handler;
  }

  const buildRouteConfig = async (req: NextRequest): Promise<RouteConfig> => ({
    price: x402Price,
    network: x402Network,
    config: {
      description: options.description,
      mimeType: options.mimeType ?? "application/json",
      resource: req.nextUrl
        ? (`${req.nextUrl.origin}${req.nextUrl.pathname}` as Resource)
        : undefined,
      ...(options.maxTimeoutSeconds
        ? { maxTimeoutSeconds: options.maxTimeoutSeconds }
        : {}),
    },
  });

  return withX402(handler, x402PayTo, buildRouteConfig, selectFacilitator());
}
