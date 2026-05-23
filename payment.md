# Payment Demo

PolicyGuard currently has a small x402 payment demo at `GET /api/paid-demo`.
It charges a tiny USDC amount on Base Sepolia before returning JSON.

## What It Proves

The demo proves the payment-gated HTTP flow works end to end:

1. A client calls `GET /api/paid-demo` without payment.
2. The middleware returns `402 Payment Required` with x402 payment requirements.
3. A wallet client signs and submits a Base Sepolia USDC payment.
4. The client retries with an `X-PAYMENT` header.
5. The x402 facilitator verifies and settles the payment.
6. The route returns `200 OK` with the protected JSON response.

If the payer and receiver are the same address, this is a self-payment. That is useful as a smoke test, but it does not prove revenue from another user.

## Current Route

The protected route is:

```text
GET /api/paid-demo
```

After payment, it returns:

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

Environment variables:

```bash
X402_PAY_TO=0x6B842e0F980EE89182e6aD0C4FFE36Df8D544a4a
X402_PRICE=$0.001
X402_NETWORK=eip155:84532
X402_FACILITATOR_URL=https://x402.org/facilitator
```

For local tunnel testing, also set:

```bash
X402_RESOURCE_URL=https://your-public-tunnel.example/api/paid-demo
```

`X402_RESOURCE_URL` matters because external wallet/MCP clients usually cannot call `localhost`, and the x402 payment requirement should point at the public HTTPS URL the client will pay for.

## Unpaid Request

Start the app:

```bash
npm run dev
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

## Paid Request With Coinbase Payments MCP

The Coinbase payments MCP requires a public HTTPS URL, not `localhost`. For local testing, expose the dev server with a tunnel:

```bash
npx localtunnel --port 3000
```

Restart the app with the public resource URL:

```bash
X402_RESOURCE_URL=https://your-tunnel.loca.lt/api/paid-demo npm run dev
```

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

Right now only `/api/paid-demo` is protected in `src/middleware.ts`.

To charge for real PolicyGuard verdicts, add `/api/evaluate` to the x402 route config and middleware matcher. Keep the demo route around as a low-risk smoke test.
