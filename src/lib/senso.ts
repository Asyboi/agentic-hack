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

export async function ingestPolicy(
  title: string,
  text: string,
  kbFolderNodeId: string
): Promise<string> {
  const payload = JSON.stringify({ title, text, kb_folder_node_id: kbFolderNodeId });
  const cmd = `senso kb create-raw --data ${JSON.stringify(payload)} --output json --quiet`;
  const { stdout } = await execAsync(cmd, {
    env: { ...process.env, PATH: `${process.env.HOME}/.npm-global/bin:${process.env.PATH}` },
  });

  const parsed = parseSensoJson(stdout) as { content_id?: string; id?: string };
  const contentId = parsed.content_id ?? parsed.id;
  if (!contentId) throw new Error(`Senso ingest returned no content_id: ${stdout}`);

  // Poll until Senso finishes chunking + embedding (5-15s)
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const { stdout: checkOut } = await execAsync(
        `senso kb get ${contentId} --output json --quiet`,
        { env: { ...process.env, PATH: `${process.env.HOME}/.npm-global/bin:${process.env.PATH}` } }
      );
      const status = parseSensoJson(checkOut) as { processing_status?: string };
      if (status.processing_status === "complete") break;
    } catch {
      // transient error — keep polling
    }
  }

  return contentId;
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
