/**
 * Nimble Web API (hackathon guide from Nimble organizers).
 * Base: https://sdk.nimbleway.com/v1
 * Auth: Authorization: Bearer NIMBLE_API_KEY
 */
export type FetchedPolicy = {
  url: string;
  body: string;
  fetched_at: string;
  status_code?: number;
};

export type NimbleSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

const BASE_URL = "https://sdk.nimbleway.com/v1";

type NimbleExtractJson = {
  text?: string;
  markdown?: string;
  status?: string;
  status_code?: number;
  url?: string;
  data?: {
    text?: string;
    markdown?: string;
    html?: string;
  };
  message?: string;
  error?: string;
};

function nimbleKey(): string | undefined {
  return process.env.NIMBLE_API_KEY?.trim() || undefined;
}

function nimbleHeaders(key: string): HeadersInit {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

function extractBodyFromJson(json: NimbleExtractJson): string {
  const candidates = [
    json.text,
    json.markdown,
    json.data?.text,
    json.data?.markdown,
    json.data?.html,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      return c.trim();
    }
  }
  return "";
}

async function parseNimbleJson(res: Response): Promise<NimbleExtractJson> {
  const text = await res.text();
  try {
    return JSON.parse(text) as NimbleExtractJson;
  } catch {
    throw new Error(
      `Nimble returned non-JSON (${res.status}): ${text.slice(0, 200)}`
    );
  }
}

function nimbleErrorMessage(
  res: Response,
  json: NimbleExtractJson,
  fallback: string
): string {
  if (typeof json.message === "string" && json.message) return json.message;
  if (typeof json.error === "string" && json.error) return json.error;
  return `${fallback} (HTTP ${res.status})`;
}

/**
 * Search the web (Nimble /v1/search). Useful to find policy URLs before extract.
 */
export async function searchWeb(
  query: string,
  limit = 5
): Promise<NimbleSearchResult[]> {
  const key = nimbleKey();
  if (!key) {
    throw new Error(
      "NIMBLE_API_KEY is not set. Add it to .env or .env.local in this repo."
    );
  }

  const res = await fetch(`${BASE_URL}/search`, {
    method: "POST",
    headers: nimbleHeaders(key),
    body: JSON.stringify({ query, limit }),
  });

  const json = (await parseNimbleJson(res)) as {
    results?: NimbleSearchResult[];
    message?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(nimbleErrorMessage(res, json, "Nimble search failed"));
  }

  return json.results ?? [];
}

/**
 * Extract full page text from a URL (Nimble /v1/extract).
 * Matches organizer snippet: `{ url, render: false }` → `{ text }`.
 */
export async function fetchPolicyPage(url: string): Promise<FetchedPolicy> {
  const key = nimbleKey();
  if (!key) {
    return {
      url,
      body: `[nimble stub] Set NIMBLE_API_KEY in .env to fetch ${url}`,
      fetched_at: new Date().toISOString(),
    };
  }

  const res = await fetch(`${BASE_URL}/extract`, {
    method: "POST",
    headers: nimbleHeaders(key),
    body: JSON.stringify({ url, render: false }),
  });

  const json = await parseNimbleJson(res);

  if (!res.ok) {
    throw new Error(nimbleErrorMessage(res, json, "Nimble extract failed"));
  }

  let body = extractBodyFromJson(json);

  // Some accounts return markdown under `data` when `formats` is requested.
  if (!body) {
    const withMarkdown = await fetch(`${BASE_URL}/extract`, {
      method: "POST",
      headers: nimbleHeaders(key),
      body: JSON.stringify({ url, render: false, formats: ["markdown"] }),
    });
    const json2 = await parseNimbleJson(withMarkdown);
    if (withMarkdown.ok) {
      body = extractBodyFromJson(json2);
    }
  }

  if (!body) {
    throw new Error(
      `Nimble returned empty text for ${url}. Check API key and URL (status ${json.status_code ?? res.status}).`
    );
  }

  return {
    url: json.url ?? url,
    body: body.slice(0, 50_000),
    fetched_at: new Date().toISOString(),
    status_code: json.status_code ?? res.status,
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
