import { parseSensoJson, runSensoCli } from "@/lib/senso-cli";

/** Policy Guard org — `policies-under-evaluation` folder (Senso `kb my-files`). */
export const DEFAULT_POLICIES_FOLDER_NODE_ID =
  "125d0670-85ea-4f90-8b0f-a1fcad8eba1f";

export type KbContentNode = {
  kb_node_id: string;
  content_id: string;
  name: string;
  processing_status?: string;
};

export type CreateRawResult = {
  content_id: string;
  title: string;
  processing_status: string;
};

function policiesFolderId(): string {
  return (
    process.env.SENSO_POLICIES_FOLDER_NODE_ID?.trim() ||
    DEFAULT_POLICIES_FOLDER_NODE_ID
  );
}

export async function listPoliciesFolderChildren(): Promise<KbContentNode[]> {
  const stdout = await runSensoCli([
    "kb",
    "children",
    policiesFolderId(),
    "--output",
    "json",
    "--quiet",
  ]);
  const parsed = parseSensoJson(stdout) as {
    nodes?: Array<{
      kb_node_id: string;
      content_id?: string;
      name: string;
      type: string;
      content?: { id: string; processing_status?: string };
    }>;
  };

  return (parsed.nodes ?? [])
    .filter((n) => n.type === "content" && n.content_id)
    .map((n) => ({
      kb_node_id: n.kb_node_id,
      content_id: n.content_id!,
      name: n.name,
      processing_status: n.content?.processing_status,
    }));
}

export async function createRawInPoliciesFolder(input: {
  title: string;
  text: string;
}): Promise<CreateRawResult> {
  const stdout = await runSensoCli([
    "kb",
    "create-raw",
    "--data",
    JSON.stringify({
      title: input.title,
      text: input.text,
      kb_folder_node_id: policiesFolderId(),
    }),
    "--output",
    "json",
    "--quiet",
  ]);

  const parsed = parseSensoJson(stdout) as {
    id: string;
    title: string;
    processing_status: string;
  };

  return {
    content_id: parsed.id,
    title: parsed.title,
    processing_status: parsed.processing_status,
  };
}

export async function resolveKbNodeIdForContent(
  contentId: string
): Promise<string | undefined> {
  const children = await listPoliciesFolderChildren();
  return children.find((c) => c.content_id === contentId)?.kb_node_id;
}

/** Full replace — use `kb_node_id` (patch-raw on content_id often returns permission denied). */
export async function updateRawByKbNodeId(
  kbNodeId: string,
  input: { title: string; text: string }
): Promise<CreateRawResult> {
  const stdout = await runSensoCli([
    "kb",
    "update-raw",
    kbNodeId,
    "--data",
    JSON.stringify({ title: input.title, text: input.text }),
    "--output",
    "json",
    "--quiet",
  ]);

  const parsed = parseSensoJson(stdout) as {
    id: string;
    title: string;
    processing_status: string;
  };

  return {
    content_id: parsed.id,
    title: parsed.title,
    processing_status: parsed.processing_status,
  };
}

/**
 * Poll folder listing until Senso finishes embedding (typically 5–20s).
 */
export async function waitForContentReady(
  contentId: string,
  options: { maxWaitMs?: number; pollMs?: number } = {}
): Promise<void> {
  const maxWaitMs = options.maxWaitMs ?? 120_000;
  const pollMs = options.pollMs ?? 3_000;
  const started = Date.now();

  while (Date.now() - started < maxWaitMs) {
    const children = await listPoliciesFolderChildren();
    const node = children.find((c) => c.content_id === contentId);
    if (node?.processing_status === "complete") return;
    if (node?.processing_status === "failed") {
      throw new Error(`Senso processing failed for content ${contentId}`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error(
    `Timed out waiting for Senso to process content ${contentId} (${maxWaitMs}ms)`
  );
}
