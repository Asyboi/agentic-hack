/**
 * Nimble policy fetcher — Aslan owns implementation.
 * Interface for live demo: fetch robots.txt, terms, privacy (+ pricing pages) at runtime.
 */
export type FetchedPolicy = {
  url: string;
  body: string;
  fetched_at: string;
};

export async function fetchPolicyPages(
  urls: string[]
): Promise<FetchedPolicy[]> {
  const key = process.env.NIMBLE_API_KEY;
  if (!key) {
    return urls.map((url) => ({
      url,
      body: `[nimble stub] Policy text for ${url}`,
      fetched_at: new Date().toISOString(),
    }));
  }

  // TODO: Nimble Web API / search agents integration
  throw new Error("Nimble live fetch not wired yet");
}

export function hashPolicyContent(bodies: string[]): string {
  let h = 0;
  const s = bodies.join("\n");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(16);
}
