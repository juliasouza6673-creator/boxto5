import { useMemo, useState } from "react";
import type { Atleta, Clube } from "@/lib/cartola-types";
import { POS_NOME, STATUS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, playerPhoto, statusClass } from "@/lib/cartola-ui";

type Props = {
  atletas: Atleta[];
  clubes: Record<string, Clube>;
  onPick: (a: Atleta) => void;
  onClose: () => void;
};

export function PlayerSearch({ atletas, clubes, onPick, onClose }: Props) {
  const [busca, setBusca] = useState("");
  const [pos, setPos] = useState<number | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return atletas
      .filter((a) => (pos ? a.posicao_id === pos : true))
      .filter((a) => (q ? a.apelido.toLowerCase().includes(q) : true))
      .sort((a, b) => b.media_num - a.media_num)
      .slice(0, 120);
  }, [atletas, busca, pos]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 p-2 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-display text-lg tracking-wide">Buscar jogador</h3>
          <button onClick={onClose} className="px-2 text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>

        <div className="shrink-0 border-b border-border px-3 py-2">
          <input
            autoFocus
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite o nome do jogador"
            className="mb-2 w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setPos(null)}
              className={`shrink-0 rounded-lg border px-3 py-1 text-xs ${!pos ? "border-accent text-accent" : "border-border text-muted-foreground"}`}
            >
              Todos
            </button>
            {[1, 3, 2, 4, 5, 6].map((p) => (
              <button
                key={p}
                onClick={() => setPos(pos === p ? null : p)}
                className={`shrink-0 rounded-lg border px-3 py-1 text-xs ${pos === p ? "border-accent text-accent" : "border-border text-muted-foreground"}`}
              >
                {POS_NOME[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-3">
          {lista.map((a) => (
            <button
              key={a.atleta_id}
              onClick={() => onPick(a)}
              className="flex items-center gap-3 rounded-lg border border-border bg-panel-2 px-3 py-2 text-left hover:border-accent"
            >
              {playerPhoto(a) ? (
                <img src={playerPhoto(a)!} alt={a.apelido} className="h-9 w-9 rounded-full object-cover" />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-display text-sm">
                  {a.apelido.slice(0, 2).toUpperCase()}
                </span>
              )}
              <img src={escudo(clubes[String(a.clube_id)], "30x30")} alt="" className="h-5 w-5 object-contain" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{a.apelido}</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusClass(a.status_id)}`} />
                  {POS_NOME[a.posicao_id]} · {STATUS_NOME[a.status_id] ?? "-"} · média {fmt(a.media_num, 1)}
                </span>
              </span>
              <span className="font-display text-sm text-accent">C$ {fmt(a.preco_num, 2)}</span>
            </button>
          ))}
          {!lista.length && <p className="py-10 text-center text-sm text-muted-foreground">Nenhum jogador encontrado.</p>}
        </div>
      </div>
    </div>
  );
}
