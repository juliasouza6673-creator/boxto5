import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBootstrap, getExpectedPoints, getMarketStatus, getMatchInsights, getNoticias, getParciais } from "@/lib/cartola.functions";
import type { Atleta, Clube, Partida } from "@/lib/cartola-types";
import { POS_ABREV, POS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, isEscalavel, playerPhoto } from "@/lib/cartola-ui";
import { useBoards, type SlotState } from "@/lib/board";
import { MatchTicker } from "@/components/MatchTicker";
import { Pitch } from "@/components/Pitch";
import { PlayerPicker } from "@/components/PlayerPicker";
import { PlayerModal } from "@/components/PlayerModal";
import { BestRoundModal } from "@/components/BestRoundModal";
import { BestSGModal } from "@/components/BestSGModal";
import { AuthDialog } from "@/components/AuthDialog";
import { AdvancedTools, type FillScope } from "@/components/AdvancedTools";
import { PlayerSearch } from "@/components/PlayerSearch";
import { computeMNO } from "@/lib/mno";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Box to 5 — escalação e análise de cedimentos do Cartola FC" },
      {
        name: "description",
        content:
          "Monte escalações no campo tático, veja médias por mando, cedimentos do adversário e as melhores opções da rodada do Cartola FC.",
      },
      { property: "og:title", content: "Box to 5 — escalação e scouts do Cartola FC" },
      {
        property: "og:description",
        content: "Campo tático editável, cedimentos automáticos e dicas por confronto para a sua rodada.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const HINT_KEY = "taticspro.hint.playerclick";

function Countdown({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className="font-display tracking-wide text-success">…</span>;
  const diff = Math.max(0, timestamp * 1000 - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <span className="font-display tracking-wide text-success">
      {d} dias, {h} horas, {m} minutos e {s} segundos
    </span>
  );
}

function Index() {
  const bootstrapFn = useServerFn(getBootstrap);
  const statusFn = useServerFn(getMarketStatus);
  const expectedFn = useServerFn(getExpectedPoints);
  const insightsFn = useServerFn(getMatchInsights);
  const { data, isLoading } = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => bootstrapFn(),
    staleTime: 3 * 60_000,
    refetchInterval: 3 * 60_000,
  });
  const { data: live } = useQuery({
    queryKey: ["market-status"],
    queryFn: () => statusFn(),
    refetchInterval: 60_000,
  });

  const { boards, activeId, setActiveId, update, add, remove, move, userId } = useBoards();
  const [picker, setPicker] = useState<{ slot: SlotState; bench: boolean } | null>(null);
  const [aberto, setAberto] = useState<Atleta | null>(null);
  const [best, setBest] = useState(false);
  const [bestSG, setBestSG] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [auth, setAuth] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [match, setMatch] = useState<Partida | null>(null);
  const [avisoFechado, setAvisoFechado] = useState(false);
  const [hint, setHint] = useState(false);
  const [search, setSearch] = useState(false);
  const [addTarget, setAddTarget] = useState<{ slotId: string; bench: boolean } | null>(null);

  useEffect(() => {
    if (userId) return;
    setAvisoFechado(false);
    const t = setTimeout(() => setAvisoFechado(true), 7000);
    return () => clearTimeout(t);
  }, [userId]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 7000);
    return () => clearTimeout(t);
  }, [hint]);

  const atletas: Atleta[] = data?.ok ? data.mercado.atletas : [];
  const clubes: Record<string, Clube> = data?.ok ? data.mercado.clubes : {};
  const partidas: Partida[] = data?.ok ? data.partidas.partidas : [];
  const esquemas = data?.ok ? data.esquemas : [];
  const atletasById = useMemo(() => new Map(atletas.map((a) => [a.atleta_id, a])), [atletas]);
  const board = boards.find((b) => b.id === activeId) ?? boards[0];

  const showHintOnce = () => {
    try {
      if (localStorage.getItem(HINT_KEY)) return;
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
    setHint(true);
  };

  const titulares = useMemo(
    () =>
      (board?.slots ?? [])
        .map((s) => (s.atletaId ? atletasById.get(s.atletaId) : null))
        .filter((a): a is Atleta => !!a)
        .map((a) => ({ atletaId: a.atleta_id, clubeId: a.clube_id, posicaoId: a.posicao_id })),
    [board?.slots, atletasById],
  );

  const { data: esperado } = useQuery({
    queryKey: ["expected", titulares.map((t) => t.atletaId).sort().join(",")],
    enabled: titulares.length > 0,
    staleTime: 10 * 60_000,
    queryFn: () => expectedFn({ data: { jogadores: titulares } }),
  });

  const noticiasFn = useServerFn(getNoticias);
  const { data: noticiasResp } = useQuery({
    queryKey: ["noticias"],
    queryFn: () => noticiasFn(),
    staleTime: 15 * 60_000,
    refetchInterval: 15 * 60_000,
  });

  const parciaisFn = useServerFn(getParciais);
  const { data: parciais } = useQuery({
    queryKey: ["parciais"],
    queryFn: () => parciaisFn(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const recomendados = useMemo(() => {
    const casaOuFora = new Map<number, "casa" | "fora">();
    for (const p of partidas) {
      casaOuFora.set(p.clube_casa_id, "casa");
      casaOuFora.set(p.clube_visitante_id, "fora");
    }
    return atletas
      .filter((a) => isEscalavel(a) && a.jogos_num >= 3 && a.media_num >= 4.5 && casaOuFora.get(a.clube_id) === "casa")
      .map((a) => a.atleta_id);
  }, [atletas, partidas]);

  const preencher = (clubeId: number, scope: FillScope) => {
    if (!board) return;
    const posSet =
      scope === "todos" ? [1, 2, 3, 4, 5, 6] : scope === "defesa" ? [1, 2, 3, 6] : scope === "meias" ? [4] : [5];
    const pool = atletas
      .filter((a) => a.clube_id === clubeId && (a.status_id === 7 || a.status_id === 2))
      .sort((a, b) => b.media_num - a.media_num);
    update(board.id, (b) => {
      const usados = new Set<number>();
      return {
        ...b,
        slots: b.slots.map((s) => {
          if (!posSet.includes(s.pos)) return s;
          const cand = pool.find((a) => a.posicao_id === s.pos && !usados.has(a.atleta_id));
          if (!cand) return s;
          usados.add(cand.atleta_id);
          return { ...s, atletaId: cand.atleta_id };
        }),
      };
    });
  };

  const venderAtleta = (atletaId: number) => {
    if (!board) return;
    update(board.id, (b) => ({
      ...b,
      slots: b.slots
        .filter((s) => !(s.extra && s.atletaId === atletaId))
        .map((s) => (s.atletaId === atletaId ? { ...s, atletaId: null } : s)),
      bench: b.bench.map((s) => (s.atletaId === atletaId ? { ...s, atletaId: null } : s)),
    }));
  };

  const noCampinho = (id: number) =>
    !!board && [...board.slots, ...board.bench].some((s) => s.atletaId === id);

  const fechamento = live?.ok ? live.status.fechamento?.timestamp : data?.ok ? data.status.fechamento?.timestamp : 0;
  const statusMercado = live?.ok ? live.status.status_mercado : data?.ok ? data.status.status_mercado : undefined;
  const mercadoAberto = statusMercado === 1;
  const atualizado = new Date(live?.ok ? live.atualizadoEm : (data?.ok ? data.atualizadoEm : Date.now()));

  const matchData = match?.partida_data ? new Date(match.partida_data.replace(" ", "T")) : null;
  const { data: insights } = useQuery({
    queryKey: ["match-insights", match?.clube_casa_id, match?.clube_visitante_id],
    enabled: !!match,
    staleTime: 15 * 60_000,
    queryFn: () =>
      insightsFn({ data: { casa: match!.clube_casa_id, fora: match!.clube_visitante_id } }),
  });
  const linhas = useMemo(() => {
    if (!match) return [] as Array<{ pos: number; casa: Atleta[]; fora: Atleta[] }>;
    const sel = (clubeId: number, pos: number) =>
      atletas
        .filter((a) => a.clube_id === clubeId && a.posicao_id === pos && (a.status_id === 7 || a.status_id === 2))
        .sort((x, y) => y.media_num - x.media_num);
    return [1, 2, 3, 4, 5, 6].map((pos) => ({
      pos,
      casa: sel(match.clube_casa_id, pos),
      fora: sel(match.clube_visitante_id, pos),
    }));
  }, [match, atletas]);

  const rodadaAtual = (live?.ok ? live.status.rodada_atual : data?.ok ? data.status.rodada_atual : 1) ?? 1;

  const valorizacaoTotal = useMemo(() => {
    if (!board) return 0;
    return board.slots.reduce((soma, sl) => {
      const a = sl.atletaId ? atletasById.get(sl.atletaId) : undefined;
      if (!a) return soma;
      const mno = computeMNO({
        rodada: rodadaAtual,
        preco_atual: a.preco_num,
        pontos_ultima: a.pontos_num,
        jogou_ultima: a.pontos_num !== 0,
        jogos_disputados: a.jogos_num,
      });
      return soma + mno.mno_estimado;
    }, 0);
  }, [board, atletasById, rodadaAtual]);

  const adicionarAtleta = (a: Atleta) => {
    if (!board) return;
    const alvo = addTarget;
    update(board.id, (b) => {
      if (alvo) {
        return {
          ...b,
          slots: alvo.bench ? b.slots : b.slots.map((s) => (s.id === alvo.slotId ? { ...s, atletaId: a.atleta_id } : s)),
          bench: alvo.bench ? b.bench.map((s) => (s.id === alvo.slotId ? { ...s, atletaId: a.atleta_id } : s)) : b.bench,
        };
      }
      const livre = b.slots.find((s) => s.pos === a.posicao_id && !s.atletaId);
      if (livre) {
        return { ...b, slots: b.slots.map((s) => (s.id === livre.id ? { ...s, atletaId: a.atleta_id } : s)) };
      }
      const banco = b.bench.find((s) => s.pos === a.posicao_id && !s.atletaId) ?? b.bench.find((s) => !s.atletaId);
      if (banco) {
        return { ...b, bench: b.bench.map((s) => (s.id === banco.id ? { ...s, atletaId: a.atleta_id } : s)) };
      }
      return {
        ...b,
        slots: [
          ...b.slots,
          { id: crypto.randomUUID(), pos: a.posicao_id, x: 50, y: 50, atletaId: a.atleta_id, extra: true },
        ],
      };
    });
    setAddTarget(null);
    showHintOnce();
  };

  return (
    <main className="mx-auto max-w-4xl px-3 pb-16 pt-3 sm:px-6">
      <header className="mb-3 flex items-start justify-between gap-3">
        <h1 className="font-display text-2xl uppercase leading-tight tracking-wide sm:text-3xl">
          Box to <span className="text-accent">5</span>
        </h1>
        <div className="flex shrink-0 items-start gap-3">
          <button
            onClick={() => setSearch(true)}
            className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-accent"
            title="Buscar jogador"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.5 4.5" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-semibold">Buscar</span>
          </button>
          <button
            onClick={() => (userId ? supabase.auth.signOut() : setAuth(true))}
            className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-accent"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
              <circle cx="12" cy="8" r="3.5" />
              <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
            </svg>
            <span className="text-[10px] font-semibold">{userId ? "Sair" : "Entrar"}</span>
          </button>
        </div>
      </header>

      <div className="mb-3 rounded-xl border border-border bg-panel px-3 py-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {statusMercado !== undefined && (
            <span
              className={`rounded-md border px-2 py-0.5 font-display tracking-wide ${mercadoAberto ? "border-success text-success" : "border-destructive text-destructive"}`}
            >
              Mercado {mercadoAberto ? "Aberto" : "Fechado"}
            </span>
          )}
          {!!fechamento && (
            <span>
              Fecha em <Countdown timestamp={fechamento} />
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            onClick={() => setBest(true)}
            className="rounded-lg border border-accent px-2 py-1.5 text-[11px] font-semibold text-accent sm:text-xs"
          >
            Melhores opções para rodada
          </button>
          <button
            onClick={() => setBestSG(true)}
            className="rounded-lg border border-success px-2 py-1.5 text-[11px] font-semibold text-success sm:text-xs"
          >
            Melhores SGs
          </button>
        </div>
      </div>


      {!userId && !avisoFechado && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-warning/50 bg-panel px-3 py-2 text-xs">
          <span className="flex-1">Você está usando o app sem login. Suas alterações não serão salvas.</span>
          <button onClick={() => setAuth(true)} className="font-semibold text-accent">
            Entrar
          </button>
          <button onClick={() => setAvisoFechado(true)} className="text-muted-foreground">
            ✕
          </button>
        </div>
      )}

      {hint && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-accent/50 bg-panel px-3 py-2 text-xs">
          <span className="flex-1">Para ver detalhes do jogador clique nele.</span>
          <button onClick={() => setHint(false)} className="text-muted-foreground">
            ✕
          </button>
        </div>
      )}

      {isLoading && <p className="py-10 text-center text-muted-foreground">Carregando mercado do Cartola…</p>}
      {data && !data.ok && (
        <p className="rounded-xl border border-destructive/50 bg-panel p-4 text-center text-sm text-destructive">
          {data.error}
        </p>
      )}

      {data?.ok && (
        <div className="space-y-3">
          <MatchTicker
            partidas={partidas}
            clubes={clubes}
            noticias={noticiasResp?.ok ? noticiasResp.noticias : []}
            mercadoAberto={statusMercado !== 2}
            onSelectMatch={setMatch}
          />

          {boards.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {boards.map((b) => (
                <span key={b.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveId(b.id)}
                    className={`rounded-lg border px-2 py-1 text-xs ${b.id === activeId ? "border-accent text-accent" : "border-border text-muted-foreground"}`}
                  >
                    {b.nome}
                  </button>
                  <button onClick={() => move(b.id, -1)} className="text-xs text-muted-foreground">
                    ←
                  </button>
                  <button onClick={() => move(b.id, 1)} className="text-xs text-muted-foreground">
                    →
                  </button>
                </span>
              ))}
            </div>
          )}

          {board && (
            <Pitch
              board={board}
              esquemas={esquemas}
              atletas={atletas}
              atletasById={atletasById}
              clubes={clubes}
              recomendados={recomendados}
              esperadoTotal={valorizacaoTotal}
              mercadoAberto={statusMercado !== 2}
              rodada={rodadaAtual}
              parciais={parciais?.ok ? parciais.pontos : {}}

              cedidas={esperado?.ok ? esperado.cedidas : {}}
              onChange={(patch) => update(board.id, patch)}
              onSlotClick={(slot) => setPicker({ slot, bench: false })}
              onBenchClick={(slot) => setPicker({ slot, bench: true })}
              onPlayerClick={setAberto}
              onOpenAdvanced={() => setAdvanced(true)}
              onRename={(nome) => update(board.id, (b) => ({ ...b, nome }))}
              onDelete={() => {
                if (window.confirm("Excluir este campinho?")) remove(board.id);
              }}
            />
          )}

          <button
            onClick={add}
            className="w-full rounded-xl border border-dashed border-border py-2 text-sm text-muted-foreground hover:border-accent hover:text-accent"
          >
            + Adicionar campinho
          </button>
        </div>
      )}

      {picker && board && (
        <PlayerPicker
          posicaoId={picker.slot.pos}
          atletas={atletas}
          clubes={clubes}
          usados={[...board.slots, ...board.bench].map((s) => s.atletaId).filter(Boolean) as number[]}
          recomendados={recomendados}
          onPick={(a) => {
            setAddTarget({ slotId: picker.slot.id, bench: picker.bench });
            setPicker(null);
            setAberto(a);
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {advanced && (
        <AdvancedTools clubes={clubes} atletas={atletas} onFill={preencher} onClose={() => setAdvanced(false)} />
      )}

      {aberto && (
        <PlayerModal
          atleta={aberto}
          atletas={atletas}
          clubes={clubes}
          onOpenPlayer={setAberto}
          onAdd={
            !noCampinho(aberto.atleta_id)
              ? () => {
                  adicionarAtleta(aberto);
                  setAberto(null);
                }
              : undefined
          }
          onSell={
            noCampinho(aberto.atleta_id)
              ? () => {
                  venderAtleta(aberto.atleta_id);
                  setAberto(null);
                }
              : undefined
          }
          onClose={() => {
            setAberto(null);
            setAddTarget(null);
          }}
        />
      )}

      {search && (
        <PlayerSearch
          atletas={atletas}
          clubes={clubes}
          onPick={(a) => {
            setAddTarget(null);
            setSearch(false);
            setAberto(a);
          }}
          onClose={() => setSearch(false)}
        />
      )}

      {best && (
        <BestRoundModal
          clubes={clubes}
          atletas={atletas}
          onOpenPlayer={(a) => {
            setBest(false);
            setAberto(a);
          }}
          onClose={() => setBest(false)}
        />
      )}
      {bestSG && <BestSGModal clubes={clubes} onClose={() => setBestSG(false)} />}

      {auth && <AuthDialog onClose={() => setAuth(false)} />}

      {match && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-background/85 p-0 sm:items-center sm:p-4"
          onClick={() => setMatch(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-t-2xl border border-border bg-panel sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="relative border-b border-border p-4 text-center">
              <button onClick={() => setMatch(null)} className="absolute right-4 top-4 text-muted-foreground">
                ✕
              </button>
              <div className="flex items-center justify-center gap-4">
                <div className="flex flex-col items-center gap-1">
                  <img src={escudo(clubes[String(match.clube_casa_id)], "60x60")} alt="" className="h-12 w-12 object-contain" />
                  <span className="text-[11px] text-muted-foreground">
                    {clubes[String(match.clube_casa_id)]?.abreviacao}
                  </span>
                </div>
                <span className="font-display text-lg">x</span>
                <div className="flex flex-col items-center gap-1">
                  <img
                    src={escudo(clubes[String(match.clube_visitante_id)], "60x60")}
                    alt=""
                    className="h-12 w-12 object-contain"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {clubes[String(match.clube_visitante_id)]?.abreviacao}
                  </span>
                </div>
              </div>
              <p className="mt-2 text-xs text-accent">
                {matchData
                  ? matchData.toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Data a definir"}
              </p>
              <p className="text-xs text-muted-foreground">{match.local ?? ""}</p>
            </header>
            <div className="space-y-3 overflow-y-auto p-3">
              {linhas.map((linha) => {
                const max = Math.max(linha.casa.length, linha.fora.length);
                if (!max) return null;
                return (
                  <section key={linha.pos}>
                    <p className="mb-1 text-center font-display text-[11px] tracking-wide text-muted-foreground">
                      {POS_NOME[linha.pos]}
                    </p>
                    <div className="space-y-1.5">
                      {Array.from({ length: max }).map((_, i) => (
                        <div key={i} className="grid grid-cols-2 gap-2">
                          {[linha.casa[i], linha.fora[i]].map((a, side) =>
                            a ? (
                              <button
                                key={side}
                                onClick={() => {
                                  setAberto(a);
                                  setMatch(null);
                                }}
                                className="flex items-center gap-2 rounded-lg border border-border bg-panel-2 px-2 py-2 text-left"
                              >
                                {playerPhoto(a) ? (
                                  <img src={playerPhoto(a)!} alt="" className="h-8 w-8 rounded-full object-cover" />
                                ) : (
                                  <span className="h-8 w-8 rounded-full bg-secondary" />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-xs">{a.apelido}</span>
                                  <span className="block text-[10px] text-muted-foreground">
                                    {POS_ABREV[a.posicao_id]} · méd {fmt(a.media_num, 1)}
                                  </span>
                                  {!mercadoAberto && (
                                    <span className="block text-[10px] font-bold text-accent">
                                      {parciais?.ok && parciais.pontos[String(a.atleta_id)] !== undefined
                                        ? `parcial ${fmt(parciais.pontos[String(a.atleta_id)] ?? 0, 1)} pts`
                                        : "sem parcial"}
                                    </span>
                                  )}
                                  {insights?.ok && (
                                    <span className="block text-[10px]">
                                      <span className="text-success">
                                        cede {fmt(insights.cedida[`${side === 0 ? "casa" : "fora"}-${a.posicao_id}`] ?? 0, 1)}
                                      </span>{" "}
                                      <span className="text-foreground/80">
                                        mando {fmt(insights.mediaMando[String(a.atleta_id)] ?? 0, 1)}
                                      </span>
                                    </span>
                                  )}
                                </span>

                              </button>
                            ) : (
                              <span key={side} />
                            ),
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <p className="mt-6 text-center text-[10px] text-muted-foreground/70">
        {mounted
          ? `Atualizado às ${atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          : ""}
      </p>
    </main>
  );
}
