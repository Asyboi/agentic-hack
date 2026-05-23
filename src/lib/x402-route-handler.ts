import { NextResponse } from "next/server";
import {
  decodePaymentRequiredHeader,
  decodePaymentSignatureHeader,
  x402HTTPResourceServer,
} from "@x402/core/http";
import {
  createX402Routes,
  x402HasCdpCredentials,
  x402Mode,
  x402ResourceServerInstance,
} from "@/lib/x402-payment";

// #region agent log
function debugLog(location: string, message: string, data: Record<string, unknown>) {
  try {
    fetch("http://127.0.0.1:7399/ingest/7853b27a-7998-4424-9ad5-fe1d0cc7f2d7", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Debug-Session-Id": "1e0825",
      },
      body: JSON.stringify({
        sessionId: "1e0825",
        location,
        message,
        data,
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  } catch {}
}
// #endregion

type ProtectedHandler = (request: Request) => Promise<Response>;

function getPublicOrigin(request: Request): `${string}://${string}` {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0];
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0];
  const protocol = forwardedProto || url.protocol.replace(":", "");
  const host = forwardedHost || request.headers.get("host") || url.host;

  return `${protocol}://${host}`;
}

function createRequestContext(request: Request) {
  const url = new URL(request.url);
  const getPaymentHeader = () =>
    request.headers.get("payment-signature") ??
    request.headers.get("x-payment") ??
    request.headers.get("payment") ??
    undefined;

  return {
    adapter: {
      getHeader: (name: string) => {
        const value = request.headers.get(name);
        if (value) return value;

        // Coinbase's MCP client may send the legacy x402 payment header.
        if (name.toLowerCase() === "payment-signature") {
          return getPaymentHeader();
        }

        return undefined;
      },
      getMethod: () => request.method,
      getPath: () => url.pathname,
      getUrl: () => request.url,
      getAcceptHeader: () => request.headers.get("accept") ?? "",
      getUserAgent: () => request.headers.get("user-agent") ?? "",
      getQueryParams: () => Object.fromEntries(url.searchParams.entries()),
      getQueryParam: (name: string) => url.searchParams.get(name) ?? undefined,
    },
    path: url.pathname,
    method: request.method,
    paymentHeader: getPaymentHeader(),
  };
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

function getDecodedPaymentSummary(paymentHeader: string) {
  try {
    const payment = decodePaymentSignatureHeader(paymentHeader) as {
      x402Version?: number;
      scheme?: string;
      network?: string;
      accepted?: {
        scheme?: string;
        network?: string;
      };
      payload?: Record<string, unknown>;
    };

    return {
      x402Version: payment.x402Version,
      topLevelKeys: Object.keys(payment),
      hasFlatScheme: typeof payment.scheme === "string",
      hasAcceptedField: payment.accepted != null,
      scheme: payment.scheme ?? payment.accepted?.scheme,
      network: payment.network ?? payment.accepted?.network,
      payloadKeys:
        payment.payload && typeof payment.payload === "object"
          ? Object.keys(payment.payload)
          : [],
    };
  } catch (error) {
    return {
      decodeError: error instanceof Error ? error.message : String(error),
    };
  }
}

// #region agent log
// Intercept fetch to CDP facilitator so we can see the actual /verify request and response.
function installFetchInterceptor() {
  const g = globalThis as unknown as {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
    __x402FetchPatched?: boolean;
  };
  if (g.__x402FetchPatched) return;
  const original = g.fetch.bind(globalThis);
  g.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
    const isCdp =
      typeof url === "string" &&
      url.includes("api.cdp.coinbase.com") &&
      (url.endsWith("/verify") || url.endsWith("/settle"));
    if (!isCdp) {
      return original(input, init);
    }

    const requestBody =
      typeof init?.body === "string" ? init.body : undefined;
    let requestBodyParsed: unknown = undefined;
    if (requestBody) {
      try {
        requestBodyParsed = JSON.parse(requestBody);
      } catch {
        requestBodyParsed = `(unparseable, length ${requestBody.length})`;
      }
    }

    const response = await original(input, init);
    let responseBodyText = "";
    let responseBodyParsed: unknown = undefined;
    try {
      const cloned = response.clone();
      responseBodyText = await cloned.text();
      try {
        responseBodyParsed = JSON.parse(responseBodyText);
      } catch {
        responseBodyParsed = responseBodyText.slice(0, 2000);
      }
    } catch {
      responseBodyParsed = "(failed to read body)";
    }

    console.error(
      "x402 CDP facilitator call " +
        JSON.stringify({
          url,
          requestBody: requestBodyParsed,
          responseStatus: response.status,
          responseBody: responseBodyParsed,
        })
    );
    return response;
  };
  g.__x402FetchPatched = true;
}
// #endregion

export function withX402Route(handler: ProtectedHandler): ProtectedHandler {
  return async function protectedHandler(request: Request) {
    // #region agent log
    installFetchInterceptor();
    debugLog("x402-route-handler.ts:entry", "handler entry", {
      hypothesisId: "H1,H3",
      method: request.method,
      url: request.url,
      origin: getPublicOrigin(request),
      forwardedProto: request.headers.get("x-forwarded-proto"),
      forwardedHost: request.headers.get("x-forwarded-host"),
      host: request.headers.get("host"),
      hasXPayment: !!request.headers.get("x-payment"),
      hasPaymentSignature: !!request.headers.get("payment-signature"),
      hasPayment: !!request.headers.get("payment"),
      x402Mode,
      x402HasCdpCredentials,
    });
    // #endregion

    if (x402Mode !== "live") {
      return handler(request);
    }

    if (!x402HasCdpCredentials) {
      return NextResponse.json(
        {
          error: "CDP credentials required",
          message:
            "Set CDP_API_KEY_ID and CDP_API_KEY_SECRET to use X402_MODE=live with the CDP Facilitator.",
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
      // #region agent log
      debugLog("x402-route-handler.ts:initFail", "httpServer.initialize threw", {
        hypothesisId: "H4",
        error: error instanceof Error ? error.message : String(error),
      });
      // #endregion
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

    // #region agent log
    debugLog("x402-route-handler.ts:processResult", "processHTTPRequest returned", {
      hypothesisId: "H1,H2,H3,H4,H5",
      resultType: paymentResult.type,
      hasPaymentHeader: !!requestContext.paymentHeader,
      responseStatus:
        "response" in paymentResult ? paymentResult.response.status : undefined,
      responseHeaderKeys:
        "response" in paymentResult
          ? Object.keys(paymentResult.response.headers)
          : undefined,
    });
    // #endregion

    if (paymentResult.type === "no-payment-required") {
      return handler(request);
    }

    if (paymentResult.type === "payment-error") {
      if (requestContext.paymentHeader) {
        // SDK encodes the header as "PAYMENT-REQUIRED" (uppercase) — fix lookup.
        const headerEntries = Object.entries(paymentResult.response.headers);
        const paymentRequiredEntry = headerEntries.find(
          ([key]) => key.toLowerCase() === "payment-required"
        );
        const paymentRequired = paymentRequiredEntry?.[1];

        let decoded: { error?: string; accepts?: unknown; resource?: unknown } = {};
        try {
          decoded = paymentRequired
            ? (decodePaymentRequiredHeader(paymentRequired) as typeof decoded)
            : {};
        } catch {
          /* leave decoded empty */
        }

        // #region agent log
        debugLog(
          "x402-route-handler.ts:verifyFail",
          "payment-error with payment header present",
          {
            hypothesisId: "H1,H2,H3,H4,H5",
            status: paymentResult.response.status,
            paymentRequiredHeaderFound: !!paymentRequired,
            invalidReason: decoded.error,
            decodedResource: decoded.resource,
            decodedAccepts: decoded.accepts,
            payment: getDecodedPaymentSummary(requestContext.paymentHeader),
          }
        );
        // #endregion

        console.error("x402 payment verification failed", {
          status: paymentResult.response.status,
          error: decoded.error,
          payment: getDecodedPaymentSummary(requestContext.paymentHeader),
        });
      }
      return toNextResponse(paymentResult.response);
    }

    // #region agent log
    debugLog(
      "x402-route-handler.ts:verifyOk",
      "payment-verified, will run handler then settle",
      {
        hypothesisId: "H1,H2,H3,H4,H5",
        matchedScheme: paymentResult.paymentRequirements.scheme,
        matchedNetwork: paymentResult.paymentRequirements.network,
        matchedAsset: paymentResult.paymentRequirements.asset,
        matchedPayTo: paymentResult.paymentRequirements.payTo,
      }
    );
    // #endregion

    const response = await handler(request);
    if (response.status >= 400) {
      await paymentResult.cancellationDispatcher.cancel({
        reason: "handler_failed",
        responseStatus: response.status,
      });
      return response;
    }

    const responseBody = Buffer.from(await response.clone().arrayBuffer());
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const settlement = await httpServer.processSettlement(
      paymentResult.paymentPayload,
      paymentResult.paymentRequirements,
      paymentResult.declaredExtensions,
      {
        request: requestContext,
        responseBody,
        responseHeaders,
      }
    );

    if (!settlement.success) {
      // #region agent log
      debugLog("x402-route-handler.ts:settleFail", "settlement failed", {
        hypothesisId: "H2,H3,H4,H5",
        reason: settlement.errorReason,
        message: settlement.errorMessage,
        status: settlement.response.status,
      });
      // #endregion
      console.error("x402 settlement failed", {
        reason: settlement.errorReason,
        message: settlement.errorMessage,
        status: settlement.response.status,
      });
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

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(settlement.headers)) {
      headers.set(key, value);
    }

    // #region agent log
    debugLog("x402-route-handler.ts:settleOk", "settlement succeeded", {
      hypothesisId: "H1,H2,H3,H4,H5",
      settlementHeaderKeys: Object.keys(settlement.headers),
      responseStatus: response.status,
    });
    // #endregion

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
