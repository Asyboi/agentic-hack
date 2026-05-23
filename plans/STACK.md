# PolicyGuard — Stack & harness (Aarya)

## Recommended stack (locked for hackathon)

| Layer | Choice | Why |
|-------|--------|-----|
| Language | **TypeScript** | Team handoff, Senso CLI, Vercel deploy, shared types with frontend |
| API | **Next.js 15 App Router** (`/api/evaluate`) | Already on Vercel; one repo for API + demo UI |
| Agent / LLM | **Vercel AI SDK** + `generateObject` + Zod | Structured verdict JSON; your assigned owner task |
| Validation | **Zod** | Request + verdict schemas match HANDOFF.md |
| Rule engine | **Plain TypeScript** (`src/lib/rule-engine.ts`) | Deterministic, demo-friendly, no Rete/JSON Rules overhead |
| Policy grounding | **Senso CLI** (`senso search context`) | Pre-ingested demo policies + publish to cited.md |
| Fetch | **Nimble** (Aslan → `src/lib/nimble.ts`) | Live policy pages for narrative |
| Analytics | **ClickHouse** (`@clickhouse/client` when wired) | Decision ledger |
| Payments | **x402** (Aslan → middleware on `/evaluate`) | Agent-to-agent paywall |
| Demo harness | **`scripts/demo-three-actions.ts`** | Reproducible 3-scenario demo without UI clicks |

### Do not use for MVP

- **Python** — splits the team; Senso/x402 examples are TS-friendly
- **LangChain / CrewAI** — too much boilerplate for 5.5 hours
- **Separate FastAPI + Next** — two deploys unless API must leave Vercel

## Repo layout

```
src/
  app/api/evaluate/route.ts   # HTTP entry (x402 wraps here)
  lib/
    schemas/                  # Zod: request + verdict
    rule-engine.ts            # Deterministic matched_rules
    pipeline.ts               # Orchestration harness
    senso.ts                  # CLI integration
    verdict-llm.ts            # AI SDK generateObject
    nimble.ts                 # Kyle
    clickhouse.ts             # Log stub
    demo-fixtures.ts          # 3 demo scenarios
scripts/
  demo-three-actions.ts       # Run all 3 verdict types
```

## Pipeline (harness mental model)

```
POST /evaluate
  → parse EvaluateRequest (Zod)
  → pipeline.runEvaluatePipeline()
       → [Nimble] fetch policy_urls (optional live)
       → [Senso] search context → chunks
       → [LLM] generateObject → Verdict draft
       → [Rule engine] merge / override decision + matched_rules
       → [ClickHouse] log row
       → [Senso publish] cited.md (async ok)
  → return Verdict JSON
```

**Demo mode:** `POLICYGUARD_DEMO_MODE=true` returns deterministic fixtures (no API keys).

## Commands

```bash
cp .env.example .env.local
npm install
npm run dev          # API on :3000
npm run demo         # 3 scenarios
```

## Your integration order (today)

1. ✅ Stub `/evaluate` + demo harness (done)
2. Wire Senso `searchPolicy` in pipeline (flip `skipSenso` off)
3. Add `ANTHROPIC_API_KEY` for live LLM verdicts
4. Merge rule engine output with LLM (already sketched in pipeline)
5. ClickHouse insert one table `decisions`
6. Kyle: x402 + marketplace on `/api/research`
7. Aslan: Nimble fetch → optional `senso kb create-raw` for one live path (with Candy)
