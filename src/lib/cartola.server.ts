const BASES = [
  "https://api.cartola.globo.com",
  "https://api.cartolafc.globo.com",
];

type CacheEntry = { at: number; data: unknown };
const cache = new Map<string, CacheEntry>();

export class CartolaError extends Error {}

export async function cartolaGet<T>(path: string, ttlMs: number): Promise<T> {
  const hit = cache.get(path);
  const now = Date.now();
  if (hit && now - hit.at < ttlMs) return hit.data as T;

  let lastErr: unknown = null;
  for (const base of BASES) {
    try {
      const res = await fetch(base + path, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (compatible; TaticsPro/1.0)",
        },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      cache.set(path, { at: now, data: json });
      return json;
    } catch (err) {
      lastErr = err;
    }
  }
  // stale-while-error: serve old data rather than breaking the UI
  if (hit) return hit.data as T;
  throw new CartolaError(
    `Não foi possível falar com a API do Cartola (${path}): ${String(lastErr)}`,
  );
}
