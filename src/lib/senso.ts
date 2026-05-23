import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface PolicyChunk {
  content_id: string;
  chunk_text: string;
  score: number;
  title: string;
}

function parseSensoJson(stdout: string): unknown {
  const match = stdout.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Senso returned no JSON");
  return JSON.parse(match[0]);
}

export async function searchPolicy(
  proposedAction: string,
  policyContentId: string,
  maxResults = 5
): Promise<PolicyChunk[]> {
  const cmd = [
    "senso",
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
  ].join(" ");

  const { stdout } = await execAsync(cmd, {
    env: {
      ...process.env,
      PATH: `${process.env.HOME}/.npm-global/bin:${process.env.PATH}`,
    },
  });

  const parsed = parseSensoJson(stdout) as { results?: PolicyChunk[] };
  return parsed.results ?? [];
}

export async function publishDecision(markdown: string, meta: {
  seo_title: string;
  summary: string;
  geo_question_id?: string;
}): Promise<string | undefined> {
  const data = {
    geo_question_id: meta.geo_question_id ?? "",
    raw_markdown: markdown,
    seo_title: meta.seo_title,
    summary: meta.summary,
  };

  const cmd = [
    "senso",
    "engine",
    "publish",
    "--data",
    JSON.stringify(data),
    "--output",
    "json",
    "--quiet",
  ].join(" ");

  const { stdout } = await execAsync(cmd, {
    env: {
      ...process.env,
      PATH: `${process.env.HOME}/.npm-global/bin:${process.env.PATH}`,
    },
  });

  const parsed = parseSensoJson(stdout) as { url?: string; citeable_url?: string };
  return parsed.url ?? parsed.citeable_url;
}
