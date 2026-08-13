import { useMemo, useState } from "react";
import type { Atleta, Clube } from "@/lib/cartola-types";
import { POS_NOME, STATUS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, isEscalavel, playerPhoto, statusClass } from "@/lib/cartola-ui";

type Props = {
  posicaoId: number;
  atletas: Atleta[];
  clubes: Record<string, Clube>;
  usados: number[];
  recomendados?: number[];
  onPick: (a: Atleta) => void;
  onClose: () => void;
};

export function PlayerPicker({ posicaoId, atletas, clubes, usados, recomendados = [], onPick, onClose }: Props) {
  const [teamFilter, setTeamFilter] = useState<number[]>([]);
  const [busca, setBusca] = useState("");

  const ordem = (s: number) => (s === 7 ? 0 : s === 2 ? 1 : 2);

  const lista = useMemo(() => {
    return atletas
      .filter((a) => a.posicao_id === posicaoId && isEscalavel(a))
      .filter((a) => (teamFilter.length ? teamFilter.includes(a.clube_id) : true))
      .filter((a) => a.apelido.toLowerCase().includes(busca.toLowerCase()))
      .sort((a, b) => ordem(a.status_id) - ordem(b.status_id) || b.media_num - a.media_num);
  }, [atletas, posicaoId, teamFilter, busca]);

  const times = useMemo(
    () =>
      Object.values(clubes)
        .filter((c) => c.escudos && atletas.some((a) => a.clube_id === c.id))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [clubes, atletas],
  );


  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-t-2xl border border-border bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-lg tracking-wide">
            Escolher <span className="text-accent">{POS_NOME[posicaoId]}</span>
          </h3>
          <button onClick={onClose} className="px-2 text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="border-b border-border px-3 py-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar jogador"
            className="mb-2 w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setTeamFilter([])}
              className={`shrink-0 rounded-lg border px-3 py-1 text-xs ${!teamFilter.length ? "border-accent text-accent" : "border-border text-muted-foreground"}`}
            >
              Todos
            </button>
            {times.map((c) => (
              <button
                key={c.id}
                onClick={() =>
                  setTeamFilter((t) => (t.includes(c.id) ? t.filter((x) => x !== c.id) : [...t, c.id]))
                }
                title={c.nome}
                className={`shrink-0 rounded-lg border p-1 ${teamFilter.includes(c.id) ? "border-accent bg-accent/10" : "border-border"}`}
              >
                <img src={escudo(c, "30x30")} alt={c.nome} className="h-6 w-6 object-contain" />
              </button>
            ))}

          </div>
        </div>

        <div className="flex flex-col gap-1.5 overflow-y-auto p-3">
          {lista.map((a) => {
            const usado = usados.includes(a.atleta_id);
            const foto = playerPhoto(a);
            return (
              <button
                key={a.atleta_id}
                disabled={usado}
                onClick={() => onPick(a)}
                className={`flex items-center gap-3 rounded-lg border border-border bg-panel-2 px-3 py-2 text-left transition-colors hover:border-accent ${usado ? "opacity-40" : ""}`}
              >
                {foto ? (
                  <img src={foto} alt={a.apelido} className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-display text-sm">
                    {a.apelido.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <img src={escudo(clubes[String(a.clube_id)], "30x30")} alt="" className="h-5 w-5 object-contain" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-sm font-semibold">
                    {recomendados.includes(a.atleta_id) && <span className="text-accent">★</span>}
                    {a.apelido}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusClass(a.status_id)}`} />
                    {STATUS_NOME[a.status_id] ?? "-"} · média {fmt(a.media_num, 1)} · {a.jogos_num} jogos
                  </span>
                </span>
                <span className="font-display text-sm text-accent">C$ {fmt(a.preco_num, 2)}</span>
              </button>
            );
          })}
          {!lista.length && (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum jogador disponível.</p>
          )}
        </div>
      </div>
    </div>
  );
}
