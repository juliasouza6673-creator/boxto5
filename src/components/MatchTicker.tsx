import { useEffect, useMemo, useState } from "react";
import type { Atleta, Clube, Partida } from "@/lib/cartola-types";
import { POS_NOME } from "@/lib/cartola-types";
import { escudo, fmt } from "@/lib/cartola-ui";

type Props = {
  partidas: Partida[];
  clubes: Record<string, Clube>;
  atletas: Atleta[];
  onSelectMatch: (p: Partida) => void;
};

export function MatchTicker({ partidas, clubes, atletas, onSelectMatch }: Props) {
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

  const [tip, setTip] = useState(0);
  useEffect(() => {
    if (!dicas.length) return;
    const t = setInterval(() => setTip((i) => (i + 1) % dicas.length), 6000);
    return () => clearInterval(t);
  }, [dicas.length]);

  if (!partidas.length) return null;

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-border bg-panel py-2">
        <div className="flex w-max animate-ticker gap-3">
          {items.map((p, i) => {
            const casa = clubes[String(p.clube_casa_id)];
            const fora = clubes[String(p.clube_visitante_id)];
            const dt = p.partida_data ? new Date(p.partida_data.replace(" ", "T")) : null;
            return (
              <button
                key={`${p.clube_casa_id}-${i}`}
                onClick={() => onSelectMatch(p)}
                className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-1.5 transition-colors hover:border-accent"
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
      {dicas.length > 0 && (
        <div className="min-h-9 rounded-xl border border-border bg-panel px-3 py-2">
          <p key={tip} className="animate-tip text-xs leading-relaxed text-muted-foreground">
            {dicas[tip % dicas.length]}
          </p>
        </div>
      )}
    </div>
  );
}
