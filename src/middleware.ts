import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { x402HTTPResourceServer } from "@x402/core/http";
import {
  createX402Routes,
  x402HasCdpCredentials,
  x402Mode,
  x402ResourceServerInstance,
} from "@/lib/x402-payment";

function getPublicOrigin(request: NextRequest): `${string}://${string}` {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0];
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0];
  const protocol = forwardedProto || request.nextUrl.protocol.replace(":", "");
  const host = forwardedHost || request.headers.get("host") || request.nextUrl.host;

  return `${protocol}://${host}`;
}

function toNextResponse(response: {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
  isHtml?: boolean;
}) {
  const headers = new Headers(response.headers);

  if (response.body === undefined) {
    return new NextResponse(null, { status: response.status, headers });
  }

  if (typeof response.body === "string") {
    return new NextResponse(response.body, { status: response.status, headers });
  }

  if (!response.isHtml && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new NextResponse(JSON.stringify(response.body), {
    status: response.status,
    headers,
  });
}

function createRequestContext(request: NextRequest) {
  return {
    adapter: {
      getHeader: (name: string) => request.headers.get(name) ?? undefined,
      getMethod: () => request.method,
      getPath: () => request.nextUrl.pathname,
      getUrl: () => request.url,
      getAcceptHeader: () => request.headers.get("accept") ?? "",
      getUserAgent: () => request.headers.get("user-agent") ?? "",
      getQueryParams: () =>
        Object.fromEntries(request.nextUrl.searchParams.entries()),
      getQueryParam: (name: string) =>
        request.nextUrl.searchParams.get(name) ?? undefined,
    },
    path: request.nextUrl.pathname,
    method: request.method,
    paymentHeader:
      request.headers.get("x-payment") ??
      request.headers.get("payment") ??
      undefined,
  };
}

export async function middleware(request: NextRequest) {
  if (x402Mode !== "live") {
    return NextResponse.next();
  }

  if (!x402HasCdpCredentials) {
    return NextResponse.json(
      {
        error: "CDP credentials required",
        message:
          "Set CDP_API_KEY_ID and CDP_API_KEY_SECRET in .env.local to use X402_MODE=live with the CDP Facilitator.",
      },
      { status: 500 }
    );
  }

  const httpServer = new x402HTTPResourceServer(
    x402ResourceServerInstance,
    createX402Routes(getPublicOrigin(request))
  );
  try {
    await httpServer.initialize();
  } catch (error) {
    return NextResponse.json(
      {
        error: "x402 initialization failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }

  const requestContext = createRequestContext(request);
  const paymentResult = await httpServer.processHTTPRequest(requestContext);

  if (paymentResult.type === "no-payment-required") {
    return NextResponse.next();
  }

  if (paymentResult.type === "payment-error") {
    return toNextResponse(paymentResult.response);
  }

  const response = NextResponse.next();
  const settlement = await httpServer.processSettlement(
    paymentResult.paymentPayload,
    paymentResult.paymentRequirements,
    paymentResult.declaredExtensions,
    { request: requestContext }
  );

  if (!settlement.success) {
    return NextResponse.json(
      {
        error: "x402 settlement failed",
        reason: settlement.errorReason,
        message: settlement.errorMessage,
      },
      {
        status: settlement.response.status,
        headers: settlement.response.headers,
      }
    );
  }

  for (const [key, value] of Object.entries(settlement.headers)) {
    response.headers.set(key, value);
  }

  return response;
}

export const config = {
  matcher: ["/api/paid-demo", "/api/evaluate", "/api/research"],
  runtime: "nodejs",
};
