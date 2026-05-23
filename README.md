# PolicyGuard

> A compliance API for AI agents acting on the open web. Returns a verdict for any proposed action — grounded in real site policies, with citations.

**Built at the Agentic Engineering Hackathon (hosted by tokens&) — May 23, 2026.**

## Live demo

- **Site:** https://policyguard-site.vercel.app
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

- **Candy** — 
- **Kyle** —
- **Aarya** —
- **Aslan** —

## Project plans

See [plans/HANDOFF.md](plans/HANDOFF.md) for the full team handoff doc: verdict schema, 3-action demo flow, Senso integration spec, demo pitch, and acceptance criteria.

