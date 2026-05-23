# policyguard

**Pre-flight compliance for AI agents acting on the open web.**

A paid HTTP API that agents call before they act. One round-trip in, one structured verdict out, grounded in the real policy with a citation an auditor can follow. Built for autonomous agents, payable in USDC, with every decision published as a permanent, citeable record.

**Built at the Agentic Engineering Hackathon (tokens&, May 23 2026)**

---

## The Problem

The agentic web runs on **proposed actions and prayer**, not a shared compliance layer.

* **No machine-readable terms.** ToS, privacy pages, robots.txt, and acceptable-use rules live as PDFs and HTML written for humans. Agents have no structured layer to consult before they act.
* **Stale, hardcoded checks.** Today's "compliance" inside agent frameworks is a hand-written allowlist that drifts the moment a site updates its policy.
* **No shared corpus.** Every agent re-derives the same verdict ("can I scrape LinkedIn?") from scratch, every single time, with no way to cite a prior answer.
* **No audit trail.** When an agent gets banned or sued, nobody can show *what it checked, when it checked, and what the policy said at that moment.*

> *"Anthropic Computer Use shipped. OpenAI Operator shipped. Custom agents are scraping, posting, and transacting every minute. Each one runs into 'wait, am I allowed to do this here?' a hundred times a day, and today nobody is checking."*

---

## The Solution

PolicyGuard gives agents a **single compliance stack** for the open web:

**Agent proposes action → x402 micropayment → live policy fetch → grounded LLM verdict → decision logged → record published to cited.md**

1. **Pay.** Agent satisfies an x402 challenge with USDC on Base Sepolia. No human checkout, no API keys to provision.
2. **Fetch.** Nimble Extract pulls the live policy page (terms, privacy, robots) in real time so the verdict reflects current policy and not a stale cache.
3. **Ground.** Senso `search context` returns ranked policy chunks from a governed knowledge base scoped to the right document.
4. **Decide.** Vercel AI SDK with Zod produces a structured `Verdict` (`allowed`, `blocked`, or `modify_recommended`). A deterministic rule engine merges and overrides the LLM for anything we refuse to leave to a model.
5. **Log + publish.** ClickHouse records every decision. Senso `engine publish` writes the verdict as a permanent article on cited.md so the next agent can cite the prior answer instead of paying again.

**One API. One verdict schema. Four sponsor integrations in a single round-trip.**

---

## Key Features

### Structured verdict schema

The output is built for agents, not humans. Pattern-matchable rules, executable flags, quoted citation:

```json
{
  "decision": "blocked",
  "risk_level": "high",
  "matched_rules": ["no_bots", "no_automated_access"],
  "machine_instruction": {
    "proceed": false,
    "disable_target_action": true,
    "requires_human_review": false,
    "safe_alternative": "Use official API"
  },
  "citation": {
    "source_url": "https://www.linkedin.com/legal/user-agreement",
    "quoted_text": "Use bots or other unauthorized automated methods to access the Services...",
    "policy_section": "Dos and Don'ts"
  },
  "cited_md_url": "https://cited.md/article/what-is-policyguard"
}
```

* `decision` enum: `allowed`, `blocked`, `modify_recommended`
* `risk_level` enum: `low`, `medium`, `high`
* `matched_rules` lets calling agents branch programmatically.
* `machine_instruction` gives executable flags, not prose.
* `cited_md_url` proves the decision was published.

### Three demo scenarios (the verdict spectrum)

| # | Agent intent | Verdict | Why it works |
|---|---|---|---|
| 1 | Scrape 100 LinkedIn profiles | `blocked`, high risk | LinkedIn ToS §8.2 cited word-for-word |
| 2 | Read public OpenAI / Anthropic pricing | `allowed`, low risk | Proves PolicyGuard is not just "block everything" |
| 3 | Bulk-store emails from about-pages in HubSpot | `modify_recommended`, requires human review | Handles ambiguity with a `safe_alternative` |

### x402 paywall (agent-native payments)

* `x402-next` middleware on `GET /api/paid-demo` (Base Sepolia USDC micropayment via the CDP Facilitator).
* `X402_MODE=mock` for teammates without a wallet; `X402_MODE=live` enforces the real paywall and gets the transaction indexed by Bazaar / agentic.market.
* Product narrative extends the paywall to `/api/evaluate` so compliance becomes a metered HTTP primitive.

### Live policy fetch (Nimble)

* `POST /v1/search` to discover policy URLs for a target site.
* `POST /v1/extract` with `{ url, render: false }` to pull clean markdown.
* Live fetch runs **before** Senso grounding so a verdict on Instagram today reflects Instagram's terms today.
* "Any website" form in the demo UI (Instagram, Calm, OpenAI examples) lets a judge type a URL and watch the pipeline run end-to-end.

### Grounding + publish (Senso)

* Pre-ingested LinkedIn ToS, OpenAI terms, and Stripe privacy in the **Policy Guard** Senso org (`policy-guard-3480`), each with a stable `policy_content_id`.
* `senso search context` returns ranked chunks scoped to the right document. We deliberately avoid `senso search` (without `context`) because that adds Senso's own AI answer; we want raw chunks for our own verdict.
* After every verdict, `senso engine publish` writes a citeable to cited.md under **Software & SaaS → AI Agent Compliance APIs**.
* Five live articles already published on the hub.

### Decision ledger (ClickHouse)

* `decisions` table: agent, target, action, verdict, risk, matched_rules, cited_md_url, timestamp.
* Every `POST /api/evaluate` (and every research step that calls evaluate) inserts one row.
* `GET /api/stats` aggregates blocked / allowed / modify counts.
* No `CLICKHOUSE_URL`? Inserts log to console as `[clickhouse:stub]` so demos still work.

### Research orchestrator (marketplace buyer flow)

* `POST /api/research` plans a multi-vendor task ("evaluate 5 PM tools for our procurement policy"), then runs the evaluate pipeline once per vendor.
* One row per vendor lands in ClickHouse, so a single research job produces a fan-out audit trail.

### Agent live UI

* Marketing site plus interactive demo at [src/components/policyguard-demo.tsx](src/components/policyguard-demo.tsx).
* Three scenario buttons for canonical demos.
* "Any website" form for live Nimble + Senso path.
* Verdict cards show `decision`, `risk_level`, `matched_rules`, `machine_instruction`, the quoted citation, and a link to the cited.md article.

### Degraded modes (designed in, not bolted on)

| External dependency | Failure mode | Fallback |
|---|---|---|
| x402 Base Sepolia | Faucet rate-limit, RPC flake | `X402_MODE=mock` returns identical response shape |
| Nimble | No API key, target site blocked | Labeled stub string so the rest of the pipeline runs |
| Senso | No API key, CLI unreachable | `POLICYGUARD_DEMO_MODE=true` returns deterministic fixtures |
| ClickHouse | No `CLICKHOUSE_URL` | `[clickhouse:stub]` log line, no insert |
| LLM | `ANTHROPIC_API_KEY` missing | Rule engine returns a verdict on rules alone |

Demo mode is a first-class architectural feature, not an emergency patch. The stage path is bulletproof.

---

## Architecture

```
                    Calling agent
                         │
                         ▼
           ┌──────────────────────────────┐
           │  x402 paywall (Base Sepolia) │
           │   USDC micropayment          │
           └──────────────┬───────────────┘
                          │
                          ▼
              POST /api/evaluate (Next.js)
                          │
        ┌─────────────────┼───────────────────┐
        ▼                 ▼                   ▼
   ┌─────────┐      ┌──────────┐       ┌────────────┐
   │ Nimble  │      │  Senso   │       │ Vercel AI  │
   │ extract │ ───► │ context  │ ────► │ + Zod      │
   │ + search│      │  chunks  │       │ generateObj│
   └─────────┘      └──────────┘       └─────┬──────┘
                                             │
                                             ▼
                                  ┌────────────────────┐
                                  │  Rule engine (TS)  │
                                  │  override + merge  │
                                  └─────────┬──────────┘
                                            │
                          ┌─────────────────┼─────────────────┐
                          ▼                 ▼                 ▼
                   ┌───────────┐     ┌────────────┐    ┌───────────────┐
                   │ClickHouse │     │  Senso     │    │ Verdict JSON  │
                   │ decisions │     │  publish   │    │   to caller   │
                   │   table   │     │ → cited.md │    └───────────────┘
                   └───────────┘     └────────────┘
```

**Integrations (all env-driven, all degrade gracefully):** Anthropic · Vercel AI SDK · Senso CLI · Nimble · ClickHouse · x402 (Coinbase CDP Facilitator).

---

## Tech Stack

### Frontend

| Technology | Purpose |
|---|---|
| Next.js 15 (App Router) | Marketing site + demo UI + API in one repo |
| React 19 | Demo UI |
| TypeScript | Type safety end-to-end |
| CSS Modules | Component styling (`policyguard-demo.module.css`, `agent-live.module.css`) |

### Backend / API

| Technology | Purpose |
|---|---|
| Next.js Route Handlers | `/api/evaluate`, `/api/research`, `/api/paid-demo`, `/api/stats`, `/api/agent-run`, `/api/status` |
| Vercel AI SDK (`ai`) | `generateObject` with Zod schemas for the verdict |
| Zod | Request and verdict schema validation |
| Plain TS rule engine | Deterministic `matched_rules` + override logic |
| `tsx` | Dev harness for demo scripts |

### AI, data, and external APIs

| Technology | Purpose |
|---|---|
| **Anthropic** (`@ai-sdk/anthropic`) | Verdict generation against grounded chunks |
| **Senso CLI** | Knowledge base, `search context`, `engine publish` to cited.md |
| **Nimble** (`api.webit.live/api/v1/...`) | Live `extract` + `search` for policy pages |
| **ClickHouse** (`@clickhouse/client`) | Decision ledger and `/api/stats` aggregation |
| **x402** (`@coinbase/x402`, `x402-next`, `@x402/core`, `@x402/evm`, `@x402/extensions`) | HTTP 402 paywall, Base Sepolia, USDC |

Variable names only. See [.env.example](.env.example). **Never commit real keys.**

---

## Installation & Setup

### Prerequisites

* **Node.js 20+** and npm
* **Git**
* (Optional) **Senso CLI** installed globally (`npm i -g @senso-ai/cli`) for live grounding and publish
* (Optional) Anthropic, Nimble, ClickHouse, and x402 credentials for the full live path

### Quick start

```bash
git clone https://github.com/Asyboi/agentic-hack.git
cd agentic-hack

npm install
cp .env.example .env
# Edit .env locally. Do not commit secrets.

npm run dev
# UI + API: http://localhost:3000
```

### Demo without any keys

The default `.env` ships with `POLICYGUARD_DEMO_MODE=true` and `X402_MODE=mock`, so you can run the full demo with zero credentials:

```bash
npm run demo            # 3 compliance checks (demo fixtures)
npm run demo:research   # PM-tools marketplace task (demo fixtures)
```

### Live path (one or more keys)

```bash
# In .env, flip:
POLICYGUARD_DEMO_MODE=false

# Verify each integration in isolation:
npm run test:senso      # needs SENSO_API_KEY
npm run test:senso:live # full live Senso path
npm run test:nimble     # needs NIMBLE_API_KEY
npm run nimble:sample   # save a Nimble fixture for offline dev

# ClickHouse table bootstrap:
CLICKHOUSE_URL=https://... npm run clickhouse:init

# Stats endpoint:
curl http://localhost:3000/api/stats
```

### Try the x402 paywall

```bash
# In .env:
X402_MODE=live

npm run dev
# Agent / client must satisfy the x402 challenge first:
curl http://localhost:3000/api/paid-demo
```

---

## Project Structure

```
agentic-hack/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── api/
│   │       ├── evaluate/route.ts     # Primary verdict endpoint
│   │       ├── research/route.ts     # Marketplace buyer / fan-out
│   │       ├── paid-demo/route.ts    # x402 paywalled demo route
│   │       ├── agent-run/route.ts    # Agent live UI driver
│   │       ├── status/route.ts       # Lightweight health
│   │       └── stats/route.ts        # ClickHouse aggregates
│   ├── components/
│   │   ├── policyguard-demo.tsx      # Three-scenario + "any website" UI
│   │   └── agent-live.tsx            # Live agent demo
│   ├── lib/
│   │   ├── schemas/                  # Zod request + verdict
│   │   ├── pipeline.ts               # Orchestration harness
│   │   ├── rule-engine.ts            # Deterministic matched_rules
│   │   ├── verdict-llm.ts            # Vercel AI SDK generateObject
│   │   ├── verdict-publish.ts        # cited.md publish wrapper
│   │   ├── senso.ts                  # Senso CLI integration
│   │   ├── senso-cli.ts              # Low-level CLI runner
│   │   ├── nimble.ts                 # Nimble extract + search
│   │   ├── clickhouse.ts             # Decision ledger insert
│   │   ├── x402-payment.ts           # Paywall config
│   │   ├── demo-fixtures.ts          # Three canonical scenarios
│   │   ├── research-fixtures.ts      # PM-tools marketplace task
│   │   ├── research-orchestrator.ts  # Multi-vendor evaluate fan-out
│   │   ├── planner.ts                # Step planning helpers
│   │   ├── custom-site.ts            # "Any website" handler
│   │   ├── agent.ts                  # Live agent loop
│   │   └── cited-md-corpus.ts        # Live cited.md article registry
│   └── middleware.ts                 # x402-next middleware mount
├── scripts/
│   ├── demo-three-actions.ts         # 3-scenario harness
│   ├── demo-research.ts              # Marketplace harness
│   ├── agent-demo.ts                 # Live agent CLI
│   ├── test-senso.ts                 # Senso smoke test
│   ├── test-live-senso.ts            # Full live Senso path
│   ├── test-nimble.ts                # Nimble smoke test
│   ├── save-nimble-sample.ts         # Capture a Nimble fixture
│   ├── init-clickhouse.ts            # Run clickhouse-init.sql
│   ├── clickhouse-init.sql           # `decisions` table DDL
│   └── load-env-local.ts             # .env.local loader
├── site/
│   └── index.html                    # Marketing site (deployed to Vercel)
├── plans/
│   ├── HANDOFF.md                    # Team handoff (verdict schema, demo, owners)
│   ├── STACK.md                      # Stack decisions
│   ├── DEMO_SCRIPT.md                # 3-min stage script
│   ├── SENSO_INTEGRATION.md          # Senso CLI call patterns
│   └── TEAM_COORDINATION.md          # Owners + P0 tasks
├── .env.example
├── next.config.ts
├── tsconfig.json
└── README.md
```

---

## API Overview

Base URL: `{origin}/api` (local: `http://localhost:3000/api`).

| Area | Endpoint | Purpose |
|---|---|---|
| **Evaluate** | `POST /api/evaluate` | Primary verdict. Body: `{ agent, action, target_site, policy_urls?, policy_content_id? }`. Returns the verdict JSON. |
| **Research** | `POST /api/research` | Marketplace fan-out. Plans vendor steps, runs `evaluate` per step, logs each to ClickHouse. |
| **Paywalled demo** | `GET /api/paid-demo` | x402 challenge + USDC settlement (Base Sepolia). |
| **Stats** | `GET /api/stats` | ClickHouse aggregates: blocked / allowed / modify counts. |
| **Agent run** | `POST /api/agent-run` | Drives the live agent UI through a scenario. |
| **Status** | `GET /api/status` | Lightweight health and feature-flag report. |

### Request example

```bash
curl -X POST http://localhost:3000/api/evaluate \
  -H 'Content-Type: application/json' \
  -H 'x-demo-scenario: linkedin-scrape' \
  -d '{
    "agent": "sales-bot-v1",
    "action": "Scrape 100 profiles matching software engineer",
    "target_site": "linkedin.com",
    "policy_urls": ["https://www.linkedin.com/legal/user-agreement"]
  }'
```

### Demo vs live (not "demo only")

| Mode | Env | Behavior |
|---|---|---|
| **Demo** | `POLICYGUARD_DEMO_MODE=true` | Canned verdicts when `x-demo-scenario` or a matching demo key is present. Reliable for stage and video. |
| **Live** | `POLICYGUARD_DEMO_MODE=false` + keys | Senso chunks plus Claude verdict, run through rule engine, optional cited.md publish, ClickHouse insert. |

---

## Demo Data Highlights (seeded)

Illustrative values from the bundled fixtures and live cited.md corpus:

| Metric | Demo value | Context |
|---|---|---|
| Demo scenarios | 3 canonical + N custom | LinkedIn scrape, OpenAI pricing read, HubSpot email store |
| Live cited.md articles | 5 | "AI Agent Compliance APIs" hub |
| Sponsor integrations | 4 in one pipeline | x402, Nimble, Senso, ClickHouse |
| Pre-ingested policy docs | 3 | LinkedIn ToS, OpenAI terms, Stripe privacy |
| Rule IDs in the engine | ~12 | `no_bots`, `no_automated_access`, `personal_data_consent_required`, etc. |
| Verdict types | 3 | `allowed`, `blocked`, `modify_recommended` |
| Risk levels | 3 | `low`, `medium`, `high` |

---

## Key Workflows

1. **Run the 3-action demo.** `npm run demo` (or click the three scenario buttons in the demo UI). One BLOCKED, one ALLOWED, one MODIFY_RECOMMENDED, with verdict JSON visible in the terminal.
2. **Evaluate any site.** In the demo UI, paste a URL into the "Any website" form. Nimble fetches the page, Senso grounds it, the verdict pipeline returns a decision.
3. **Run a marketplace research task.** `npm run demo:research` plans vendor steps and runs `evaluate` per vendor, with one ClickHouse row per step.
4. **Pay for a verdict.** `X402_MODE=live npm run dev`, then `curl http://localhost:3000/api/paid-demo` from any x402-aware client. The pipeline returns a verdict only after USDC settlement on Base Sepolia.
5. **Cite a prior answer.** Open the cited.md hub at [AI Agent Compliance APIs](https://cited.md/software-and-saas/ai-agent-compliance-apis). Any agent can fetch a verdict from there instead of paying for a fresh lookup.

---

## Verdict Schema (the locked contract)

`/api/evaluate` always returns this shape:

```ts
type Verdict = {
  decision: 'allowed' | 'blocked' | 'modify_recommended';
  risk_level: 'low' | 'medium' | 'high';
  reason: string; // 1 to 2 sentence human summary
  matched_rules: string[]; // pattern-matchable rule IDs
  machine_instruction: {
    proceed: boolean;
    disable_target_action: boolean;
    requires_human_review: boolean;
    safe_alternative?: string;
  };
  citation: {
    source_url: string;
    quoted_text: string;
    policy_section: string;
    fetched_at: string; // ISO-8601
  };
  cited_md_url?: string; // present when publish succeeded
};
```

**Why this schema:** `matched_rules` lets calling agents branch programmatically (not just read LLM prose). `machine_instruction` gives the agent direct executable flags. `cited_md_url` proves the decision was published.

---

## Sponsor Tracks (how we used each one)

PolicyGuard is one API story with four sponsor integrations in a single pipeline: **pay → fetch policy → ground in Senso → verdict → log → publish.**

### Senso: knowledge base, grounding, and cited.md publish

* **Org + KB:** Policy Guard org (`policy-guard-3480`); demo policies pre-ingested with stable `policy_content_id`s. See [src/lib/demo-fixtures.ts](src/lib/demo-fixtures.ts) and [plans/SENSO_INTEGRATION.md](plans/SENSO_INTEGRATION.md).
* **Grounding:** `senso search context` scoped per document, called before every live verdict. See [src/lib/senso.ts](src/lib/senso.ts) and [src/lib/pipeline.ts](src/lib/pipeline.ts).
* **Publish (prize qualifier):** `senso engine publish` after `/evaluate`; response may include `cited_md_url`. See [src/lib/verdict-publish.ts](src/lib/verdict-publish.ts).
* **GEO corpus:** 5 live articles on cited.md under *Software & SaaS → AI Agent Compliance APIs*. See [src/lib/cited-md-corpus.ts](src/lib/cited-md-corpus.ts).

**Live articles:** [What is PolicyGuard?](https://cited.md/article/what-is-policyguard) · [How does PolicyGuard cite policy evidence?](https://cited.md/article/how-does-policyguard-cite-policy-evidence) · [How does PolicyGuard compare to hardcoded compliance logic?](https://cited.md/article/how-does-policyguard-compare-to-hardcoded-compliance-logic) · plus development status and GitHub repo articles.

### Nimble: live policy and pricing fetch

* `POST /v1/search` to find policy pages, `POST /v1/extract` with `{ url, render: false }` for full text on each `policy_urls[]` entry. See [src/lib/nimble.ts](src/lib/nimble.ts).
* Fetch runs before Senso search; live text can back the verdict when KB chunks are missing (`nimble_live` mode).
* "Any website" form in the demo UI calls evaluate with user-supplied policy URLs.

### ClickHouse: decision ledger and analytics

* `decisions` table (see [scripts/clickhouse-init.sql](scripts/clickhouse-init.sql)): agent, target, action, verdict, risk, matched_rules, cited_md_url, timestamp.
* Write path: every `POST /api/evaluate` inserts one row. See [src/lib/clickhouse.ts](src/lib/clickhouse.ts).
* Read path: `GET /api/stats` aggregates counts. See [src/app/api/stats/route.ts](src/app/api/stats/route.ts).

### x402: agent-to-agent payment

* Paywalled route `GET /api/paid-demo` via `x402-next` middleware. See [src/middleware.ts](src/middleware.ts), [src/lib/x402-payment.ts](src/lib/x402-payment.ts).
* `X402_MODE=mock` for dev, `X402_MODE=live` for the real Base Sepolia USDC paywall.
* Marketplace demo: `POST /api/research` runs the same evaluate path per vendor, simulating "pay once, evaluate many."

---

## Deployment

### Vercel (full stack)

* Repo is a standard Next.js 15 App Router project. `next build` and Vercel auto-detect work out of the box.
* Set environment variables in **Vercel Project Settings → Environment Variables**, using the same names as [.env.example](.env.example).
* For the marketing-site-only deploy, set **Root Directory** to `site` in the Vercel project settings.
* Live site (placeholder): https://policyguard-site.vercel.app

### x402 in production

* `X402_MODE=live` requires:
  * `X402_PAY_TO` (your receiving wallet address on Base Sepolia)
  * `X402_PRICE` (default `$0.001`)
  * `X402_NETWORK` (default `eip155:84532`)
  * `X402_FACILITATOR_URL` (default `https://x402.org/facilitator`)
* When testing through an HTTPS tunnel, set `X402_RESOURCE_URL` to the public origin.

### ClickHouse

* Use ClickHouse Cloud or a self-hosted instance; set `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`, `CLICKHOUSE_DATABASE`.
* Run `npm run clickhouse:init` once to create the `decisions` table.

---

## Further Reading

| Doc | Purpose |
|---|---|
| [plans/HANDOFF.md](plans/HANDOFF.md) | Team handoff: verdict schema, 3-action demo, owners, acceptance criteria |
| [plans/STACK.md](plans/STACK.md) | Stack decisions and "do not use for MVP" list |
| [plans/DEMO_SCRIPT.md](plans/DEMO_SCRIPT.md) | 3-minute stage script and backup recording checklist |
| [plans/SENSO_INTEGRATION.md](plans/SENSO_INTEGRATION.md) | Senso CLI call patterns for `/evaluate` |
| [plans/TEAM_COORDINATION.md](plans/TEAM_COORDINATION.md) | Owners, P0 tasks, and risk register |
| [.env.example](.env.example) | All environment variables with inline notes |

---

## SDG Alignment

* **SDG 9 (Industry, Innovation, Infrastructure).** Public compliance infrastructure for the agentic web.
* **SDG 16 (Peace, Justice, Strong Institutions).** Transparent, citeable decision records replace opaque allowlists; every verdict is auditable.
* **SDG 17 (Partnerships).** One API stitches four sponsor ecosystems (Coinbase x402, Senso, Nimble, ClickHouse) into a shared corpus any agent can build on.

---

## Built With

`next.js` · `react` · `typescript` · `zod` · `vercel-ai-sdk` · `@ai-sdk/anthropic` · `@clickhouse/client` · `@coinbase/x402` · `x402-next` · `@x402/core` · `@x402/evm` · `@x402/extensions` · `x402-fetch` · `senso` · `cited.md` · `nimble` · `base-sepolia` · `usdc` · `vercel` · `tsx`

---

## Team

**Built at the Agentic Engineering Hackathon (tokens&, NYC, May 23 2026).**

| Person | Owns |
|---|---|
| **Aslan** | x402 paywall + Base Sepolia wallet |
| **Kyle** | Marketplace buyer flow + Nimble policy fetch |
| **Aarya** | API core (`/evaluate`, `/research`), pipeline, rule engine, ClickHouse, deploy |
| **Candy** | Senso integration (KB, search, cited.md publish), demo coordination |

---

## License

No `LICENSE` file is present in this repository root yet. Add one (e.g. MIT, Apache-2.0, or hackathon-specific terms) before public distribution.

---

## Acknowledgments

* **tokens&** for hosting the Agentic Engineering Hackathon and assembling the sponsor stack.
* **Coinbase Developer Platform** for the x402 protocol, CDP Facilitator, and Base Sepolia.
* **Senso.ai** for the context platform, the `engine publish` flow, and the cited.md endpoint that lets verdicts outlive the demo.
* **Nimble** for live web extraction that turns any URL into clean policy text.
* **ClickHouse** for the decision ledger that makes audit a one-liner.
* **Anthropic** for the model that drives `generateObject` against grounded chunks.
* **DeepMind, Datadog, Luminai** and the rest of the hackathon partner stack.

---

**Every unchecked agent action is a compliance failure. PolicyGuard turns "am I allowed to do this here?" into a single HTTP round-trip with a citation.**

Questions or issues? Open an issue on [Asyboi/agentic-hack](https://github.com/Asyboi/agentic-hack).
Also live at https://policyguard-site.vercel.app
