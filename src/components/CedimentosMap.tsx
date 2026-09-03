import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getCedimentosMapa } from "@/lib/cartola.functions";
import type { Clube } from "@/lib/cartola-types";
import { escudo, fmt, isScoutNegative } from "@/lib/cartola-ui";
import { SUB_NOME, useSubcategorias, type Sub } from "@/lib/subcategorias";

type Props = { clubes: Record<string, Clube> };

const POSICOES: Array<{ sub: string; x: number; y: number }> = [
  { sub: "GOL", x: 50, y: 91 },
  { sub: "LD", x: 86, y: 74 },
  { sub: "ZAD", x: 63, y: 80 },
  { sub: "ZAE", x: 37, y: 80 },
  { sub: "LE", x: 14, y: 74 },
  { sub: "VOL", x: 50, y: 61 },
  { sub: "MD", x: 82, y: 47 },
  { sub: "ME", x: 18, y: 47 },
  { sub: "MCO", x: 50, y: 40 },
  { sub: "PD", x: 79, y: 20 },
  { sub: "PE", x: 21, y: 20 },
  { sub: "CA", x: 50, y: 13 },
];

export function CedimentosMap({ clubes }: Props) {
  const { data: subs } = useSubcategorias();
  const fn = useServerFn(getCedimentosMapa);
  const [clubeId, setClubeId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<string | null>(null);

  const lista = useMemo(
    () => Object.values(clubes).filter((c) => c.escudos).sort((a, b) => a.nome.localeCompare(b.nome)),
    [clubes],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["cedimentos-mapa", clubeId, subs ? Object.keys(subs).length : 0],
    enabled: !!clubeId,
    staleTime: 15 * 60_000,
    queryFn: () => fn({ data: { adversario: clubeId!, subs: subs ?? {} } }),
  });

  const mapa = data?.ok ? data.mapa : null;
  const alvo = detalhe && mapa ? mapa[detalhe] : null;

  return (
    <section className="space-y-3">
      <div className="brutal p-3">
        <h2 className="font-display text-xl">Mapa de Cedimentos</h2>
        <p className="text-[11px] text-muted-foreground">
          O que cada adversário cedeu por subcategoria nos últimos 5 jogos, respeitando o mando da próxima rodada.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button
            onClick={() => setClubeId(null)}
            className={`brutal-sm px-2 py-1 font-condensed text-[11px] uppercase ${!clubeId ? "bg-primary text-primary-foreground" : "bg-panel"}`}
          >
            Todos os times
          </button>
          {lista.map((c) => (
            <button
              key={c.id}
              onClick={() => setClubeId(c.id === clubeId ? null : c.id)}
              title={c.nome}
              className={`brutal-sm px-1.5 py-1 ${clubeId === c.id ? "bg-primary" : "bg-panel"}`}
            >
              <img src={escudo(c, "30x30")} alt={c.nome} className="h-6 w-6 object-contain" />
            </button>
          ))}
        </div>
      </div>

      {!clubeId && (
        <p className="brutal p-4 text-center text-sm text-muted-foreground">
          Selecione um time acima para ver o campinho de cedimentos.
        </p>
      )}

      {clubeId && isLoading && (
        <p className="brutal p-4 text-center font-condensed uppercase text-muted-foreground">Calculando cedimentos…</p>
      )}

      {clubeId && data && !data.ok && (
        <p className="brutal bg-destructive p-3 text-sm text-destructive-foreground">{data.error}</p>
      )}

      {mapa && (
        <div className="brutal p-3">
          <p className="mb-2 text-center font-condensed text-xs uppercase">
            {clubes[String(clubeId)]?.nome} joga {data?.ok ? data.mando : ""} na rodada {data?.ok ? data.rodada : ""} · dados
            de quem enfrentou o time no mando equivalente
          </p>
          <div
            className="relative w-full overflow-hidden rounded border-2 border-border"
            style={{
              paddingBottom: "125%",
              background: "repeating-linear-gradient(180deg, var(--color-pitch-a) 0 8%, var(--color-pitch-b) 8% 16%)",
            }}
          >
            {POSICOES.map((p) => {
              const c = mapa[p.sub];
              if (!c) return null;
              return (
                <button
                  key={p.sub}
                  onClick={() => setDetalhe(p.sub)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 brutal-sm bg-panel px-1.5 py-1 text-center"
                  style={{ left: `${p.x}%`, top: `${p.y}%`, minWidth: 62 }}
                >
                  <span className="block font-condensed text-[10px] uppercase">{p.sub}</span>
                  {p.sub === "GOL" ? (
                    <span className="block text-[9px] leading-tight">
                      DE {c.defesas} · SG {c.sgCedidos}
                    </span>
                  ) : (
                    <span className="block text-[9px] leading-tight">
                      G {c.gols} · A {c.assistencias} · DS {c.desarmes}
                    </span>
                  )}
                  <span className="block text-[9px] font-bold text-primary">MC {fmt(c.mediaCedida, 1)}</span>
                  {c.usouFallback && <span className="block text-[8px] text-muted-foreground">pos. geral</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {alvo && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-background/85 p-3"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col brutal bg-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b-2 border-border p-3">
              <div>
                <h3 className="font-display text-lg">
                  {alvo.sub === "GOL" ? "Goleiro" : SUB_NOME[alvo.sub as Sub]}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Média cedida {fmt(alvo.mediaCedida, 2)} · amostra {alvo.amostra}
                  {alvo.usouFallback ? " (posição geral)" : ""}
                </p>
              </div>
              <button onClick={() => setDetalhe(null)}>✕</button>
            </header>
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {alvo.jogos.map((j, i) => (
                <div key={i} className="brutal-sm bg-panel-2 px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{j.apelido}</span>
                    <span className={`text-xs font-bold ${j.pontuacao >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmt(j.pontuacao, 1)} pts · R{j.rodada}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-1 text-[10px]">
                    {Object.entries(j.scout)
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => (
                        <span key={k} className={isScoutNegative(k) ? "text-destructive" : "text-success"}>
                          {k} {v}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
              {!alvo.jogos.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">Sem dados suficientes.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
