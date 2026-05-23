/**
 * Nimble WebiT policy fetcher.
 * Endpoint: https://api.webit.live/api/v1/realtime/web
 * Auth: HTTP Basic with NIMBLE_API_KEY as username, empty password.
 */
export type FetchedPolicy = {
  url: string;
  content: string;
  status: "success" | "failed";
  fetched_at: string;
  error?: string;
};

const NIMBLE_ENDPOINT = "https://api.webit.live/api/v1/realtime/web";
const REQUEST_TIMEOUT_MS = 30_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAuthHeader(key: string): string {
  return `Basic ${Buffer.from(key + ":").toString("base64")}`;
}

export async function fetchPolicyPages(
  urls: string[]
): Promise<FetchedPolicy[]> {
  const key = process.env.NIMBLE_API_KEY;
  if (!key) {
    throw new Error(
      "NIMBLE_API_KEY is not set. Cannot fetch policy pages without an API key."
    );
  }

  const results: FetchedPolicy[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const fetched_at = new Date().toISOString();
    const start = Date.now();

    console.log(`[nimble] → ${url}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(NIMBLE_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(key),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          render: true,
          parsing_type: "markdown",
          exclude_html: true,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // WebiT API response shape varies — try common field names defensively
      const content: string =
        data?.data?.markdown ??
        data?.data?.text ??
        data?.data?.html ??
        data?.markdown ??
        data?.text ??
        data?.html ??
        "";

      const ms = Date.now() - start;
      console.log(`[nimble] ✓ ${url} (${ms}ms, ${content.length} chars)`);

      results.push({ url, content, status: "success", fetched_at });
    } catch (e: unknown) {
      clearTimeout(timeoutId);
      const error = e instanceof Error ? e.message : String(e);
      console.error(`[nimble] ✗ ${url} — ${error}`);
      results.push({ url, content: "", status: "failed", fetched_at, error });
    }

    // Rate-limit courtesy: sleep between requests (skip after last one)
    if (i < urls.length - 1) {
      await sleep(1_000);
    }
  }

  return results;
}

export async function fetchPolicyPage(url: string): Promise<FetchedPolicy> {
  const results = await fetchPolicyPages([url]);
  return results[0];
}

export function hashPolicyContent(bodies: string[]): string {
  let h = 0;
  const s = bodies.join("\n");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}
