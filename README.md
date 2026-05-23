# PolicyGuard

> A compliance API for AI agents acting on the open web. Returns a verdict for any proposed action — grounded in real site policies, with citations.

**Built at the Agentic Engineering Hackathon (hosted by tokens&) — May 23, 2026.**

## Live demo

- **Interactive UI:** run `npm run dev` → open the URL Next prints (often http://localhost:3000) — three scenario buttons → live verdicts
- **Live Senso test (no mocks):** `npm run test:senso` with `POLICYGUARD_DEMO_MODE=false` in `.env`
- **Marketing site (source):** [`site/index.html`](site/index.html) → deployed at https://policyguard-site.vercel.app  
  After pulling this repo, set Vercel project **Root Directory** to `site` if redeploying from GitHub.
- **API:** `POST /api/evaluate` (Next.js app in this repo — deploy separately on Vercel)
- **Published decision corpus:** [cited.md](https://cited.md) (search "policy-guard-3480")

## What it does

AI agents are taking real actions on the open web. PolicyGuard is a paid HTTP API that agents call *before* they act. Given a proposed action and a target site, PolicyGuard returns a structured compliance decision in one HTTP round-trip:

- **Verdict** — `allowed`, `blocked`, or `modify_recommended`
- **Risk level** — `low`, `medium`, or `high`
- **Matched rules** — programmatic rule IDs the calling agent can pattern-match on
- **Machine instruction** — executable flags (`proceed`, `disable_target_action`, `requires_human_review`)
- **Citation** — URL + quoted passage from the actual policy document
- **Cited.md URL** — every decision is also published as a permanent, agent-discoverable record

Built for agents to call autonomously. Payment, decision, and citation happen in one HTTP round-trip with no human in the loop.

## Demo vs live (not “demo only”)

The **API is real** — any agent can call `POST /api/evaluate` or `POST /api/research` in production.

| Mode | Env | Behavior |
|------|-----|----------|
| **Demo** | `POLICYGUARD_DEMO_MODE=true` | Canned verdicts when using `x-demo-scenario` or matching demo keys — reliable for stage/video |
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

## Sponsor tools used

| Tool | Role |
|---|---|
| **Nimble** | Real-time policy page fetching |
| **Senso** | Policy grounding + content generation + publishing to cited.md |
| **ClickHouse** | Decision analytics database |
| **x402** | Agent-to-agent payment rail |

## Team

- **Kyle** — Marketplace buyer flow + x402 paywall
- **Aslan** — Nimble (live policy + pricing fetch)
- **Candy** — Senso (KB, search, cited.md publish)
- **Aarya** — API core (`/evaluate`, `/research`), pipeline, rule engine, ClickHouse, deploy

## Project plans

See [plans/HANDOFF.md](plans/HANDOFF.md) for the full team handoff doc: verdict schema, 3-action demo flow, Senso integration spec, demo pitch, and acceptance criteria.

