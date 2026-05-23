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
  const all = parsed.results ?? [];
  const filtered = all.filter((c) => !isBuildLogChunk(c));
  return filtered.length > 0 ? filtered : all;
}

/**
 * The Senso KB also contains hackathon onboarding / heal-report content that
 * matches some policy queries by coincidence. Drop those so they never end up
 * as a citation's quoted_text.
 */
function isBuildLogChunk(chunk: PolicyChunk): boolean {
  const haystack = `${chunk.title ?? ""}\n${chunk.chunk_text ?? ""}`.toLowerCase();
  return (
    haystack.includes("content types:") ||
    haystack.includes("drafts produced") ||
    haystack.includes("batch run id") ||
    haystack.includes("documents ingested") ||
    haystack.includes("heal report") ||
    /phase\s+\d+:/.test(haystack)
  );
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

  const parsed = parseSensoJson(stdout) as {
    url?: string;
    citeable_url?: string;
    external_url?: string;
    destinations?: Array<{ external_url?: string; publisher_slug?: string }>;
  };

  const fromDestinations = parsed.destinations?.find(
    (d) => d.publisher_slug === "cited-md" || d.external_url?.includes("cited.md")
  )?.external_url;

  return (
    parsed.external_url ??
    fromDestinations ??
    parsed.url ??
    parsed.citeable_url
  );
}
