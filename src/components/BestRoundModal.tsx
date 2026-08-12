import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getBestOfRound } from "@/lib/cartola.functions";
import type { Clube } from "@/lib/cartola-types";
import { POS_NOME } from "@/lib/cartola-types";
import { escudo, fmt } from "@/lib/cartola-ui";

export function BestRoundModal({ clubes, onClose }: { clubes: Record<string, Clube>; onClose: () => void }) {
  const fn = useServerFn(getBestOfRound);
  const { data, isLoading } = useQuery({
    queryKey: ["best-of-round"],
    queryFn: () => fn(),
    staleTime: 15 * 60_000,
  });

  const exportar = () => window.print();

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-background/85 p-3" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-display text-xl tracking-wide">Melhores opções para a rodada</h2>
          <button onClick={onClose} className="text-muted-foreground">
            ✕
          </button>
        </header>
        <div className="space-y-5 overflow-y-auto p-4">
          {isLoading && <p className="py-8 text-center text-muted-foreground">Cruzando médias e cedimentos…</p>}
          {data?.ok &&
            [1, 2, 3, 4, 5].map((pos) => (
              <section key={pos}>
                <h3 className="mb-2 font-display tracking-wide text-accent">{POS_NOME[pos]}</h3>
                <div className="space-y-1.5">
                  {(data.byPos[String(pos)] ?? []).map((p) => {
                    const adv = clubes[String(p.adversario)];
                    const clube = clubes[String(p.clube_id)];
                    return (
                      <div
                        key={p.atleta_id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm"
                      >
                        <img src={escudo(clube, "30x30")} alt="" className="h-5 w-5 object-contain" />
                        <span className="min-w-0 flex-1 truncate font-semibold">{p.apelido}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          {p.mando === "casa" ? "casa" : "fora"} x
                          <img src={escudo(adv, "30x30")} alt="" className="h-4 w-4 object-contain" />
                        </span>
                        <span className="text-xs">
                          média <b>{fmt(p.media, 1)}</b> · cede <b>{fmt(p.mediaCedida, 1)}</b> · {p.jogos}j
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          {data && !data.ok && <p className="text-center text-sm text-destructive">{data.error}</p>}
        </div>
        <footer className="border-t border-border p-3">
          <button onClick={exportar} className="w-full rounded-lg border border-accent py-2 text-sm text-accent">
            Exportar análise (PDF)
          </button>
        </footer>
      </div>
    </div>
  );
}
