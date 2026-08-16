import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBestSG } from "@/lib/cartola.functions";
import type { Clube } from "@/lib/cartola-types";
import { escudo } from "@/lib/cartola-ui";

export function BestSGModal({
  clubes,
  onSelectMatch,
  onClose,
}: {
  clubes: Record<string, Clube>;
  onSelectMatch?: (casaId: number, foraId: number) => void;
  onClose: () => void;
}) {
  const fn = useServerFn(getBestSG);
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
              return (
                <div key={`${r.clube_id}-${r.mando}`} className="rounded-lg border border-border bg-panel-2 p-3">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectMatch?.(r.clube_casa_id, r.clube_visitante_id)}
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
                  <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    {d.jogos.map((g) => {
                      const mandante = r.mando === "casa" ? c : clubes[String(g.adversario)];
                      const vis = r.mando === "casa" ? clubes[String(g.adversario)] : c;
                      const sg = g.golsContra === 0;
                      return (
                        <span
                          key={g.rodada}
                          className={`flex items-center gap-1 rounded border px-1 py-0.5 ${sg ? "border-success text-success" : "border-border text-muted-foreground"}`}
                        >
                          R{g.rodada}
                          <img src={escudo(mandante, "30x30")} alt="" className="h-3.5 w-3.5 object-contain" />
                          {r.mando === "casa" ? g.golsPro : g.golsContra}x
                          {r.mando === "casa" ? g.golsContra : g.golsPro}
                          <img src={escudo(vis, "30x30")} alt="" className="h-3.5 w-3.5 object-contain" />
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          {data && !data.ok && <p className="text-center text-sm text-destructive">{data.error}</p>}
        </div>
      </div>
    </div>
  );
}
