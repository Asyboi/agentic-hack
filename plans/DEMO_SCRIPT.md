# 3-minute demo script (rehearsal + backup recording)

**Record by ~2:30pm** as fallback if live demo fails on stage.

## Setup on screen

1. Terminal: `POLICYGUARD_BASE_URL=http://localhost:3000 npm run demo` (or deployed URL)
2. Optional: ClickHouse / Senso GEO tab
3. Browser: https://policyguard-site.vercel.app

## Pitch (read naturally, ~45s)

> AI agents are taking real actions on the open web. Computer Use, Operator, custom scrapers — they hit "am I allowed to do this?" hundreds of times a day. Today nobody checks. Agents get banned. Lawsuits happen.
>
> **PolicyGuard is the public compliance layer for the agentic web.** Watch.

## Live demo (~2 min) — three actions

Run `npm run demo` or call API three times. Narrate each line:

| # | Say | Expect on screen |
|---|-----|------------------|
| 1 | "Sales agent wants to scrape 100 LinkedIn profiles." | `decision: blocked`, `no_bots`, citation from LinkedIn ToS |
| 2 | "Procurement bot reads OpenAI public pricing once." | `decision: allowed`, low risk |
| 3 | "Same agent tries to bulk-store emails in HubSpot." | `decision: modify_recommended`, `requires_human_review: true`, safe alternative |

Point out: **matched_rules** (machine-readable), **machine_instruction** (executable flags), **cited_md_url** (published corpus).

## Close (~15s)

> Every decision is logged and published to cited.md. The corpus compounds — the next agent can cite our prior answer. We're building shared infrastructure for the agentic web, not a policy summarizer.

## Backup recording checklist

- [ ] Full terminal output visible for all 3 scenarios
- [ ] Verdict JSON shows three different `decision` values
- [ ] Mention x402 payment if Aslan has it wired (optional clip)
- [ ] Show https://geo.senso.ai KB briefly (Senso prize)
- [ ] Save video file named `policyguard-demo-backup-2026-05-23.mp4`

## Commands

```bash
npm run dev
# other terminal:
POLICYGUARD_DEMO_MODE=true npm run demo
# live path (needs keys):
POLICYGUARD_DEMO_MODE=false POLICYGUARD_SKIP_PUBLISH=true npm run demo
```
