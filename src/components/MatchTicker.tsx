import { useEffect, useMemo, useRef, useState } from "react";
import type { Atleta, Clube, Partida } from "@/lib/cartola-types";
import { POS_NOME } from "@/lib/cartola-types";
import { escudo, fmt } from "@/lib/cartola-ui";

type NewsItem = { titulo: string; link: string; fonte: string };

type Props = {
  partidas: Partida[];
  clubes: Record<string, Clube>;
  atletas: Atleta[];
  noticias?: NewsItem[];
  onSelectMatch: (p: Partida) => void;
};

export function MatchTicker({ partidas, clubes, atletas, noticias = [], onSelectMatch }: Props) {
  const items = useMemo(() => [...partidas, ...partidas], [partidas]);

  const dicas = useMemo(() => {
    const out: string[] = [];
    const byClube = new Map<number, Atleta[]>();
    for (const a of atletas) {
      if (![7, 2].includes(a.status_id)) continue;
      const arr = byClube.get(a.clube_id) ?? [];
      arr.push(a);
      byClube.set(a.clube_id, arr);
    }
    for (const p of partidas) {
      const casa = clubes[String(p.clube_casa_id)];
      const fora = clubes[String(p.clube_visitante_id)];
      const mandantes = (byClube.get(p.clube_casa_id) ?? [])
        .sort((a, b) => b.media_num - a.media_num)
        .slice(0, 2);
      for (const a of mandantes) {
        if (a.media_num <= 0) continue;
        out.push(
          `🔥 ${a.apelido} (${POS_NOME[a.posicao_id]}, ${casa?.abreviacao ?? ""}) joga em casa contra o ${fora?.nome ?? ""} com média ${fmt(a.media_num, 1)} em ${a.jogos_num} jogos.`,
        );
      }
    }
    for (const a of atletas.filter((x) => x.status_id === 6 || x.status_id === 3).slice(0, 6)) {
      out.push(
        `🚨 ${a.apelido} (${POS_NOME[a.posicao_id]}, ${clubes[String(a.clube_id)]?.abreviacao ?? ""}) está fora da rodada — evite escalar.`,
      );
    }
    for (const a of [...atletas].sort((x, y) => x.variacao_num - y.variacao_num).slice(0, 4)) {
      out.push(
        `📉 ${a.apelido} desvalorizou ${fmt(Math.abs(a.variacao_num), 2)} e agora custa C$ ${fmt(a.preco_num, 2)}.`,
      );
    }
    for (const a of [...atletas].sort((x, y) => y.variacao_num - x.variacao_num).slice(0, 4)) {
      out.push(
        `📈 ${a.apelido} valorizou ${fmt(a.variacao_num, 2)} — hoje custa C$ ${fmt(a.preco_num, 2)}.`,
      );
    }
    return out.sort(() => Math.random() - 0.5);
  }, [atletas, clubes, partidas]);

  const feed = useMemo(() => {
    const news = noticias.map((n) => ({ texto: `📰 ${n.titulo}`, link: n.link, fonte: n.fonte }));
    const tips = dicas.map((d) => ({ texto: d, link: "", fonte: "Box to 5" }));
    const out: Array<{ texto: string; link: string; fonte: string }> = [];
    const max = Math.max(news.length, tips.length);
    for (let i = 0; i < max; i++) {
      if (tips[i]) out.push(tips[i]!);
      if (news[i]) out.push(news[i]!);
    }
    return out;
  }, [dicas, noticias]);

  const scroller = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      const el = scroller.current;
      if (!el) return;
      const half = el.scrollWidth / 2;
      el.scrollLeft = el.scrollLeft >= half ? el.scrollLeft - half : el.scrollLeft + 1;
    }, 30);
    return () => clearInterval(t);
  }, [paused]);

  const [tip, setTip] = useState(0);
  useEffect(() => {
    if (!feed.length) return;
    const t = setInterval(() => setTip((i) => (i + 1) % feed.length), 7000);
    return () => clearInterval(t);
  }, [feed.length]);

  if (!partidas.length) return null;

  return (
    <div className="space-y-2">
      <div
        ref={scroller}
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="relative snap-x overflow-x-auto rounded-xl border border-border bg-panel py-2"
      >
        <div className="flex w-max gap-3 px-2">
          {items.map((p, i) => {
            const casa = clubes[String(p.clube_casa_id)];
            const fora = clubes[String(p.clube_visitante_id)];
            const dt = p.partida_data ? new Date(p.partida_data.replace(" ", "T")) : null;
            return (
              <button
                key={`${p.clube_casa_id}-${i}`}
                onClick={() => onSelectMatch(p)}
                className="flex shrink-0 snap-start items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-1.5 transition-colors hover:border-accent"
              >
                <img src={escudo(casa, "30x30")} alt={casa?.nome ?? ""} className="h-6 w-6 object-contain" />
                <span className="font-display text-xs tracking-wide text-muted-foreground">x</span>
                <img src={escudo(fora, "30x30")} alt={fora?.nome ?? ""} className="h-6 w-6 object-contain" />
                <span className="flex flex-col items-start leading-tight">
                  <span className="text-[10px] text-accent">
                    {dt
                      ? dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : "a definir"}
                  </span>
                  <span className="max-w-28 truncate text-[10px] text-muted-foreground">{p.local ?? ""}</span>
                </span>
              </button>
            );
          })}

        </div>
      </div>
      {feed.length > 0 && (
        <div className="flex h-20 flex-col justify-between rounded-xl border border-border bg-panel px-3 py-2">
          <p key={tip} className="animate-tip line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {feed[tip % feed.length]!.texto}
          </p>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="uppercase tracking-wide">{feed[tip % feed.length]!.fonte}</span>
            <span className="flex items-center gap-2">
              {feed[tip % feed.length]!.link && (
                <a
                  href={feed[tip % feed.length]!.link}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-accent"
                >
                  ler notícia
                </a>
              )}
              <button onClick={() => setTip((i) => (i + 1) % feed.length)} className="hover:text-accent">
                próxima ›
              </button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
