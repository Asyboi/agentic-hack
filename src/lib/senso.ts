import { parseSensoJson, runSensoCli } from "@/lib/senso-cli";

export interface PolicyChunk {
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
  const stdout = await runSensoCli([
    "search",
    "context",
    JSON.stringify(proposedAction),
    "--content-ids",
    policyContentId,
    "--require-scoped-ids",
    "--max-results",
    String(maxResults),
    "--output",
    "json",
    "--quiet",
  ]);

  const parsed = parseSensoJson(stdout) as { results?: PolicyChunk[] };
  return parsed.results ?? [];
}

export async function publishDecision(
  markdown: string,
  meta: {
    seo_title: string;
    summary: string;
    geo_question_id?: string;
  }
): Promise<string | undefined> {
  const data = {
    geo_question_id: meta.geo_question_id ?? "",
    raw_markdown: markdown,
    seo_title: meta.seo_title,
    summary: meta.summary,
  };

  const stdout = await runSensoCli([
    "engine",
    "publish",
    "--data",
    JSON.stringify(data),
    "--output",
    "json",
    "--quiet",
  ]);

  const parsed = parseSensoJson(stdout) as { url?: string; citeable_url?: string };
  return parsed.url ?? parsed.citeable_url;
}
