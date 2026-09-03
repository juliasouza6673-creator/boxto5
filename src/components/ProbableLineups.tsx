import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Atleta, Clube } from "@/lib/cartola-types";
import { POS_ABREV, STATUS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, playerPhoto } from "@/lib/cartola-ui";
import { useSubcategorias } from "@/lib/subcategorias";

type Props = {
  rodada: number;
  clubeId: number;
  clubes: Record<string, Clube>;
  atletas: Atleta[];
  isAdmin: boolean;
  onOpenPlayer: (a: Atleta) => void;
};

export function ProbableLineup({ rodada, clubeId, clubes, atletas, isAdmin, onOpenPlayer }: Props) {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const { data: subs } = useSubcategorias();

  const elenco = useMemo(() => atletas.filter((a) => a.clube_id === clubeId), [atletas, clubeId]);

  const { data: ids } = useQuery({
    queryKey: ["probable-lineup", rodada, clubeId],
    staleTime: 60_000,
    queryFn: async (): Promise<number[]> => {
      const { data } = await supabase
        .from("probable_lineups")
        .select("atletas")
        .eq("rodada", rodada)
        .eq("clube_id", clubeId)
        .maybeSingle();
      return (data?.atletas as number[] | null) ?? [];
    },
  });

  const escalados = (ids ?? [])
    .map((id) => elenco.find((a) => a.atleta_id === id))
    .filter((a): a is Atleta => !!a);

  const foraDeCombate = elenco.filter((a) => a.status_id === 3 || a.status_id === 6);

  const salvar = async (novos: number[]) => {
    await supabase
      .from("probable_lineups")
      .upsert({ rodada, clube_id: clubeId, atletas: novos }, { onConflict: "rodada,clube_id" });
    await qc.invalidateQueries({ queryKey: ["probable-lineup", rodada, clubeId] });
  };

  const sugestoes =
    busca.trim().length >= 2
      ? elenco
          .filter((a) => a.apelido.toLowerCase().includes(busca.trim().toLowerCase()))
          .filter((a) => !(ids ?? []).includes(a.atleta_id))
          .slice(0, 8)
      : [];

  return (
    <div className="brutal p-3">
      <header className="flex items-center gap-2 border-b-2 border-dashed border-border pb-2">
        <img src={escudo(clubes[String(clubeId)], "45x45")} alt="" className="h-7 w-7 object-contain" />
        <h4 className="font-display text-base">Escalação provável</h4>
      </header>

      <ul className="mt-2 space-y-1">
        {escalados.map((a) => (
          <li key={a.atleta_id} className="flex items-center gap-2 brutal-sm bg-panel-2 px-2 py-1">
            <button onClick={() => onOpenPlayer(a)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
              {playerPhoto(a) ? (
                <img src={playerPhoto(a)!} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span className="h-7 w-7 rounded-full bg-secondary" />
              )}
              <span className="min-w-0 flex-1 truncate text-xs font-bold">
                {a.apelido}
                <span className="ml-1 font-normal text-muted-foreground">
                  {POS_ABREV[a.posicao_id]}
                  {subs?.[String(a.atleta_id)] ? ` · ${subs[String(a.atleta_id)]}` : ""} · méd {fmt(a.media_num, 1)}
                </span>
              </span>
            </button>
            {isAdmin && (
              <button
                onClick={() => void salvar((ids ?? []).filter((x) => x !== a.atleta_id))}
                className="text-xs text-destructive"
                title="Remover"
              >
                ✕
              </button>
            )}
          </li>
        ))}
        {!escalados.length && (
          <li className="py-2 text-center text-[11px] text-muted-foreground">
            Escalação provável ainda não publicada.
          </li>
        )}
      </ul>

      {isAdmin && (
        <div className="mt-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Adicionar jogador à provável"
            style={{ fontSize: 16 }}
            className="w-full brutal-sm bg-panel-2 px-2 py-1 text-xs outline-none"
          />
          {sugestoes.map((a) => (
            <button
              key={a.atleta_id}
              onClick={() => {
                void salvar([...(ids ?? []), a.atleta_id]);
                setBusca("");
              }}
              className="mt-1 block w-full brutal-sm bg-panel px-2 py-1 text-left text-xs"
            >
              + {a.apelido} ({POS_ABREV[a.posicao_id]})
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 border-t-2 border-dashed border-border pt-2">
        <p className="font-condensed text-[11px] uppercase text-destructive">Suspensos e lesionados</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {foraDeCombate.map((a) => (
            <button
              key={a.atleta_id}
              onClick={() => onOpenPlayer(a)}
              className="brutal-sm bg-panel-2 px-1.5 py-0.5 text-[10px]"
            >
              {a.apelido} · {STATUS_NOME[a.status_id]}
            </button>
          ))}
          {!foraDeCombate.length && <span className="text-[10px] text-muted-foreground">Nenhum desfalque listado.</span>}
        </div>
      </div>
    </div>
  );
}
