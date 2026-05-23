# PolicyGuard — Team Handoff

**Date:** May 23, 2026 — Agentic Engineering Hackathon (hosted by tokens&)
**Build window:** 11:00am - 4:30pm ET (5.5 hours)
**Hard feature freeze:** 3:00pm ET
**Submission cutoff:** 4:30pm ET
**GitHub repo:** https://github.com/Asyboi/agentic-hack.git
**Public site:** https://policyguard-site.vercel.app

---

## What's Done (don't redo)

| Layer | Status | Notes |
|---|---|---|
| Placeholder site | LIVE | https://policyguard-site.vercel.app (deployed to Vercel, deployment protection off) |
| Senso org configured | DONE | Org name: "Policy Guard". 13 KB docs, 40 tracking prompts, 40 drafts, 3 citeables published to cited.md |
| Senso prize qualifier | MET | 3 citeables live at cited.md — Senso requires "publish, not just ingest" |
| GEO monitoring | RUNNING | 4 models (chatgpt, claude, perplexity, gemini), Mon/Wed/Fri schedule |
| LinkedIn ToS pre-ingested | DONE | Available in MeloMed org under `agentic-eng-hack` folder. May want to re-ingest into Policy Guard org if needed for live demo. |
| Heal report | FILED | `/build-logs/` folder, 16/18 search probes Strong |

---

## Owners

| Person | Owns | P0 task |
|---|---|---|
| **Aslan** | x402 paywall + Base Sepolia wallet | Get one green x402 test transaction by 12:30pm. Build mock-mode fallback BEFORE attempting real flow. |
| **Kyle** | Nimble policy fetcher | Pair with Aslan on x402 first 90 min, then own Nimble integration |
| **Aarya** | Vercel AI SDK + agent framework + verdict generation | Stub `/evaluate` endpoint with fake verdicts by 12:00pm. Then fill in tool calls. |
| **Candy** | Senso integration | DONE — see "Senso integration" section below. Now: coordinate + demo prep. |

---

## The Locked Verdict Schema (Aarya — build to this)

PolicyGuard's `/evaluate` endpoint returns this JSON. Machine-readable for agents, not narrative prose.

```json
{
  "decision": "blocked",
  "risk_level": "high",
  "reason": "Short human-readable explanation (1-2 sentences)",
  "matched_rules": [
    "no_bulk_automated_collection",
    "no_profile_storage_for_commercial_use"
  ],
  "machine_instruction": {
    "proceed": false,
    "disable_target_action": true,
    "requires_human_review": false,
    "safe_alternative": "Use official API"
  },
  "citation": {
    "source_url": "https://www.linkedin.com/legal/user-agreement",
    "quoted_text": "Use bots or other unauthorized automated methods to access the Services...",
    "policy_section": "Dos and Don'ts",
    "fetched_at": "2026-05-23T15:30:00Z"
  },
  "cited_md_url": "https://cited.md/policy-guard-3480/<decision-slug>"
}
```

**`decision` enum:** `"allowed" | "blocked" | "modify_recommended"`
**`risk_level` enum:** `"low" | "medium" | "high"`

**Why this schema:** `matched_rules` lets calling agents pattern-match programmatically (not just read LLM prose). `machine_instruction` gives the agent direct executable flags. `cited_md_url` proves the decision was published.

---

## The 3-Action Demo (build around these)

**3 minutes total. Three actions = one BLOCKED, one ALLOWED, one MODIFY_RECOMMENDED.**

Single scenarios feel like "did it work?" Three scenarios show breadth, judgment, and the spectrum of decisions.

### Action 1: Scrape LinkedIn profiles → BLOCKED
- **Agent intent:** "Scrape 100 profiles from linkedin.com matching 'software engineer'"
- **Verdict:** `blocked`, risk `high`
- **Matched rules:** `["no_bots", "no_automated_access"]`
- **Citation:** LinkedIn User Agreement §8 ("Use bots or other unauthorized automated methods...")
- **Why it works:** Visceral, recognizable, real legal risk

### Action 2: Read public pricing pages → ALLOWED
- **Agent intent:** "Read pricing pages from openai.com/api/pricing and anthropic.com/pricing"
- **Verdict:** `allowed`, risk `low`
- **Matched rules:** `[]` (no prohibition found)
- **Citation:** robots.txt allows + no terms prohibition on automated reading of public pricing
- **Why it works:** Shows PolicyGuard isn't just "block everything" — it allows legitimate reads

### Action 3: Store user emails in CRM → MODIFY_RECOMMENDED
- **Agent intent:** "Extract emails from these 50 company about-pages and store them in HubSpot"
- **Verdict:** `modify_recommended`, risk `high`
- **Matched rules:** `["personal_data_consent_required", "commercial_reuse_restricted"]`
- **`machine_instruction.requires_human_review: true`**
- **Safe alternative:** "Use opt-in form or compliant enrichment API (Clearbit, Apollo)"
- **Why it works:** Shows the third verdict type AND that PolicyGuard handles ambiguity

---

## Senso Integration (Aarya — how to call Senso from `/evaluate`)

### From PolicyGuard's pipeline, the Senso call is one CLI invocation per request:

```bash
# Returns ranked policy chunks for grounding (no LLM synthesis added)
senso search context "<agent's intended action description>" \
  --max-results 5 \
  --output json --quiet
```

Returns JSON with `results[]` containing `chunk_text`, `score`, `content_id`. Feed these chunks + the proposed action into Claude/GPT for verdict generation.

**Don't use `senso search` (without `context`)** — that adds Senso's own AI answer, which we don't want for our own verdict generation.

### After each verdict, publish to cited.md (Senso prize)

```bash
senso engine publish --data '{
  "geo_question_id": "<prompt_id for this query type>",
  "raw_markdown": "<formatted decision record with citation>",
  "seo_title": "PolicyGuard: <verdict> for <short action description>",
  "summary": "<one-sentence summary>"
}' --output json --quiet
```

Publishes to cited.md (the configured default destination). Every verdict becomes a permanent, agent-discoverable record.

### Senso auth

API key is in `~/.zshrc` as `SENSO_API_KEY` (Policy Guard org key, NOT the MeloMed one). CLI is installed globally via `~/.npm-global/bin`. Any shell that sources `.zshrc` will have it.

---

## Demo Pitch (3 minutes)

> "AI agents are taking real actions on the open web. Anthropic Computer Use shipped. OpenAI Operator shipped. Custom agents are scraping, posting, transacting every minute. Each one runs into 'wait, am I allowed to do this here?' a hundred times a day — and today nobody is checking. Agents get banned. Lawsuits happen.
>
> **PolicyGuard is the public compliance layer for the agentic web.** Watch."

**[LIVE Action 1]:** Client agent autonomously pays via x402 → PolicyGuard fetches LinkedIn ToS via Nimble → Senso grounds the chunks → LLM returns BLOCKED with citation → decision logged to ClickHouse → published to cited.md

**[LIVE Action 2]:** Same agent asks about public pricing → ALLOWED, no restrictions

**[LIVE Action 3]:** Same agent asks about storing emails → MODIFY_RECOMMENDED, requires_human_review: true, safe alternative cited

**[Closing line]:**
> "Every decision becomes a permanent, citeable record on cited.md. The corpus compounds. The next agent that asks the same question doesn't pay again — it cites our prior answer. We're not building an API. We're building shared infrastructure for the agentic web."

---

## Risks (monitor these)

| Risk | Trigger | Mitigation |
|---|---|---|
| x402 unfamiliar to team | Stuck > 90 min on testnet | Fall back to recorded real transaction + mock-mode handshake |
| Demo machine flakes on stage | Live demo fails | Record full demo as video by 2:30pm, run as fallback |
| ClickHouse not set up | Nobody owns it | Aarya spins up Cloud instance during Senso integration |
| Tool count below 3 | ClickHouse logging slips | ClickHouse logging is P0, not P3 — at minimum log one row per decision |
| Scope creep past 3pm | Anyone adds new features | HARD FREEZE at 3pm. Anything not working at 3pm gets cut. |

---

## Acceptance criteria for "ready to demo" by 3pm

- [ ] x402 working end-to-end (real OR mocked-with-real-receipt)
- [ ] `/evaluate` endpoint returns verdict JSON matching the locked schema
- [ ] Three scenarios produce three different verdict types (blocked / allowed / modify)
- [ ] Senso `search context` returns relevant chunks for each scenario
- [ ] ClickHouse logs at least the three demo decisions
- [ ] At least one decision published to cited.md (Senso prize)
- [ ] Flow visible to audience — either via ClickHouse dashboard or live API responses on screen
- [ ] Demo recording saved as backup

---

## What's submitted

- GitHub repo: https://github.com/Asyboi/agentic-hack.git
- Devpost submission: 3-min demo video + 1-paragraph description
- Public site: https://policyguard-site.vercel.app
- cited.md citeables: 3 already published, more will publish during the build
