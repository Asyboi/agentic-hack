# PolicyGuard

> A compliance API for AI agents acting on the open web. Returns a verdict for any proposed action, grounded in real site policies, with citations.

**Built at the Agentic Engineering Hackathon (hosted by tokens&), May 23, 2026.**

## Live demo

- **Interactive UI:** run `npm run dev` → open the URL Next prints (often http://localhost:3000), then use the three scenario buttons for live verdicts
- **Live Senso test (no mocks):** `npm run test:senso` with `POLICYGUARD_DEMO_MODE=false` in `.env`
- **Marketing site (source):** [`site/index.html`](site/index.html) → deployed at https://policyguard-site.vercel.app  
  After pulling this repo, set Vercel project **Root Directory** to `site` if redeploying from GitHub.
- **API:** `POST /api/evaluate` (Next.js app in this repo; deploy separately on Vercel)
- **Published on cited.md:** [AI Agent Compliance APIs hub](https://cited.md/software-and-saas/ai-agent-compliance-apis), e.g. [What is PolicyGuard?](https://cited.md/article/what-is-policyguard). URLs are `/article/<slug>`, not `/policy-guard-3480/…`. Manage content in [geo.senso.ai](https://geo.senso.ai).

## What it does

AI agents are taking real actions on the open web. PolicyGuard is a paid HTTP API that agents call *before* they act. Given a proposed action and a target site, PolicyGuard returns a structured compliance decision in one HTTP round-trip:

- **Verdict:** `allowed`, `blocked`, or `modify_recommended`
- **Risk level:** `low`, `medium`, or `high`
- **Matched rules:** programmatic rule IDs the calling agent can pattern-match on
- **Machine instruction:** executable flags (`proceed`, `disable_target_action`, `requires_human_review`)
- **Citation:** URL + quoted passage from the actual policy document
- **Cited.md URL:** every decision is also published as a permanent, agent-discoverable record

Built for agents to call autonomously. Payment, decision, and citation happen in one HTTP round-trip with no human in the loop.

## Demo vs live (not “demo only”)

The **API is real.** Any agent can call `POST /api/evaluate` or `POST /api/research` in production.

| Mode | Env | Behavior |
|------|-----|----------|
| **Demo** | `POLICYGUARD_DEMO_MODE=true` | Canned verdicts when using `x-demo-scenario` or matching demo keys; reliable for stage/video |
| **Live** | `POLICYGUARD_DEMO_MODE=false` + keys | Senso policy chunks → Claude verdict → rule engine → optional cited.md publish → ClickHouse |

```bash
npm run demo              # 3 compliance checks (demo mode)
npm run demo:research     # PM-tools marketplace task (demo mode)
npm run test:senso        # verify Senso CLI + LinkedIn chunks (needs SENSO_API_KEY)
npm run test:nimble       # verify Nimble Extract (needs NIMBLE_API_KEY in .env.local)
npm run clickhouse:init   # create decisions table (needs CLICKHOUSE_URL)
curl localhost:3000/api/stats   # decision counts
```

## Architecture

```
Calling Agent
   ↓ x402 paywall (agent pays autonomously)
PolicyGuard /evaluate
   ↓ Nimble  ← fetches policy page in real time
   ↓ Senso   ← grounds policy text, returns ranked chunks
   ↓ LLM     ← produces structured verdict
   ↓ ClickHouse  ← logs decision with full context
   ↓ Senso publish  → cited.md (public, agent-discoverable corpus)
   ↓
Returns verdict JSON to calling agent
```

## Sponsor tracks (how we used each one)

Built for the **Agentic Engineering Hackathon (tokens&, May 23, 2026)**. PolicyGuard is one API story with four sponsor integrations in a single pipeline: pay → fetch policy → ground in Senso → verdict → log → publish.

### Senso: knowledge base, grounding, and cited.md publish

**Track goal:** Ingest organizational knowledge, ground agent decisions, and **publish** agent-discoverable content (not ingest-only).

| What we did | Where in the repo |
|-------------|-------------------|
| **Org + KB:** Policy Guard org (`policy-guard-3480` in Senso); demo policies pre-ingested (LinkedIn ToS, OpenAI terms, Stripe privacy) with stable `policy_content_id`s | [src/lib/demo-fixtures.ts](src/lib/demo-fixtures.ts), [plans/SENSO_INTEGRATION.md](plans/SENSO_INTEGRATION.md) |
| **Grounding:** `senso search context` scoped to each policy doc before every live verdict | [src/lib/senso.ts](src/lib/senso.ts) → [src/lib/pipeline.ts](src/lib/pipeline.ts) |
| **Publish (prize qualifier):** `senso engine publish` after `/evaluate`; response may include `cited_md_url` when publish succeeds | [src/lib/verdict-publish.ts](src/lib/verdict-publish.ts), [src/lib/senso-cli.ts](src/lib/senso-cli.ts) |
| **GEO corpus:** 3 live articles on cited.md under *Software & SaaS → AI Agent Compliance APIs* | Listed in [src/lib/cited-md-corpus.ts](src/lib/cited-md-corpus.ts) |

**Live cited.md articles (verified):**

- [What is PolicyGuard?](https://cited.md/article/what-is-policyguard)
- [How does PolicyGuard cite policy evidence?](https://cited.md/article/how-does-policyguard-cite-policy-evidence)
- [How does PolicyGuard compare to hardcoded compliance logic?](https://cited.md/article/how-does-policyguard-compare-to-hardcoded-compliance-logic)

Hub: [AI Agent Compliance APIs](https://cited.md/software-and-saas/ai-agent-compliance-apis). Manage drafts and publish in [geo.senso.ai](https://geo.senso.ai). cited.md URLs are `/article/<slug>`, not `/policy-guard-3480/…`.

**Verify locally:**

```bash
# needs SENSO_API_KEY in .env, POLICYGUARD_DEMO_MODE=false
npm run test:senso
```

Optional env for per-scenario publish: `SENSO_GEO_PROMPT_LINKEDIN`, `SENSO_GEO_PROMPT_PRICING`, `SENSO_GEO_PROMPT_EMAIL` (from `senso prompts list`). Set `POLICYGUARD_SKIP_PUBLISH=true` to skip publish during dev.

**Build the KB from Nimble (terms + robots per domain):**

```bash
# needs NIMBLE_API_KEY + SENSO_API_KEY — ~3 min for 8 domains
npm run kb:ingest
npm run kb:ingest -- --only notion_so,linkedin   # subset
npm run kb:list                                  # target keys
```

Writes `policy-content-ids.json` (gitignored). Restart `npm run dev` so `/api/research` scopes Senso search to **per-vendor** Nimble-ingested docs instead of the legacy OpenAI fixture id.

**LLM planner (flexible steps from task text):**

```bash
# .env.local: POLICYGUARD_PLANNER=llm  +  ANTHROPIC_API_KEY=sk-ant-...
npm run demo:research
```

Claude proposes action steps (G2, LinkedIn, vendor pricing, CRM, etc.) from the natural-language task; falls back to the fixed 8-step plan on error. Response includes `planner_mode` and `planner_fallback`.

---

### Nimble: live policy and pricing fetch

**Track goal:** Fetch real web pages (terms, privacy, robots, pricing) so agents are not stuck on stale hardcoded rules.

| What we did | Where in the repo |
|-------------|-------------------|
| **Extract API:** POST to Nimble Web Extract (`markdown` format) for each `policy_urls[]` on the evaluate request | [src/lib/nimble.ts](src/lib/nimble.ts) |
| **Pipeline:** Fetch runs before Senso search; live text can back the verdict when KB chunks are missing | [src/lib/pipeline.ts](src/lib/pipeline.ts) (`nimble_live` mode) |
| **Demo UI:** “Any website” form (Instagram, Calm, OpenAI examples) calls evaluate with user-supplied policy URLs | [src/components/policyguard-demo.tsx](src/components/policyguard-demo.tsx), [src/lib/custom-site.ts](src/lib/custom-site.ts) |
| **Research flow:** Marketplace task plans vendor steps; each step can hit policies via the same evaluate pipeline | [src/lib/research-orchestrator.ts](src/lib/research-orchestrator.ts), `POST /api/research` |

**Verify locally:**

```bash
# needs NIMBLE_API_KEY in .env
npm run test:nimble
```

Without a key, Nimble returns a labeled stub string so the rest of the pipeline still runs.

---

### ClickHouse: decision ledger and analytics

**Track goal:** Log every compliance decision for dashboards, audits, and “which sites get blocked most” analytics.

| What we did | Where in the repo |
|-------------|-------------------|
| **Schema:** `decisions` table: agent, target, action, verdict, risk, matched_rules, cited_md_url, timestamp | [scripts/clickhouse-init.sql](scripts/clickhouse-init.sql) |
| **Write path:** Every `POST /api/evaluate` (and research steps that call evaluate) inserts one row | [src/lib/clickhouse.ts](src/lib/clickhouse.ts) |
| **Read path:** `GET /api/stats` aggregates blocked / allowed / modify counts | [src/app/api/stats/route.ts](src/app/api/stats/route.ts) |

**Verify locally:**

```bash
CLICKHOUSE_URL=https://... npm run clickhouse:init   # once
npm run dev
curl http://localhost:3000/api/stats
```

Without `CLICKHOUSE_URL`, inserts log to the console as `[clickhouse:stub]` so demos still work.

---

### x402: agent-to-agent payment

**Track goal:** Autonomous agents pay per lookup without human checkout. Compliance becomes a metered HTTP primitive.

| What we did | Where in the repo |
|-------------|-------------------|
| **Paywalled route:** `x402-next` middleware on `GET /api/paid-demo` (Base Sepolia, USDC micropayment) | [src/middleware.ts](src/middleware.ts), [src/lib/x402-payment.ts](src/lib/x402-payment.ts), [src/app/api/paid-demo/route.ts](src/app/api/paid-demo/route.ts) |
| **Product narrative:** Primary paid surface is `POST /evaluate` (documented on the marketing site); paywall can be extended to `/evaluate` or `/api/research` the same way as `/api/paid-demo` | [src/app/api/evaluate/route.ts](src/app/api/evaluate/route.ts) |
| **Marketplace demo:** Buyer agent posts a research task; orchestrator runs multiple policy checks (simulates “pay → plan → evaluate vendors”) | `POST /api/research`, `npm run demo:research` |

**Env (see [.env.example](.env.example)):** `X402_PAY_TO`, `X402_PRICE` (default `$0.001`), `X402_NETWORK` (default Base Sepolia `eip155:84532`), `X402_FACILITATOR_URL`. Optional `X402_RESOURCE_URL` when testing through an HTTPS tunnel.

**Try the paywall:**

```bash
npm run dev
# Agent/client must satisfy x402 challenge, then:
curl http://localhost:3000/api/paid-demo
```

---

### End-to-end flow (all sponsors in one request)

```
Calling agent
  → x402 payment (paid-demo today; /evaluate in product story)
  → POST /api/evaluate
       → Nimble: fetch policy_urls (live markdown)
       → Senso: search context on policy_content_id (ranked chunks)
       → LLM + rule engine: structured verdict + citation
       → ClickHouse: log decision row
       → Senso engine publish: optional cited.md /article/… URL on verdict
  → JSON verdict back to agent
```

Research (`POST /api/research`) runs the same evaluate + ClickHouse path once per planned vendor/action step, which is how we demo a **marketplace buyer** using PolicyGuard across many sites in one job.

## Team

- **Kyle:** Marketplace buyer flow + x402 paywall
- **Aslan:** Nimble (live policy + pricing fetch)
- **Candy:** Senso (KB, search, cited.md publish)
- **Aarya:** API core (`/evaluate`, `/research`), pipeline, rule engine, ClickHouse, deploy

## Project plans

See [plans/HANDOFF.md](plans/HANDOFF.md) for the full team handoff doc: verdict schema, 3-action demo flow, Senso integration spec, demo pitch, and acceptance criteria.
