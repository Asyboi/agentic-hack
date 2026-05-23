# Coinbase Payments MCP Setup

This repo uses the Coinbase Payments MCP server so Cursor agents can interact with a wallet, inspect balances, discover x402 payment requirements, and make paid x402 HTTP requests.

Use this account for the demo wallet login:

```text
kyle@pretext.works
```

## Cursor MCP Config

Add this to Cursor's MCP config file at `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "coinbase-payments": {
      "command": "env",
      "args": [
        "-u",
        "ELECTRON_RUN_AS_NODE",
        "node",
        "/home/kilolima/.payments-mcp/bundle.js"
      ]
    }
  }
}
```

After saving the config, restart Cursor or reload the MCP servers so the `coinbase-payments` server is available.

## Install The MCP Bundle

The config above expects the server bundle to exist here:

```text
/home/kilolima/.payments-mcp/bundle.js
```

If that file is missing, install or copy the Coinbase Payments MCP bundle into `/home/kilolima/.payments-mcp/`, then reload Cursor.

## Login Flow

When the wallet is not authenticated, use the MCP tools in this order:

1. Call `check_session_status`.
2. If it says the wallet is not signed in, call `show_wallet_app` if available so the user can complete login in the wallet UI.
3. Start email login for `kyle@pretext.works` with `sign_in_with_email`.
4. Ask the user for the 6-digit OTP from email.
5. Complete login with `verify_email_otp`.
6. Call `check_session_status` again to confirm the wallet is authenticated.

Do not store the OTP in docs, code, or commits.

## Useful MCP Tools

Use `check_session_status` first when debugging wallet or payment issues.

Common wallet tools:

- `check_session_status`: confirm whether the wallet is authenticated.
- `sign_in_with_email`: send a 6-digit OTP to `kyle@pretext.works`.
- `verify_email_otp`: complete login with the OTP.
- `get_wallet_address`: get the wallet address, for example with `chain: "base-sepolia"`.
- `get_wallet_balance`: check USDC/ETH balances, for example with `chain: "base-sepolia"`.
- `show_wallet_app`: open the wallet companion UI.

Common x402 tools:

- `x402_discover_payment_requirements`: inspect an endpoint's x402 cost without paying.
- `make_http_request_with_x402`: pay and call a protected x402 endpoint.

## Example: Check Wallet Address

Use:

```text
get_wallet_address
chain: base-sepolia
```

Expected format:

```text
0x...
```

Use this address as `X402_PAY_TO` when testing a self-payment route.

## Example: Pay The Local Demo Route

The Coinbase Payments MCP does not call internal hosts like `localhost`, so expose the local app through a public HTTPS tunnel:

```bash
npm run dev
npx localtunnel --port 3000
```

Start or restart the app with the public tunnel URL in the x402 resource:

```bash
X402_RESOURCE_URL=https://your-tunnel.loca.lt/api/paid-demo npm run dev
```

Discover the payment requirement:

```text
x402_discover_payment_requirements
baseURL: https://your-tunnel.loca.lt
path: /api/paid-demo
method: GET
```

Pay and call the endpoint:

```text
make_http_request_with_x402
baseURL: https://your-tunnel.loca.lt
path: /api/paid-demo
method: GET
preferredNetwork: base-sepolia
maxAmountPerRequest: 1000
```

`maxAmountPerRequest` is in USDC atomic units. For USDC, `1000` means `0.001` USDC.

## Verify A Payment

For Base Sepolia, inspect transactions on BaseScan:

```text
https://sepolia.basescan.org/tx/<transaction-hash>
```

Check:

- The ERC-20 token is USDC.
- `From` is the paying wallet.
- `To` is the receiving wallet from `X402_PAY_TO`.
- The amount matches the route price.

If `From` and `To` are the same address, the payment is a self-payment. That still proves the x402 auth-through-payment path works, but it does not prove revenue from a separate customer.
