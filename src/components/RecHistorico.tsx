import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getHistoricoRecomendacoes } from "@/lib/cartola.functions";
import type { Clube } from "@/lib/cartola-types";
import { POS_ABREV } from "@/lib/cartola-types";
import { escudo, fmt } from "@/lib/cartola-ui";

/** Sugestões das 3 rodadas anteriores x resultado real. */
export function RecHistorico({ tipo, clubes }: { tipo: "best" | "sg"; clubes: Record<string, Clube> }) {
  const fn = useServerFn(getHistoricoRecomendacoes);
  const { data, isLoading } = useQuery({
    queryKey: ["rec-historico"],
    queryFn: () => fn(),
    staleTime: 15 * 60_000,
  });
  const [idx, setIdx] = useState(0);
  const rodadas = data?.ok ? data.rodadas : [];
  const r = rodadas[idx];

  return (
    <section className="space-y-2 border-t-2 border-dashed border-border pt-3">
      <h3 className="font-display text-lg">Rodadas anteriores</h3>
      {isLoading && <p className="text-xs text-muted-foreground">Carregando histórico…</p>}
      {data && !data.ok && <p className="text-xs text-destructive">{data.error}</p>}
      <div className="flex gap-1.5">
        {rodadas.map((x, i) => (
          <button
            key={x.rodada}
            onClick={() => setIdx(i)}
            className={`brutal-sm px-2 py-0.5 font-condensed text-xs uppercase ${i === idx ? "bg-primary text-primary-foreground" : "bg-panel-2"}`}
          >
            Rodada {x.rodada}
          </button>
        ))}
      </div>
      {r && tipo === "best" && (
        <>
          {!r.best.length ? (
            <p className="text-xs text-muted-foreground">
              O app ainda não tinha registrado as Melhores Opções desta rodada. A partir de agora cada rodada fica salva.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-muted-foreground">
                Bateram a pontuação esperada:{" "}
                <b className="text-foreground">
                  {r.best.filter((b) => b.real !== null && b.real >= b.esperado).length}/{r.best.length}
                </b>
              </p>
              <ul className="space-y-1">
                {r.best.map((b) => (
                  <li key={b.atleta_id} className="flex items-center gap-2 brutal-sm bg-panel-2 px-2 py-1 text-xs">
                    <img src={escudo(clubes[String(b.clube_id)], "30x30")} alt="" className="h-4 w-4 object-contain" />
                    <span className="flex-1 truncate font-bold">
                      {b.sub ?? POS_ABREV[b.posicao_id]} {b.apelido}
                    </span>
                    <span className="text-muted-foreground">esp. {fmt(b.esperado, 1)}</span>
                    <b className={b.real === null ? "text-muted-foreground" : b.real >= b.esperado ? "text-success" : "text-destructive"}>
                      {b.real === null ? "não jogou" : `${fmt(b.real, 1)} pts`}
                    </b>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {r && tipo === "sg" && (
        <>
          <p className="text-[11px] text-muted-foreground">
            Assertividade:{" "}
            <b className="text-foreground">
              {r.sg.filter((g) => g.acertou).length}/{r.sg.filter((g) => g.acertou !== null).length} SGs confirmados
            </b>
          </p>
          <ul className="space-y-1">
            {r.sg.map((g) => (
              <li key={g.clube_id} className="flex items-center gap-2 brutal-sm bg-panel-2 px-2 py-1 text-xs">
                <img src={escudo(clubes[String(g.clube_id)], "30x30")} alt="" className="h-4 w-4 object-contain" />
                <span className="flex-1 truncate">
                  <b>{clubes[String(g.clube_id)]?.abreviacao}</b> x {clubes[String(g.adversario)]?.abreviacao} (
                  {g.mando === "casa" ? "casa" : "fora"}) · {g.chance}%
                </span>
                <b className={g.acertou === null ? "text-muted-foreground" : g.acertou ? "text-success" : "text-destructive"}>
                  {g.acertou === null ? "—" : g.acertou ? "✔ SG" : "✘ sofreu gol"}
                </b>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
