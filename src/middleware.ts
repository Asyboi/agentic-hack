import { paymentMiddleware } from "x402-next";
import { x402Facilitator, x402PayTo, x402Routes } from "@/lib/x402-payment";

export const middleware = paymentMiddleware(
  x402PayTo,
  x402Routes,
  x402Facilitator
);

export const config = {
  matcher: ["/api/paid-demo"],
  runtime: "nodejs",
};
