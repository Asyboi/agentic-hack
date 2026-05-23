/**
 * Nimble policy fetcher — Kyle owns implementation.
 * Interface for live demo: fetch robots.txt, terms, privacy at runtime.
 */
export type FetchedPolicy = {
  url: string;
  body: string;
  fetched_at: string;
};

export async function fetchPolicyPage(url: string): Promise<FetchedPolicy> {
  const key = process.env.NIMBLE_API_KEY;
  if (!key) {
    return {
      url,
      body: `[nimble stub] Policy text for ${url}`,
      fetched_at: new Date().toISOString(),
    };
  }

  const res = await fetch("https://api.webit.live/api/v1/realtime/web", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`user:${key}`).toString("base64")}`,
    },
    body: JSON.stringify({ url, render: false, parse: false }),
  });

  if (!res.ok) {
    throw new Error(`Nimble fetch failed for ${url}: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { html_content?: string; text?: string };
  const body = json.html_content ?? json.text ?? "";

  return { url, body, fetched_at: new Date().toISOString() };
}

export async function fetchPolicyPages(
  urls: string[]
): Promise<FetchedPolicy[]> {
  return Promise.all(urls.map(fetchPolicyPage));
}

export function hashPolicyContent(bodies: string[]): string {
  let h = 0;
  const s = bodies.join("\n");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}
