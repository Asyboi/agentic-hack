# Payment Demo

PolicyGuard has an optional x402 paywall. It is bypassed by default so teammates can develop without a wallet. Set `X402_MODE=live` locally to enforce payment.

Live mode uses the Coinbase Developer Platform (CDP) Facilitator and declares Bazaar metadata, so successful settlements can be indexed by Bazaar and agentic.market.

## What It Proves

The demo proves the payment-gated HTTP flow works end to end:

1. A client calls a protected route without payment.
2. The middleware returns `402 Payment Required` with x402 payment requirements.
3. A wallet client signs and submits a Base Sepolia USDC payment.
4. The client retries with an `X-PAYMENT` header.
5. The x402 facilitator verifies and settles the payment.
6. If the settlement succeeds through CDP, the facilitator can index the route metadata for Bazaar / agentic.market.
7. The route returns `200 OK` with the protected JSON response.

If the payer and receiver are the same address, this is a self-payment. That is useful as a smoke test, but it does not prove revenue from another user.

## Protected Routes

In live mode, middleware protects:

```text
GET /api/paid-demo
POST /api/evaluate
POST /api/research
```

The route matcher is path-based, so `GET /api/evaluate` and `GET /api/research` are also behind the paywall in live mode. In mock mode, all routes bypass the paywall.

After payment, `/api/paid-demo` returns:

```json
{
  "ok": true,
  "paid": true,
  "service": "PolicyGuard paid demo",
  "message": "x402 payment accepted; this response is behind the paywall.",
  "payment": {
    "asset": "USDC",
    "network": "eip155:84532",
    "price": "$0.001",
    "payTo": "0x6B842e0F980EE89182e6aD0C4FFE36Df8D544a4a"
  }
}
```

The route is intentionally simple. It does not provide the real PolicyGuard verdict yet; it proves that access to a response can be unlocked by x402 payment.

## Config

Payment config lives in `src/lib/x402-payment.ts`.

Wallet, price, network, and facilitator are hard-coded:

```text
payTo: 0x6B842e0F980EE89182e6aD0C4FFE36Df8D544a4a
price: $0.001
network: eip155:84532 / base-sepolia
facilitator: https://api.cdp.coinbase.com/platform/v2/x402
```

The only env flag is:

```bash
X402_MODE=mock
# X402_MODE=live
```

Unset or any value other than `live` behaves as mock and bypasses the paywall.

Live mode also requires CDP credentials:

```bash
CDP_API_KEY_ID=...
CDP_API_KEY_SECRET=...
```

Get these from the Coinbase Developer Platform portal. Do not commit real values.

## Bazaar / Agentic.market

The route metadata is attached with the x402 Bazaar extension in `src/lib/x402-payment.ts`.

To get indexed:

1. Run the app with `X402_MODE=live` and valid `CDP_API_KEY_ID` / `CDP_API_KEY_SECRET`.
2. Serve the app from a public HTTPS URL.
3. Make a successful x402 payment through the CDP Facilitator.
4. Wait for Bazaar indexing; discovery results can take a few minutes to refresh.

There is no separate manual registration step. The successful CDP settlement is what triggers indexing.

## Unpaid Request

Start the app in live mode:

```bash
X402_MODE=live npm run dev
```

Then call the route without payment:

```bash
curl -i http://localhost:3000/api/paid-demo
```

Expected result:

```text
HTTP/1.1 402 Payment Required
```

The body includes an `accepts` array with the price, network, receiver address, USDC asset address, and resource URL.

In default mock mode, the same request returns `200 OK` because the paywall is bypassed.

## Paid Request With Coinbase Payments MCP

The Coinbase payments MCP requires a public HTTPS URL, not `localhost`. For local testing, expose the dev server with a tunnel:

```bash
X402_MODE=live npm run dev
npx localtunnel --port 3000
```

Make sure the shell running `npm run dev` also has `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET`.

Discover the payment requirements:

```text
x402_discover_payment_requirements
baseURL: https://your-tunnel.loca.lt
path: /api/paid-demo
method: GET
```

Make the paid request:

```text
make_http_request_with_x402
baseURL: https://your-tunnel.loca.lt
path: /api/paid-demo
method: GET
preferredNetwork: base-sepolia
maxAmountPerRequest: 1000
```

`maxAmountPerRequest` is in USDC atomic units. `1000` means `0.001` USDC.

## How To Verify A Payment

For Base Sepolia, open the transaction on BaseScan:

```text
https://sepolia.basescan.org/tx/<transaction-hash>
```

Check the ERC-20 transfer:

- `From` is the payer wallet.
- `To` is `X402_PAY_TO`, the receiver wallet.
- The token is USDC on Base Sepolia.
- The amount matches `X402_PRICE`.

If `From` and `To` are the same address, you paid yourself. The useful proof is that the route only returned `200 OK` after the x402 payment was verified.

## Moving Payment To A Real Route

The real product routes are already listed in `src/lib/x402-payment.ts` and `src/middleware.ts`. Keep `X402_MODE=mock` for normal team development, and use `X402_MODE=live` when you want to verify the x402 flow.
