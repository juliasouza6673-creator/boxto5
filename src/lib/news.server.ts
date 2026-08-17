export type NewsItem = { titulo: string; link: string; data: string | null; fonte: string };

const FEEDS: Array<[string, string]> = [
  ["Cartola FC", "https://ge.globo.com/rss/ge/cartola-fc/"],
  ["ge Futebol", "https://ge.globo.com/rss/ge/futebol/"],
  ["ge Brasileirão", "https://ge.globo.com/rss/ge/futebol/brasileirao-serie-a/"],
];

/** Clubes da Série A + termos ligados ao Cartola. */
const TERMOS = [
  "cartola",
  "escalação",
  "escalacao",
  "mitar",
  "brasileirão",
  "brasileirao",
  "série a",
  "serie a",
  "flamengo",
  "palmeiras",
  "corinthians",
  "são paulo",
  "sao paulo",
  "santos",
  "vasco",
  "botafogo",
  "fluminense",
  "grêmio",
  "gremio",
  "internacional",
  "atlético-mg",
  "atletico-mg",
  "atlético mineiro",
  "cruzeiro",
  "athletico",
  "coritiba",
  "bahia",
  "vitória",
  "vitoria",
  "fortaleza",
  "ceará",
  "ceara",
  "sport",
  "juventude",
  "bragantino",
  "mirassol",
  "goiás",
  "goias",
  "atlético-go",
  "atletico-go",
  "cuiabá",
  "cuiaba",
  "criciúma",
  "criciuma",
  "chapecoense",
  "remo",
  "paysandu",
  "avaí",
  "avai",
];

let cache: { at: number; items: NewsItem[] } | null = null;

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parse(xml: string, fonte: string): NewsItem[] {
  const out: NewsItem[] = [];
  const blocks = xml.split("<item>").slice(1);
  for (const b of blocks) {
    const t = /<title>([\s\S]*?)<\/title>/.exec(b)?.[1];
    const l = /<link>([\s\S]*?)<\/link>/.exec(b)?.[1];
    const d = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(b)?.[1];
    if (!t) continue;
    out.push({ titulo: decode(t), link: l ? decode(l) : "", data: d ? decode(d) : null, fonte });
  }
  return out;
}

function daysAgo(iso: string | null) {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
}

function relevante(n: NewsItem) {
  const txt = n.titulo.toLowerCase();
  return TERMOS.some((t) => txt.includes(t));
}

export async function fetchNews(): Promise<NewsItem[]> {
  const now = Date.now();
  if (cache && now - cache.at < 15 * 60_000) return cache.items;
  const all: NewsItem[] = [];
  for (const [fonte, url] of FEEDS) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; BoxTo5/1.0)" } });
      if (!res.ok) continue;
      all.push(...parse(await res.text(), fonte).slice(0, 40));
    } catch {
      /* ignore feed */
    }
  }
  const seen = new Set<string>();
  const items = all
    .filter((n) => n.titulo && n.link)
    .filter((n) => daysAgo(n.data) <= 7)
    .filter(relevante)
    .filter((n) => (seen.has(n.titulo) ? false : (seen.add(n.titulo), true)))
    .sort((a, b) => daysAgo(a.data) - daysAgo(b.data))
    .slice(0, 30);
  if (items.length) cache = { at: now, items };
  return items.length ? items : (cache?.items ?? []);
}
