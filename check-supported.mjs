import { generateJwt } from "@coinbase/cdp-sdk/auth";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const jwt = await generateJwt({
  apiKeyId: process.env.CDP_API_KEY_ID,
  apiKeySecret: process.env.CDP_API_KEY_SECRET,
  requestMethod: "GET",
  requestHost: "api.cdp.coinbase.com",
  requestPath: "/platform/v2/x402/supported",
});
const res = await fetch(
  "https://api.cdp.coinbase.com/platform/v2/x402/supported",
  { headers: { Authorization: "Bearer " + jwt } }
);
const text = await res.text();
console.log("status:", res.status);
try {
  const json = JSON.parse(text);
  const baseSepoliaKinds = (json.kinds || []).filter(
    (k) => k.network && (String(k.network).includes("84532") || String(k.network).includes("base-sepolia"))
  );
  console.log("Base Sepolia kinds:", JSON.stringify(baseSepoliaKinds, null, 2));
  const versions = [...new Set((json.kinds || []).map((k) => k.x402Version))];
  console.log("Distinct x402Versions:", versions);
  console.log("Total kinds:", (json.kinds || []).length);
} catch (e) {
  console.log("preview:", text.slice(0, 800));
}
