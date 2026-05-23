import { anthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import type { EvaluateRequest } from "@/lib/schemas/evaluate-request";
import { verdictSchema, type Verdict } from "@/lib/schemas/verdict";
import type { PolicyChunk } from "@/lib/senso";

export async function generateVerdictFromChunks(
  request: EvaluateRequest,
  chunks: PolicyChunk[]
): Promise<Verdict> {
  const context = chunks
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.chunk_text}`)
    .join("\n\n---\n\n");

  const { object } = await generateObject({
    model: anthropic("claude-sonnet-4-20250514"),
    schema: verdictSchema,
    prompt: `You are PolicyGuard, a policy guidance layer for AI agents (not legal advice).

Proposed action:
${JSON.stringify(request.intended_action, null, 2)}

Target: ${request.target.name} (${request.target.domain ?? "unknown"})

Relevant policy excerpts:
${context}

Return a verdict JSON matching the schema. Use matched_rules as canonical snake_case IDs like no_bots, no_bulk_automated_collection, personal_data_consent_required.
Ground citation.quoted_text in the excerpts. decision must be allowed, blocked, or modify_recommended.`,
  });

  return object;
}
