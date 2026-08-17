import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBestSG } from "@/lib/cartola.functions";
import type { Clube } from "@/lib/cartola-types";
import { escudo } from "@/lib/cartola-ui";

type Jogo = { rodada: number; adversario: number; golsPro: number; golsContra: number; resultado: "V" | "E" | "D" };

function corResultado(r: "V" | "E" | "D") {
  return r === "V" ? "text-success" : r === "D" ? "text-destructive" : "text-foreground";
}

function ListaConfrontos({
  titulo,
  clubeId,
  emCasa,
  jogos,
  clubes,
}: {
  titulo: string;
  clubeId: number;
  emCasa: boolean;
  jogos: Jogo[];
  clubes: Record<string, Clube>;
}) {
  const time = clubes[String(clubeId)];
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-1 text-center text-[11px] font-semibold text-muted-foreground">{titulo}</p>
      <div className="space-y-1">
        {jogos.slice(0, 5).map((g) => {
          const adv = clubes[String(g.adversario)];
          const mandante = emCasa ? time : adv;
          const visitante = emCasa ? adv : time;
          const gm = emCasa ? g.golsPro : g.golsContra;
          const gv = emCasa ? g.golsContra : g.golsPro;
          return (
            <div
              key={g.rodada}
              className="flex items-center gap-1.5 rounded-md border border-border bg-panel-2 px-2 py-1"
            >
              <span className="w-7 shrink-0 text-[10px] text-muted-foreground">R{g.rodada}</span>
              <img src={escudo(mandante, "30x30")} alt="" className="h-4 w-4 object-contain" />
              <span className={`font-display text-xs ${corResultado(g.resultado)}`}>
                {gm} <span className="text-muted-foreground">x</span> {gv}
              </span>
              <img src={escudo(visitante, "30x30")} alt="" className="h-4 w-4 object-contain" />
            </div>
          );
        })}
        {!jogos.length && <p className="text-center text-[10px] text-muted-foreground">Sem jogos.</p>}
      </div>
    </div>
  );
}

export function BestSGModal({ clubes, onClose }: { clubes: Record<string, Clube>; onClose: () => void }) {
  const fn = useServerFn(getBestSG);
  const [aberto, setAberto] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["best-sg"],
    queryFn: () => fn(),
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
            <h2 className="font-display text-lg tracking-wide sm:text-xl">Melhores SGs da rodada</h2>
            <p className="text-[11px] text-muted-foreground">Chance estimada de não sofrer gol, respeitando o mando.</p>
            <p className="text-[11px] font-semibold text-accent">Clique nos times para mais detalhes</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground">
            ✕
          </button>
        </header>
        <div className="space-y-2 overflow-y-auto p-3 sm:p-4">
          {isLoading && <p className="py-8 text-center text-muted-foreground">Analisando retrospecto por mando…</p>}
          {data?.ok &&
            data.ranking.map((r, i) => {
              const c = clubes[String(r.clube_id)];
              const adv = clubes[String(r.adversario)];
              const casa = clubes[String(r.clube_casa_id)];
              const visitante = clubes[String(r.clube_visitante_id)];
              const d = r.defesa;
              const a = r.ataqueAdversario;
              const key = `${r.clube_id}-${r.mando}`;
              const expandido = aberto === key;
              const formCasa = (r.mando === "casa" ? d : a) as unknown as { jogos: Jogo[] };
              const formFora = (r.mando === "casa" ? a : d) as unknown as { jogos: Jogo[] };
              return (
                <div key={key} className="rounded-lg border border-border bg-panel-2 p-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setAberto(expandido ? null : key)}
                    className="flex cursor-pointer items-center gap-2 rounded-md hover:bg-panel"
                  >
                    <span className="font-display text-sm text-accent">{i + 1}º</span>
                    <img src={escudo(casa, "45x45")} alt="" className="h-7 w-7 object-contain" />
                    <span className="text-xs text-muted-foreground">x</span>
                    <img src={escudo(visitante, "45x45")} alt="" className="h-7 w-7 object-contain" />
                    <span className="text-sm font-semibold">
                      {c?.abreviacao}
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                        {r.mando === "casa" ? "em casa" : "fora"}
                      </span>
                    </span>
                    <span className="ml-auto rounded-md border border-success/50 px-2 py-0.5 font-display text-[11px] text-success">
                      Chance de manter {r.chance}%
                    </span>
                  </div>

                  {expandido && (
                    <div className="mt-3 rounded-lg border border-border bg-panel p-2">
                      <p className="mb-2 text-center font-display text-xs tracking-wide">Últimos confrontos</p>
                      <div className="flex gap-2">
                        <ListaConfrontos
                          titulo={`${casa?.abreviacao ?? ""} em casa`}
                          clubeId={r.clube_casa_id}
                          emCasa
                          jogos={formCasa.jogos}
                          clubes={clubes}
                        />
                        <ListaConfrontos
                          titulo={`${visitante?.abreviacao ?? ""} fora`}
                          clubeId={r.clube_visitante_id}
                          emCasa={false}
                          jogos={formFora.jogos}
                          clubes={clubes}
                        />
                      </div>
                    </div>
                  )}

                  <p className="mt-2 text-[11px] text-muted-foreground">
                    <b className="text-foreground">{c?.abreviacao}</b> nos últimos {d.jogos.length} jogos{" "}
                    {r.mando === "casa" ? "em casa" : "fora"}: {d.vitorias}V {d.empates}E {d.derrotas}D · sofreu{" "}
                    <b className="text-destructive">{d.golsSofridos}</b> gols · preservou{" "}
                    <b className="text-success">{d.sgMantidos}</b> SGs
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    <b className="text-foreground">{adv?.abreviacao}</b> nos últimos {a.jogos.length} jogos{" "}
                    {r.mando === "casa" ? "fora" : "em casa"}: marcou {a.golsFeitos} gols · cedeu SG em{" "}
                    <b className="text-success">{a.sgCedidos}</b> jogos
                  </p>
                </div>
              );
            })}
          {data && !data.ok && <p className="text-center text-sm text-destructive">{data.error}</p>}
        </div>
      </div>
    </div>
  );
}
