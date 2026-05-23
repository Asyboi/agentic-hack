# Team coordination — paste into Slack/Discord

**Repo:** https://github.com/Asyboi/agentic-hack  
**Marketing site:** https://policyguard-site.vercel.app  
**Senso cheat sheet:** [plans/SENSO_INTEGRATION.md](./SENSO_INTEGRATION.md)  
**Full handoff:** [plans/HANDOFF.md](./HANDOFF.md)

---

## @Aslan — x402 (P0, unblock everyone)

**Ask:** Is x402 green on deployed `POST /api/evaluate`? Need one paid request reaching the handler (real Sepolia receipt OR mock with real receipt artifact).

**Kill criterion by 12:30pm:** Green test transaction OR documented mock-mode fallback wired before handler.

**Where to wire:** Middleware on [src/app/api/evaluate/route.ts](../src/app/api/evaluate/route.ts) (see comment in file).

---

## @Kyle — Nimble

**Ask:** Can Nimble return LinkedIn ToS text for one live call into [src/lib/nimble.ts](../src/lib/nimble.ts)?

**Kill criterion:** One successful fetch; optional `senso kb create-raw` for one live-ingest narrative on stage.

---

## @Aarya — API / Vercel / LLM

**Ask:** Is live path working on Vercel (not demo fixtures)?

**Vercel env vars:**

```
SENSO_API_KEY=...          # Policy Guard org (tgr_...)
ANTHROPIC_API_KEY=...
POLICYGUARD_DEMO_MODE=false   # live Senso + LLM path
```

**Verify deployed API:**

```bash
export POLICYGUARD_BASE_URL=https://<your-api-vercel-url>
export POLICYGUARD_DEMO_MODE=false
export POLICYGUARD_SKIP_PUBLISH=true   # optional during testing
npm run demo
```

Expected: `blocked` → `allowed` → `modify_recommended` (live Senso path verified locally on :3000 without `ANTHROPIC_API_KEY`; LLM falls back to rule engine + chunks).

Expect three decisions: `blocked`, `allowed`, `modify_recommended`.

**Read:** [plans/SENSO_INTEGRATION.md](./SENSO_INTEGRATION.md) — drop-in `searchPolicy` helper; **must** use `--require-scoped-ids` with the content IDs in that doc.

---

## Demo command (everyone)

```bash
npm install
npm run dev                    # terminal 1 — API :3000
POLICYGUARD_BASE_URL=http://localhost:3000 npm run demo   # terminal 2
```

With demo fixtures only: `POLICYGUARD_DEMO_MODE=true npm run demo`

---

## 3pm freeze checklist

See [HANDOFF.md](./HANDOFF.md) acceptance criteria section.
