/**
 * Nimble policy fetcher — live page extract via Nimble Web API.
 * https://docs.nimbleway.com/api-reference/extract/extract
 */
export type FetchedPolicy = {
  url: string;
  body: string;
  fetched_at: string;
  status_code?: number;
};

type NimbleExtractResponse = {
  status?: string;
  status_code?: number;
  url?: string;
  data?: {
    markdown?: string;
    html?: string;
  };
  message?: string;
};

const EXTRACT_URL = "https://sdk.nimbleway.com/v1/extract";

export async function fetchPolicyPage(url: string): Promise<FetchedPolicy> {
  const key = process.env.NIMBLE_API_KEY?.trim();
  if (!key) {
    return {
      url,
      body: `[nimble stub] Policy text for ${url}`,
      fetched_at: new Date().toISOString(),
    };
  }

  const res = await fetch(EXTRACT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      render: false,
    }),
  });

  const json = (await res.json()) as NimbleExtractResponse;

  if (!res.ok) {
    const msg =
      typeof json.message === "string"
        ? json.message
        : `Nimble extract failed (${res.status})`;
    throw new Error(msg);
  }

  const body =
    json.data?.markdown?.trim() ||
    json.data?.html?.trim() ||
    "";

  if (!body) {
    throw new Error(`Nimble returned empty body for ${url}`);
  }

  return {
    url: json.url ?? url,
    body: body.slice(0, 50_000),
    fetched_at: new Date().toISOString(),
    status_code: json.status_code,
  };
}

export async function fetchPolicyPages(
  urls: string[]
): Promise<FetchedPolicy[]> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return [];

  const results = await Promise.all(
    unique.map((url) =>
      fetchPolicyPage(url).catch((e) => {
        console.warn(`[nimble] fetch failed for ${url}`, e);
        return {
          url,
          body: `[nimble error] ${e instanceof Error ? e.message : String(e)}`,
          fetched_at: new Date().toISOString(),
        } satisfies FetchedPolicy;
      })
    )
  );

  return results;
}

export function hashPolicyContent(bodies: string[]): string {
  let h = 0;
  const s = bodies.join("\n");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}
