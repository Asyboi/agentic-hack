import { NextResponse } from "next/server";

/**
 * No-op middleware.
 *
 * The x402 paywall used to live here, but it has been moved into each
 * route handler via `@/lib/with-paywall` (which wraps `x402-next`'s
 * `withX402`). That pattern verifies the payment, runs the handler, and
 * only settles when the handler succeeds — exactly the "settle after"
 * lifecycle recommended by the x402 docs.
 *
 * This file is kept (per project policy: don't delete files, just stop
 * using them) but the matcher is empty so Next.js never invokes it.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  // Must be a plain array literal — Next.js parses `config` at build time and
  // rejects TypeScript nodes like `as string[]` ("TsAsExpression").
  matcher: [],
  runtime: "nodejs",
};
