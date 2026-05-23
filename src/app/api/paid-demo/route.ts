import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withPaywall } from "@/lib/with-paywall";
import { x402Network, x402PayTo, x402Price } from "@/lib/x402-payment";

export const runtime = "nodejs";

async function getPaidDemo(_request: NextRequest) {
  return NextResponse.json({
    ok: true,
    paid: true,
    service: "PolicyGuard paid demo",
    message: "x402 payment accepted; this response is behind the paywall.",
    payment: {
      asset: "USDC",
      network: x402Network,
      price: x402Price,
      payTo: x402PayTo,
    },
  });
}

export const GET = withPaywall(getPaidDemo, {
  description: "PolicyGuard Base Sepolia x402 self-payment demo",
});
