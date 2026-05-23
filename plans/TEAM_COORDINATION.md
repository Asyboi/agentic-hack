# Team coordination — paste into Slack/Discord

**Repo:** https://github.com/Asyboi/agentic-hack  
**Marketing site:** https://policyguard-site.vercel.app  
**Senso cheat sheet:** [plans/SENSO_INTEGRATION.md](./SENSO_INTEGRATION.md)  
**Full handoff:** [plans/HANDOFF.md](./HANDOFF.md)

---

## Roles (updated)

| Person | Owns |
|--------|------|
| **Kyle** | Marketplace buyer flow, x402 paywall on API |
| **Aslan** | Nimble — live fetch in [src/lib/nimble.ts](../src/lib/nimble.ts) |
| **Candy** | Senso — KB, search, cited.md publish |
| **Aarya** | `/evaluate`, `/api/research` core, pipeline, rule engine, ClickHouse, Vercel deploy |

---

## @Kyle — marketplace + x402 (P0)

**Ask:** Is x402 green on deployed `POST /api/evaluate` or `POST /api/research`? Need one paid buyer request reaching the handler (real Sepolia receipt OR mock with receipt artifact).

**Kill criterion by 12:30pm:** Green test transaction OR documented mock-mode fallback wired before handler.

**Where to wire:** Middleware on [src/app/api/evaluate/route.ts](../src/app/api/evaluate/route.ts) and/or [src/app/api/research/route.ts](../src/app/api/research/route.ts).

**Marketplace demo body:**

```json
{
  "agent_id": "marketplace-buyer-agent",
  "task": "Find 20 project-management tools under $50/user, with current pricing, free-trial links, and a one-line why each fits a 50-person startup. Put everything in our CRM.",
  "max_vendors": 5
}
```

Run: `npm run demo:research`

---

## @Aslan — Nimble

**Ask:** Can Nimble return real text for policy + pricing URLs in [src/lib/nimble.ts](../src/lib/nimble.ts)?

**Kill criterion:** One successful fetch (LinkedIn ToS minimum; Notion terms + pricing ideal).

**Priority URLs:** see URL list in HANDOFF / research-fixtures — start with:

- https://www.linkedin.com/legal/user-agreement
- https://www.notion.so/terms
- https://www.notion.so/pricing

**Handoff to Aarya:** working `fetchPolicyPages(urls)` → Aarya wires call in orchestrator before `runEvaluatePipeline`.

---

## @Candy — Senso

**Ask:** Is `npm run test:senso` green on a dev machine with Policy Guard org key?

**Kill criterion:** LinkedIn content ID returns chunks with score ≥ 0.4; GEO prompt IDs shared for publish.

**Cheat sheet:** [plans/SENSO_INTEGRATION.md](./SENSO_INTEGRATION.md)

---

## @Aarya — API / Vercel / pipeline

**Ask:** Is live path working on Vercel (not demo fixtures)? ClickHouse + `/api/stats`?

**Vercel env vars:**

```
SENSO_API_KEY=...          # Policy Guard org (tgr_...) — from Candy
ANTHROPIC_API_KEY=...
POLICYGUARD_DEMO_MODE=false   # live Senso + LLM path
CLICKHOUSE_URL=...         # optional for stats
```

**Verify:**

```bash
npm run dev
npm run test:senso
POLICYGUARD_DEMO_MODE=true npm run demo
npm run demo:research
curl localhost:3000/api/stats
```

---

## Demo commands (everyone)

```bash
npm install
npm run dev                    # terminal 1 — API :3000
npm run demo                   # 3-action compliance (terminal 2)
npm run demo:research          # PM marketplace task
```

With demo fixtures only: `POLICYGUARD_DEMO_MODE=true`

---

## 3pm freeze checklist

See [HANDOFF.md](./HANDOFF.md) acceptance criteria section.
