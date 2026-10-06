import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import campinhoBg from "@/assets/campinho7.png.asset.json";
import { getCedimentosMapa } from "@/lib/cartola.functions";
import type { Atleta, Clube } from "@/lib/cartola-types";
import { escudo, fmt, isScoutNegative, playerPhoto } from "@/lib/cartola-ui";
import { SUB_NOME, useSubcategorias, type Sub } from "@/lib/subcategorias";

type Producao = { gols: number; assistencias: number; desarmes: number; defesas: number };

type Props = {
  clubes: Record<string, Clube>;
  atletas: Atleta[];
  producao: Record<string, Partial<Producao>>;
  onOpenPlayer: (a: Atleta) => void;
};

const POSICOES: Array<{ sub: string; x: number; y: number; nome: string }> = [
  { sub: "CA", x: 50, y: 9, nome: "Centroavante" },
  { sub: "PE", x: 17, y: 16, nome: "Ponta Esquerda" },
  { sub: "PD", x: 83, y: 16, nome: "Ponta Direita" },
  { sub: "MCO", x: 50, y: 33, nome: "Meia Ofensivo" },
  { sub: "ME", x: 17, y: 40, nome: "Meia Esquerda" },
  { sub: "MD", x: 83, y: 40, nome: "Meia Direita" },
  { sub: "VOL", x: 50, y: 55, nome: "Volante" },
  { sub: "LE", x: 14, y: 67, nome: "Lateral Esquerdo" },
  { sub: "LD", x: 86, y: 67, nome: "Lateral Direito" },
  { sub: "ZAE", x: 34, y: 76, nome: "Zagueiro Esq." },
  { sub: "ZAD", x: 66, y: 76, nome: "Zagueiro Dir." },
  { sub: "GOL", x: 50, y: 91, nome: "Goleiro" },
];

export function CedimentosMap({ clubes, atletas, producao, onOpenPlayer }: Props) {
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
  const rivalId = data?.ok ? data.adversarioProximo : null;
  const rival = rivalId ? clubes[String(rivalId)] : undefined;
  const alvo = detalhe && mapa ? mapa[detalhe] : null;

  const [escolher, setEscolher] = useState<string | null>(null);
  const [manualPorRival, setManualPorRival] = useState<Record<string, Record<string, number>>>({});
  const manual = rivalId ? (manualPorRival[String(rivalId)] ?? {}) : {};

  const elencoRival = useMemo(
    () => (rivalId ? atletas.filter((a) => a.clube_id === rivalId).sort((a, b) => b.media_num - a.media_num) : []),
    [atletas, rivalId],
  );

  // Provável do rival em cada subcategoria (escolha manual > prováveis > dúvidas, depois maior média)
  const provavelDoRival = useMemo(() => {
    const out: Record<string, Atleta> = {};
    if (!rivalId) return out;
    const doRival = atletas
      .filter((a) => a.clube_id === rivalId && (a.status_id === 7 || a.status_id === 2))
      .sort((a, b) => (a.status_id === 7 ? 0 : 1) - (b.status_id === 7 ? 0 : 1) || b.media_num - a.media_num);
    for (const a of doRival) {
      const s = a.posicao_id === 1 ? "GOL" : subs?.[String(a.atleta_id)];
      if (s && !out[s]) out[s] = a;
    }
    for (const [s, id] of Object.entries(manual)) {
      const a = atletas.find((x) => x.atleta_id === id);
      if (a) out[s] = a;
    }
    return out;
  }, [atletas, rivalId, subs, manual]);

  // Destaque: maior soma de produção + cedimento
  const destaque = useMemo(() => {
    if (!mapa) return null;
    let best: string | null = null;
    let bestV = -1;
    for (const p of POSICOES) {
      const c = mapa[p.sub];
      const a = provavelDoRival[p.sub];
      if (!c || !a || p.sub === "GOL") continue;
      const pr = producao[String(a.atleta_id)] ?? {};
      const v = (pr.gols ?? 0) * 2 + (pr.assistencias ?? 0) + c.gols * 2 + c.assistencias + c.mediaCedida / 2;
      if (v > bestV) {
        bestV = v;
        best = p.sub;
      }
    }
    return best;
  }, [mapa, provavelDoRival, producao]);

  const mandoRival = data?.ok ? (data.mando === "casa" ? "fora" : "casa") : "";

  return (
    <section className="space-y-3">
      <div className="brutal p-3">
        <h2 className="font-display text-xl">Mapa de Cedimentos</h2>
        <p className="text-[11px] text-muted-foreground">
          Escolha um time: o campo mostra os prováveis do adversário dele, o que cada um conquistou nos últimos 5
          jogos no mando e o que o time escolhido cedeu para aquela posição.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
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
        <div className="brutal p-2 sm:p-3">
          <div className="mb-2 flex flex-wrap items-center justify-center gap-2 font-condensed text-xs uppercase">
            <img src={escudo(clubes[String(clubeId)], "30x30")} alt="" className="h-6 w-6" />
            <span>
              {clubes[String(clubeId)]?.nome} ({data?.ok ? data.mando : ""})
            </span>
            <span className="text-muted-foreground">x</span>
            {rival && <img src={escudo(rival, "30x30")} alt="" className="h-6 w-6" />}
            <span>
              {rival?.nome ?? "—"} ({mandoRival})
            </span>
            <span className="text-muted-foreground">· rodada {data?.ok ? data.rodada : ""}</span>
          </div>
          <div
            className="relative mx-auto w-full max-w-[760px] overflow-hidden rounded border-2 border-foreground"
            style={{
              aspectRatio: "3 / 4.4",
              backgroundImage: `url(${campinhoBg.url})`,
              backgroundSize: "100% 100%",
            }}
          >
            {POSICOES.map((p) => {
              const cRaw = mapa[p.sub];
              const c = cRaw && cRaw.amostra > 0 ? cRaw : null;
              const a = provavelDoRival[p.sub];
              const pr = a ? (producao[String(a.atleta_id)] ?? {}) : {};
              const gol = p.sub === "GOL";
              const isDest = destaque === p.sub;
              return (
                <div
                  key={p.sub}
                  className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                >
                  <span className="mb-0.5 hidden font-condensed text-[10px] font-bold uppercase text-white drop-shadow sm:block">
                    {p.nome}
                  </span>
                  <button
                    onClick={() => (a ? c && setDetalhe(p.sub) : setEscolher(p.sub))}
                    className={`w-[78px] rounded-md border-2 bg-[#F2ECDC] p-1 text-center text-[#111] shadow-[3px_3px_0_#000] sm:w-[118px] sm:p-1.5 ${isDest ? "border-accent" : "border-foreground"}`}
                  >
                    <span className="block font-condensed text-[9px] font-bold uppercase sm:hidden">{p.sub}</span>
                    <img
                      src={a ? (playerPhoto(a) ?? escudo(rival, "45x45")) : escudo(rival, "45x45")}
                      alt=""
                      className="mx-auto h-7 w-7 rounded-full border border-foreground bg-white object-cover sm:h-10 sm:w-10"
                    />
                    <span className="block truncate text-[9px] font-bold sm:text-[11px]">
                      {a ? `[${p.sub}] ${a.apelido}` : "+ Escolher jogador"}
                    </span>
                    {a && manual[p.sub] && (
                      <span
                        role="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEscolher(p.sub);
                        }}
                        className="block text-[8px] font-bold underline"
                      >
                        trocar
                      </span>
                    )}
                    {isDest && (
                      <span className="block text-[8px] font-bold text-accent-foreground">★ DESTAQUE</span>
                    )}
                    <div className="mt-0.5 rounded bg-[#d8ecd9] px-0.5 py-0.5">
                      <span className="block font-condensed text-[7px] font-bold uppercase text-[#19713A] sm:text-[8px]">
                        Conquistou
                      </span>
                      <div className="flex justify-around text-[9px] font-bold text-[#19713A] sm:text-[11px]">
                        {gol ? (
                          <span title="Defesas">{pr.defesas ?? 0}<small className="block text-[6px] text-[#555]">DE</small></span>
                        ) : (
                          <>
                            <span>{pr.gols ?? 0}<small className="block text-[6px] text-[#555]">GOL</small></span>
                            <span>{pr.assistencias ?? 0}<small className="block text-[6px] text-[#555]">AST</small></span>
                          </>
                        )}
                        <span>{pr.desarmes ?? 0}<small className="block text-[6px] text-[#555]">DS</small></span>
                      </div>
                    </div>
                    <div className="mt-0.5 rounded bg-[#e2e0da] px-0.5 py-0.5">
                      <span className="block font-condensed text-[7px] font-bold uppercase text-[#444] sm:text-[8px]">
                        Rival cedeu {c ? "🔍" : ""}
                      </span>
                      {c ? (
                        <>
                          <div className="flex justify-around text-[9px] font-bold sm:text-[11px]">
                            {gol ? (
                              <>
                                <span>{c.defesas}<small className="block text-[6px] text-[#555]">DE</small></span>
                                <span>{c.sgCedidos}<small className="block text-[6px] text-[#555]">SG</small></span>
                              </>
                            ) : (
                              <>
                                <span className="text-[#C0392B]">{c.gols}<small className="block text-[6px] text-[#555]">GOL</small></span>
                                <span>{c.assistencias}<small className="block text-[6px] text-[#555]">AST</small></span>
                                <span>{c.desarmes}<small className="block text-[6px] text-[#555]">DS</small></span>
                              </>
                            )}
                          </div>
                          <span className="block text-[8px] font-bold sm:text-[10px]">MC {fmt(c.mediaCedida, 1)}</span>
                        </>
                      ) : (
                        <span className="block text-[7px] leading-tight text-[#555] sm:text-[9px]">
                          Não há números suficientes do rival cedeu
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {escolher && rivalId && (
        <div
          className="fixed inset-0 z-[96] flex items-center justify-center bg-background/85 p-3"
          onClick={() => setEscolher(null)}
        >
          <div className="flex max-h-[85vh] w-full max-w-md flex-col brutal bg-panel" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b-2 border-border p-3">
              <h3 className="font-display text-lg">
                Escolher {escolher === "GOL" ? "Goleiro" : SUB_NOME[escolher as Sub]} · {rival?.nome}
              </h3>
              <button onClick={() => setEscolher(null)}>✕</button>
            </header>
            <div className="flex-1 space-y-1 overflow-y-auto p-3">
              {elencoRival.map((a) => {
                const s = a.posicao_id === 1 ? "GOL" : (subs?.[String(a.atleta_id)] ?? "—");
                return (
                  <button
                    key={a.atleta_id}
                    onClick={() => {
                      setManualPorRival((m) => ({
                        ...m,
                        [String(rivalId)]: { ...(m[String(rivalId)] ?? {}), [escolher]: a.atleta_id },
                      }));
                      setEscolher(null);
                    }}
                    className={`flex w-full items-center justify-between brutal-sm px-2 py-1.5 text-left text-xs ${s === escolher ? "bg-primary text-primary-foreground" : "bg-panel-2"}`}
                  >
                    <span className="font-bold">[{s}] {a.apelido}</span>
                    <span>méd {fmt(a.media_num, 1)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {alvo && (
        <div
          className="fixed inset-0 z-[95] flex items-center justify-center bg-background/85 p-3"
          onClick={() => setDetalhe(null)}
        >
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col brutal bg-panel" onClick={(e) => e.stopPropagation()}>
            <header className="flex items-center justify-between border-b-2 border-border p-3">
              <div>
                <h3 className="font-display text-lg">
                  {alvo.sub === "GOL" ? "Goleiro" : SUB_NOME[alvo.sub as Sub]} contra {clubes[String(clubeId)]?.nome}
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Média cedida {fmt(alvo.mediaCedida, 2)} · amostra {alvo.amostra}
                 
                </p>
              </div>
              <button onClick={() => setDetalhe(null)}>✕</button>
            </header>
            <div className="flex-1 space-y-1.5 overflow-y-auto p-3">
              {alvo.jogos.map((j, i) => {
                const atl = atletas.find((x) => x.apelido === j.apelido);
                return (
                  <button
                    key={i}
                    onClick={() => atl && onOpenPlayer(atl)}
                    className="block w-full brutal-sm bg-panel-2 px-2 py-1.5 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-xs font-bold">
                        {atl && <img src={escudo(clubes[String(atl.clube_id)], "30x30")} alt="" className="h-4 w-4" />}
                        [{alvo.sub}] {j.apelido}
                      </span>
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
                  </button>
                );
              })}
              {!alvo.jogos.length && <p className="py-6 text-center text-sm text-muted-foreground">Não há números suficientes do rival cedeu.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
