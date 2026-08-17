import { useEffect, useMemo, useRef, useState } from "react";
import type { Clube, Partida } from "@/lib/cartola-types";
import { escudo } from "@/lib/cartola-ui";

type NewsItem = { titulo: string; link: string; fonte: string };

type Props = {
  partidas: Partida[];
  clubes: Record<string, Clube>;
  noticias?: NewsItem[];
  mercadoAberto?: boolean;
  onSelectMatch: (p: Partida) => void;
};

export function MatchTicker({ partidas, clubes, noticias = [], mercadoAberto = true, onSelectMatch }: Props) {
  const items = useMemo(() => [...partidas, ...partidas], [partidas]);
  const feed = useMemo(() => noticias.filter((n) => n.titulo && n.link), [noticias]);

  const scroller = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const retomar = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pausa temporária quando o usuário arrasta/rola para voltar em um confronto.
  const pausarTemporariamente = () => {
    setPaused(true);
    if (retomar.current) clearTimeout(retomar.current);
    retomar.current = setTimeout(() => setPaused(false), 2500);
  };

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


  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!feed.length) return;
    const atual = feed[idx % feed.length]!;
    const palavras = atual.titulo.trim().split(/\s+/).length;
    const tempo = Math.min(22000, Math.max(6000, 2500 + palavras * 450));
    const t = setTimeout(() => setIdx((i) => (i + 1) % feed.length), tempo);
    return () => clearTimeout(t);
  }, [feed, idx]);

  if (!partidas.length) return null;
  const noticia = feed.length ? feed[idx % feed.length]! : null;

  return (
    <div className="space-y-2">
      {!mercadoAberto && (
        <p className="text-center text-[11px] font-semibold text-accent">
          Clique no confronto e confira as parciais
        </p>
      )}
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

      {noticia && (
        <a
          href={noticia.link}
          target="_blank"
          rel="noreferrer"
          className="flex h-16 items-center overflow-hidden rounded-xl border border-border bg-panel px-3 py-2 transition-colors hover:border-accent"
        >
          <p key={idx} className="animate-tip line-clamp-3 text-xs leading-snug text-muted-foreground">
            {noticia.titulo}
          </p>
        </a>
      )}
    </div>
  );
}
