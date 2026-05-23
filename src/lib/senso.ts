import { parseSensoJson, runSensoCli } from "@/lib/senso-cli";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

export async function ingestPolicy(
  title: string,
  text: string,
  folderNodeId: string
): Promise<string> {
  const data = { title, text, kb_folder_node_id: folderNodeId };

  const stdout = await runSensoCli([
    "kb",
    "create-raw",
    "--data",
    JSON.stringify(data),
    "--output",
    "json",
    "--quiet",
  ]);

  const parsed = parseSensoJson(stdout) as { content_id?: string; id?: string };
  const contentId = parsed.content_id ?? parsed.id;
  if (!contentId) {
    throw new Error(`senso kb create-raw returned no content_id. stdout: ${stdout}`);
  }
  return contentId;
}

export async function pollUntilReady(
  nodeId: string,
  maxWaitMs = 60_000
): Promise<void> {
  // Jitter to avoid thundering herd when called in parallel
  await sleep(Math.random() * 3_000);

  const deadline = Date.now() + maxWaitMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;

    const stdout = await runSensoCli([
      "kb",
      "get",
      nodeId,
      "--output",
      "json",
      "--quiet",
    ]);

    const parsed = parseSensoJson(stdout) as { processing_status?: string };
    console.log(
      `[senso] polling ${nodeId} (attempt ${attempt}, status: ${parsed.processing_status ?? "unknown"})`
    );

    if (parsed.processing_status === "complete") return;

    await sleep(2_000);
  }

  throw new Error(
    `senso kb get ${nodeId} did not reach "complete" within ${maxWaitMs}ms`
  );
}
