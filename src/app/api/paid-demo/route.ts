import { NextResponse } from "next/server";
import { x402NetworkCaip, x402PayTo, x402Price } from "@/lib/x402-payment";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    paid: true,
    service: "PolicyGuard paid demo",
    message: "x402 payment accepted; this response is behind the paywall.",
    payment: {
      asset: "USDC",
      network: x402NetworkCaip,
      price: x402Price,
      payTo: x402PayTo,
    },
  });
}
