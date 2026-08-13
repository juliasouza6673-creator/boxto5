import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBestSG } from "@/lib/cartola.functions";
import type { Clube } from "@/lib/cartola-types";
import { escudo } from "@/lib/cartola-ui";

export function BestSGModal({ clubes, onClose }: { clubes: Record<string, Clube>; onClose: () => void }) {
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
          <h2 className="font-display text-lg tracking-wide sm:text-xl">Melhores SGs da rodada</h2>
          <button onClick={onClose} className="text-muted-foreground">
            ✕
          </button>
        </header>
        <div className="space-y-2 overflow-y-auto p-3 sm:p-4">
          {isLoading && <p className="py-8 text-center text-muted-foreground">Analisando os últimos 5 jogos por mando…</p>}
          {data?.ok &&
            data.ranking.map((r, i) => {
              const c = clubes[String(r.clube_id)];
              const adv = clubes[String(r.adversario)];
              const d = r.defesa;
              const a = r.ataqueAdversario;
              return (
                <div key={`${r.clube_id}-${r.mando}`} className="rounded-lg border border-border bg-panel-2 p-3">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm text-accent">{i + 1}º</span>
                    <img src={escudo(c, "45x45")} alt="" className="h-7 w-7 object-contain" />
                    <span className="text-sm font-semibold">{c?.abreviacao}</span>
                    <span className="text-xs text-muted-foreground">x</span>
                    <img src={escudo(adv, "45x45")} alt="" className="h-6 w-6 object-contain" />
                    <span className="text-xs text-muted-foreground">{adv?.abreviacao}</span>
                    <span className="text-[11px] text-muted-foreground">
                      · {r.mando === "casa" ? "em casa" : "fora"}
                    </span>
                    <span className="ml-auto rounded-md border border-success/50 px-2 py-0.5 font-display text-[11px] text-success">
                      SG {Math.round(r.score)}
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
                  <p className="mt-1 flex flex-wrap gap-1 text-[10px]">
                    {d.jogos.map((g) => (
                      <span
                        key={g.rodada}
                        className={`rounded border px-1 ${g.resultado === "V" ? "border-success text-success" : g.resultado === "E" ? "border-border text-muted-foreground" : "border-destructive text-destructive"}`}
                      >
                        R{g.rodada} {g.golsPro}x{g.golsContra}
                      </span>
                    ))}
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
