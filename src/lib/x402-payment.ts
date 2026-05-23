import type { RouteConfig, RoutesConfig } from "x402-next";

const DEFAULT_PAY_TO = "0x6B842e0F980EE89182e6aD0C4FFE36Df8D544a4a";
const DEFAULT_PRICE = "$0.001";
const DEFAULT_NETWORK_CAIP = "eip155:84532";
const DEFAULT_FACILITATOR_URL = "https://x402.org/facilitator";

type X402NextNetwork = "base" | "base-sepolia";
type EvmAddress = `0x${string}`;
type HttpUrl = `${string}://${string}`;

function normalizePayTo(payTo: string | undefined): EvmAddress {
  const address = payTo || DEFAULT_PAY_TO;
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    throw new Error("X402_PAY_TO must be a valid 0x EVM address.");
  }
  return address as EvmAddress;
}

function normalizeNetwork(network: string | undefined): X402NextNetwork {
  switch (network) {
    case "eip155:8453":
    case "base":
      return "base";
    case "eip155:84532":
    case "base-sepolia":
    case undefined:
    case "":
      return "base-sepolia";
    default:
      throw new Error(
        `Unsupported X402_NETWORK "${network}". Use eip155:84532/base-sepolia for the demo.`
      );
  }
}

function normalizeHttpUrl(url: string | undefined, name: string): HttpUrl | undefined {
  if (!url) {
    return undefined;
  }
  if (!/^https?:\/\/.+/.test(url)) {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  return url as HttpUrl;
}

function normalizeRequiredHttpUrl(url: string | undefined, name: string): HttpUrl {
  const value = url || DEFAULT_FACILITATOR_URL;
  if (!/^https?:\/\/.+/.test(value)) {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
  return value as HttpUrl;
}

function toCaipNetwork(network: X402NextNetwork): string {
  return network === "base" ? "eip155:8453" : DEFAULT_NETWORK_CAIP;
}

export const x402PayTo = normalizePayTo(process.env.X402_PAY_TO);
export const x402Price = process.env.X402_PRICE || DEFAULT_PRICE;
export const x402Network = normalizeNetwork(process.env.X402_NETWORK);
export const x402NetworkCaip = toCaipNetwork(x402Network);
export const x402ResourceUrl = normalizeHttpUrl(
  process.env.X402_RESOURCE_URL,
  "X402_RESOURCE_URL"
);
export const x402Facilitator = {
  url: normalizeRequiredHttpUrl(
    process.env.X402_FACILITATOR_URL,
    "X402_FACILITATOR_URL"
  ),
};

export const paidDemoRouteConfig: RouteConfig = {
  price: x402Price,
  network: x402Network,
  config: {
    description: "PolicyGuard Base Sepolia x402 self-payment demo",
    mimeType: "application/json",
    ...(x402ResourceUrl ? { resource: x402ResourceUrl } : {}),
    outputSchema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        paid: { type: "boolean" },
        service: { type: "string" },
      },
      required: ["ok", "paid", "service"],
    },
  },
};

export const x402Routes: RoutesConfig = {
  "/api/paid-demo": paidDemoRouteConfig,
};
