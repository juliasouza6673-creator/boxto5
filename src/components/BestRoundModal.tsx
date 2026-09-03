import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBestOfRound } from "@/lib/cartola.functions";
import { useSubcategorias } from "@/lib/subcategorias";
import type { Atleta, Clube } from "@/lib/cartola-types";
import { POS_NOME } from "@/lib/cartola-types";
import { escudo, fmt } from "@/lib/cartola-ui";

type Props = {
  clubes: Record<string, Clube>;
  atletas: Atleta[];
  onOpenPlayer: (a: Atleta) => void;
  onClose: () => void;
};

export function BestRoundModal({ clubes, atletas, onOpenPlayer, onClose }: Props) {
  const fn = useServerFn(getBestOfRound);
  const { data: subs } = useSubcategorias();
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});
  const { data, isLoading } = useQuery({
    queryKey: ["best-of-round", subs ? Object.keys(subs).length : 0],
    queryFn: () => fn({ data: { subs: subs ?? {} } }),
    staleTime: 15 * 60_000,
  });

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-background/85 p-3" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border p-4">
          <div>
            <h2 className="font-display text-lg tracking-wide sm:text-xl">Melhores opções para a rodada</h2>
            <p className="text-[11px] text-muted-foreground">
              Média no mando, cedimento do adversário, minutagem, fase e recorrência das últimas 5 rodadas.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground">
            ✕
          </button>
        </header>
        <div className="space-y-5 overflow-y-auto p-3 sm:p-4">
          {isLoading && <p className="py-8 text-center text-muted-foreground">Cruzando médias e cedimentos…</p>}
          {data?.ok &&
            [1, 2, 3, 4, 5, 6].map((pos) => {
              const todos = data.byPos[String(pos)] ?? [];
              const aberto = expandido[String(pos)];
              const lista = aberto ? todos : todos.slice(0, 5);
              return (
                <section key={pos}>
                  <h3 className="mb-2 font-display tracking-wide text-accent">{POS_NOME[pos]}</h3>
                  <div className="space-y-1.5">
                    {lista.map((p) => {
                      const adv = clubes[String(p.adversario)];
                      const clube = clubes[String(p.clube_id)];
                      const foto = p.foto ? p.foto.replace("FORMATO", "140x140") : null;
                      const atleta = atletas.find((a) => a.atleta_id === p.atleta_id);
                      const extra =
                        p.posicao_id === 1
                          ? `${p.defesasCedidas} defesas cedidas`
                          : p.posicao_id === 5
                            ? `${p.golsCedidos} gols cedidos`
                            : `${p.desarmesCedidos} desarmes cedidos`;
                      return (
                        <button
                          key={p.atleta_id}
                          onClick={() => atleta && onOpenPlayer(atleta)}
                          className="flex w-full items-center gap-2 rounded-lg border border-border bg-panel-2 px-2 py-2 text-left transition-colors hover:border-accent"
                        >
                          {foto ? (
                            <img src={foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                          ) : (
                            <span className="h-9 w-9 shrink-0 rounded-full bg-secondary" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1 truncate text-sm font-semibold">
                              <img src={escudo(clube, "30x30")} alt="" className="h-4 w-4 object-contain" />
                              {p.apelido}
                              <span className="text-[10px] font-normal text-muted-foreground">
                                {p.tendencia === "subindo" ? "↗" : p.tendencia === "caindo" ? "↘" : "→"}
                              </span>
                            </span>
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              {clube?.abreviacao}
                              <img src={escudo(clube, "30x30")} alt="" className="h-3.5 w-3.5 object-contain" />x
                              <img src={escudo(adv, "30x30")} alt="" className="h-3.5 w-3.5 object-contain" />
                              {adv?.abreviacao} · {p.mando === "casa" ? "em casa" : "fora"}
                            </span>
                            {p.posicao_id !== 6 && (
                              <span className="block text-[10px] text-muted-foreground">
                                {extra} · ~{p.minutos}′ · recorrência {Math.round(p.recorrencia)}%
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-right text-[11px] leading-tight">
                            <span className="block">
                              mando <b className="text-foreground">{fmt(p.mediaMando, 1)}</b>
                            </span>
                            <span className="block text-success">cede {fmt(p.mediaCedida, 1)}</span>
                          </span>
                        </button>
                      );
                    })}
                    {!todos.length && <p className="text-xs text-muted-foreground">Sem opções com amostra suficiente.</p>}
                    {todos.length > 5 && (
                      <button
                        onClick={() => setExpandido((e) => ({ ...e, [String(pos)]: !aberto }))}
                        className="w-full rounded-lg border border-dashed border-border py-1.5 text-[11px] text-muted-foreground hover:border-accent hover:text-accent"
                      >
                        {aberto ? "Ver menos" : "Ver mais opções"}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          {data && !data.ok && <p className="text-center text-sm text-destructive">{data.error}</p>}
        </div>
      </div>
    </div>
  );
}
