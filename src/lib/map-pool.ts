/**
 * Run async work with a concurrency cap (Node has no threads — this is parallel I/O).
 */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));

  if (limit === 1) {
    const out: R[] = [];
    for (let i = 0; i < items.length; i++) {
      out.push(await fn(items[i], i));
    }
    return out;
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(
    Array.from({ length: limit }, () => worker())
  );
  return results;
}

export function researchConcurrency(): number {
  const raw = process.env.POLICYGUARD_RESEARCH_CONCURRENCY?.trim();
  if (!raw) return 3;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 8) : 3;
}
