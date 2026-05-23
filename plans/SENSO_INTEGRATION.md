# Senso Integration Cheat Sheet (for Aarya)

Everything you need to wire Senso into PolicyGuard's `/evaluate` pipeline. Written by Candy — DM her if anything is unclear.

## Auth

Senso CLI is installed globally. API key is in `~/.zshrc` as `SENSO_API_KEY` (Policy Guard org, NOT MeloMed).

```bash
echo $SENSO_API_KEY    # should start with tgr_gmhj...
senso whoami           # should print "Organization: Policy Guard"
```

All `senso` commands include `--output json --quiet` to keep stdout machine-parseable.

---

## The 3 demo policies (already ingested)

These are pre-loaded in the `policies-under-evaluation` folder. Use the `content_id` to scope your search to just one policy.

| Demo scenario | Content ID | Source URL |
|---|---|---|
| Action 1: scrape LinkedIn → BLOCKED | `a06ff6b1-a867-4b5f-bc33-aa0be186b6a4` | linkedin.com/legal/user-agreement |
| Action 2: read OpenAI pricing → ALLOWED | `f46f5b14-6286-407f-b09a-abf53a4c53b7` | openai.com/policies/terms-of-use |
| Action 3: store emails in CRM → MODIFY | `43800835-3fce-44e6-b860-c406805b23a8` | stripe.com/privacy |

---

## The one command to call

For each `/evaluate` request, shell out to:

```bash
senso search context "<the agent's proposed action description>" \
  --content-ids "<the content_id of the relevant policy>" \
  --require-scoped-ids \
  --max-results 5 \
  --output json --quiet
```

**`--require-scoped-ids` is critical.** Without it, Senso falls back to the whole KB and may surface PolicyGuard's own self-description docs. With it, you only get chunks from the policy you fetched.

Returns JSON like:
```json
{
  "query": "...",
  "results": [
    {
      "content_id": "...",
      "chunk_text": "the relevant policy text passage",
      "score": 0.65,
      "title": "LinkedIn User Agreement..."
    },
    ...
  ]
}
```

Feed `results[*].chunk_text` into your LLM (Claude/GPT) along with the proposed action and the locked verdict schema. The LLM produces the verdict.

---

## Drop-in TypeScript helper

```typescript
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

interface PolicyChunk {
  content_id: string;
  chunk_text: string;
  score: number;
  title: string;
}

export async function searchPolicy(
  proposedAction: string,
  policyContentId: string,
  maxResults = 5
): Promise<PolicyChunk[]> {
  const cmd = [
    "senso", "search", "context",
    JSON.stringify(proposedAction),
    "--content-ids", policyContentId,
    "--require-scoped-ids",
    "--max-results", String(maxResults),
    "--output", "json",
    "--quiet",
  ].join(" ");

  const { stdout } = await execAsync(cmd, {
    env: { ...process.env, PATH: `${process.env.HOME}/.npm-global/bin:${process.env.PATH}` },
  });

  // Senso prepends header text before the JSON; extract the JSON object
  const match = stdout.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Senso returned no JSON");
  const parsed = JSON.parse(match[0]);
  return parsed.results ?? [];
}
```

Usage:

```typescript
const chunks = await searchPolicy(
  "Scrape 100 profiles from linkedin.com",
  "a06ff6b1-a867-4b5f-bc33-aa0be186b6a4"
);
// Feed chunks into Claude with the verdict-schema prompt
```

---

## After the verdict — publish to cited.md

For the Senso prize qualifier. Run AFTER you have the verdict JSON:

```bash
senso engine publish --data '{
  "geo_question_id": "<a prompt_id matching this query type>",
  "raw_markdown": "# PolicyGuard Decision\n\n**Action:** Scrape LinkedIn profiles\n**Verdict:** BLOCKED\n\n... (full decision record as markdown) ...\n\n---\n*Powered by Senso.*",
  "seo_title": "PolicyGuard: BLOCKED — Scrape LinkedIn profiles",
  "summary": "PolicyGuard blocked an attempted LinkedIn profile scrape due to ToS prohibitions on automated access."
}' --output json --quiet
```

For `geo_question_id`, use one of the 40 prompt IDs already in the org. The closest match for each demo scenario:

| Scenario | Use this prompt_id (or similar) |
|---|---|
| LinkedIn scrape | Search prompts for "How do AI agents stay compliant" or "scrape LinkedIn" |
| Pricing read | "Can my agent read public pricing pages" |
| Email storage | "personal data consent" |

To list prompt IDs: `senso prompts list --output json --quiet`

---

## Quick sanity checks

```bash
# Make sure all 3 demo policies are processed and queryable
senso kb children $(cat /tmp/policies-folder-id.txt) --output json --quiet

# Test that each policy returns relevant chunks
senso search context "scrape LinkedIn profiles" \
  --content-ids a06ff6b1-a867-4b5f-bc33-aa0be186b6a4 \
  --require-scoped-ids --max-results 3 --output json --quiet
```

If chunks come back with `score >= 0.4`, you're in good shape for grounding the verdict.

---

## If Nimble fetches a new policy at runtime

The "real-time" part of the demo says Nimble fetches policies live. If you want each request to fetch + ingest a fresh policy (instead of using the pre-loaded 3):

```bash
# After Nimble returns the policy text:
senso kb create-raw --data "{
  \"title\": \"Live fetch: <site> policy @ <timestamp>\",
  \"text\": \"<nimble-fetched text>\",
  \"kb_folder_node_id\": \"$(cat /tmp/policies-folder-id.txt)\"
}" --output json --quiet
```

Save the returned `content_id` and use it in the subsequent `search context` call.

**Trade-off:** Live ingest adds 5-15s of processing time per request (Senso has to chunk + embed). For the demo, pre-loading the 3 policies and showing one live Nimble fetch (for narrative) is probably the right balance.

---

## Common gotchas

1. **Senso CLI output includes header lines before the JSON.** Always extract the JSON object with a regex/parse — don't `JSON.parse(stdout)` directly.
2. **`--require-scoped-ids` is easy to forget.** Without it, search returns chunks from ALL ingested docs, polluting the verdict context.
3. **Processing time after ingest:** 5-15 seconds before a doc is queryable. If you ingest live, poll `senso kb get <node_id>` and wait for `processing_status: complete`.
4. **The MeloMed org has a separate Senso instance from Policy Guard.** Don't confuse them. `senso whoami` shows which org you're authenticated against.
