import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { getBootstrap, getExpectedPoints, getMarketStatus, getMatchInsights, getNoticias, getParciais } from "@/lib/cartola.functions";
import type { Atleta, Clube, Partida } from "@/lib/cartola-types";
import { POS_ABREV, POS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, isEscalavel, isScoutNegative, playerPhoto } from "@/lib/cartola-ui";
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
import { computeMNO, liveValuation } from "@/lib/mno";

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

  // Ao reabrir o mercado, recarrega análises para incluir a rodada que passou.
  const qc = useQueryClient();
  const statusAnterior = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (statusAnterior.current === 2 && statusMercado === 1) {
      void qc.invalidateQueries();
    }
    statusAnterior.current = statusMercado;
  }, [statusMercado, qc]);



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

  const emManutencao = statusMercado === 3 || statusMercado === 4 || (data && !data.ok);
  const mercadoLabel = emManutencao ? "Mercado em Manutenção" : mercadoAberto ? "Mercado Aberto" : "Mercado Fechado";

  const partidasOrdenadas = useMemo(
    () => [...partidas].sort((a, b) => (a.partida_data ?? "").localeCompare(b.partida_data ?? "")),
    [partidas],
  );

  const jogadoresLista = useMemo(() => {
    const q = filtroNome.trim().toLowerCase();
    return atletas
      .filter((a) => (filtroPos ? a.posicao_id === filtroPos : true))
      .filter((a) => (q ? a.apelido.toLowerCase().includes(q) : true))
      .filter((a) => (soFavoritos ? favoritos.includes(a.atleta_id) : true))
      .sort((a, b) => b.media_num - a.media_num)
      .slice(0, 150);
  }, [atletas, filtroPos, filtroNome, soFavoritos, favoritos]);

  const noticias = noticiasResp?.ok ? noticiasResp.noticias : [];

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: "confrontos", label: "Confrontos" },
    { id: "campinho", label: "Campinho" },
    { id: "jogadores", label: "Jogadores" },
    { id: "noticias", label: "Notícias" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-3 pb-16 pt-3 sm:px-6">
      <div className="mb-3 brutal bg-primary px-3 py-1.5 text-center font-condensed text-[11px] uppercase tracking-widest text-primary-foreground">
        Dados e análises baseados nas últimas 5 rodadas · Rodada {rodadaAtual}
      </div>

      <header className="mb-3 flex items-end justify-between gap-3 border-b-2 border-border pb-2">
        <h1 className="font-display text-3xl leading-none sm:text-5xl">
          Box to <span className="text-primary">5</span>
        </h1>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => setSearch(true)}
            className="brutal-sm bg-panel px-2 py-1 font-condensed text-[11px] uppercase hover:bg-accent"
            title="Buscar jogador"
          >
            ⌕ Buscar
          </button>
          <button
            onClick={() => (userId ? supabase.auth.signOut() : setAuth(true))}
            className="brutal-sm bg-panel px-2 py-1 font-condensed text-[11px] uppercase hover:bg-accent"
          >
            {userId ? "Sair" : "Entrar"}
          </button>
        </div>
      </header>

      <div className="mb-3 brutal p-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span
            className={`brutal-sm px-2 py-0.5 font-condensed uppercase tracking-wide ${
              emManutencao
                ? "bg-accent text-accent-foreground"
                : mercadoAberto
                  ? "bg-primary text-primary-foreground"
                  : "bg-destructive text-destructive-foreground"
            }`}
          >
            {mercadoLabel}
          </span>
          {!!fechamento && mercadoAberto && !emManutencao && (
            <span className="font-condensed uppercase">
              Fecha em <Countdown timestamp={fechamento} />
            </span>
          )}
          <span className="ml-auto flex gap-2">
            <button
              onClick={() => setBest(true)}
              className="brutal-sm bg-primary px-2 py-1 font-condensed text-[11px] uppercase text-primary-foreground"
            >
              Melhores Opções →
            </button>
            <button
              onClick={() => setBestSG(true)}
              className="brutal-sm bg-accent px-2 py-1 font-condensed text-[11px] uppercase text-accent-foreground"
            >
              Melhores SG →
            </button>
          </span>
        </div>
      </div>

      <nav className="mb-4 flex gap-4 overflow-x-auto border-b-2 border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-0.5 shrink-0 border-b-4 px-1 pb-1.5 font-condensed text-sm uppercase tracking-wide ${
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-muted-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {!userId && !avisoFechado && (
        <div className="mb-3 flex items-center gap-2 brutal bg-accent px-3 py-2 text-xs text-accent-foreground">
          <span className="flex-1">Você está usando o app sem login. Suas alterações não serão salvas.</span>
          <button onClick={() => setAuth(true)} className="font-bold underline">
            Entrar
          </button>
          <button onClick={() => setAvisoFechado(true)}>✕</button>
        </div>
      )}

      {hint && (
        <div className="mb-3 flex items-center gap-2 brutal px-3 py-2 text-xs">
          <span className="flex-1">Para ver detalhes do jogador clique nele.</span>
          <button onClick={() => setHint(false)}>✕</button>
        </div>
      )}

      {isLoading && <p className="py-10 text-center font-condensed uppercase text-muted-foreground">Carregando mercado do Cartola…</p>}
      {data && !data.ok && (
        <p className="brutal bg-destructive p-4 text-center text-sm text-destructive-foreground">{data.error}</p>
      )}

      {data?.ok && tab === "confrontos" && (
        <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            <h2 className="font-display text-xl">Confrontos da rodada {rodadaAtual}</h2>
            {!mercadoAberto && !emManutencao && (
              <p className="font-condensed text-[11px] uppercase text-primary">
                Clique no confronto e confira as parciais
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              {partidasOrdenadas.map((p, i) => {
                const d = p.partida_data ? new Date(p.partida_data.replace(" ", "T")) : null;
                const ativo = match === p;
                return (
                  <button
                    key={i}
                    onClick={() => setMatch(ativo ? null : p)}
                    className={`brutal px-3 py-2 text-left ${ativo ? "bg-accent" : "bg-panel"}`}
                  >
                    <span className="flex items-center justify-center gap-2">
                      <img src={escudo(clubes[String(p.clube_casa_id)], "45x45")} alt="" className="h-8 w-8 object-contain" />
                      <span className="font-condensed text-xs uppercase">
                        {clubes[String(p.clube_casa_id)]?.abreviacao} x {clubes[String(p.clube_visitante_id)]?.abreviacao}
                      </span>
                      <img
                        src={escudo(clubes[String(p.clube_visitante_id)], "45x45")}
                        alt=""
                        className="h-8 w-8 object-contain"
                      />
                    </span>
                    <span className="mt-1 block text-center text-[10px] text-muted-foreground">
                      {d
                        ? d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                        : "Data a definir"}
                      {p.local ? ` · ${p.local}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>

            {match && (
              <article className="brutal p-3">
                <header className="border-b-2 border-dashed border-border pb-2 text-center">
                  <div className="flex items-center justify-center gap-4">
                    <img src={escudo(clubes[String(match.clube_casa_id)], "60x60")} alt="" className="h-12 w-12 object-contain" />
                    <span className="font-display text-lg">x</span>
                    <img
                      src={escudo(clubes[String(match.clube_visitante_id)], "60x60")}
                      alt=""
                      className="h-12 w-12 object-contain"
                    />
                  </div>
                  <p className="mt-1 font-condensed text-xs uppercase">
                    {matchData
                      ? matchData.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                      : "Data a definir"}
                    {match.local ? ` · ${match.local}` : ""}
                  </p>
                </header>
                <div className="space-y-3 pt-3">
                  {linhas.map((linha) => {
                    const max = Math.max(linha.casa.length, linha.fora.length);
                    if (!max) return null;
                    return (
                      <section key={linha.pos}>
                        <p className="mb-1 text-center font-condensed text-[11px] uppercase tracking-wide text-muted-foreground">
                          {POS_NOME[linha.pos]}
                        </p>
                        <div className="space-y-1.5">
                          {Array.from({ length: max }).map((_, i) => (
                            <div key={i} className="grid grid-cols-2 gap-2">
                              {[linha.casa[i], linha.fora[i]].map((a, side) =>
                                a ? (
                                  <button
                                    key={side}
                                    onClick={() => setAberto(a)}
                                    className="flex items-center gap-2 brutal-sm bg-panel-2 px-2 py-2 text-left"
                                  >
                                    {playerPhoto(a) ? (
                                      <img src={playerPhoto(a)!} alt="" className="h-8 w-8 rounded-full object-cover" />
                                    ) : (
                                      <span className="h-8 w-8 rounded-full bg-secondary" />
                                    )}
                                    <span className="min-w-0 flex-1">
                                      <span className="block truncate text-xs font-bold">{a.apelido}</span>
                                      {!mercadoAberto ? (
                                        (() => {
                                          const pts = parciais?.ok ? parciais.pontos[String(a.atleta_id)] : undefined;
                                          if (pts === undefined)
                                            return <span className="block text-[10px] text-muted-foreground">sem parcial</span>;
                                          const sc = parciais?.ok ? (parciais.scouts?.[String(a.atleta_id)] ?? {}) : {};
                                          const mno = computeMNO({
                                            rodada: rodadaAtual,
                                            preco_atual: a.preco_num,
                                            pontos_ultima: a.pontos_num,
                                            jogou_ultima: a.pontos_num !== 0,
                                            jogos_disputados: a.jogos_num,
                                          }).mno_estimado;
                                          const val = liveValuation(pts, mno);
                                          return (
                                            <>
                                              <span
                                                className={`block text-[11px] font-bold ${pts >= 0 ? "text-success" : "text-destructive"}`}
                                              >
                                                {fmt(pts, 1)} pts
                                              </span>
                                              <span className="flex flex-wrap gap-1 text-[9px]">
                                                {Object.entries(sc)
                                                  .filter(([, v]) => v > 0)
                                                  .map(([k, v]) => (
                                                    <span key={k} className={isScoutNegative(k) ? "text-destructive" : "text-success"}>
                                                      {k} {v}
                                                    </span>
                                                  ))}
                                              </span>
                                              <span
                                                className={`block text-[10px] font-bold ${val.status === "VALORIZANDO" ? "text-success" : "text-destructive"}`}
                                              >
                                                {val.texto_exibicao}
                                              </span>
                                            </>
                                          );
                                        })()
                                      ) : (
                                        <>
                                          <span className="block text-[10px] text-muted-foreground">
                                            {POS_ABREV[a.posicao_id]} · méd {fmt(a.media_num, 1)}
                                          </span>
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
                                        </>
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
              </article>
            )}
          </div>

          <aside className="space-y-3">
            <div className="brutal bg-ink p-3 text-panel">
              <h3 className="font-display text-xl text-panel">Sua rodada</h3>
              <p className="mt-1 text-[11px] text-panel/80">
                {board ? `${board.slots.filter((s) => s.atletaId).length} jogadores escalados` : "Monte seu time"}
              </p>
              <button
                onClick={() => setTab("campinho")}
                className="mt-3 w-full brutal-sm bg-primary px-2 py-1.5 font-condensed text-xs uppercase text-primary-foreground"
              >
                Ir para o campinho →
              </button>
            </div>
            <div className="brutal p-3">
              <h3 className="font-display text-base">Últimas notícias</h3>
              <ul className="mt-2 space-y-2">
                {noticias.slice(0, 5).map((n) => (
                  <li key={n.link} className="dashed-sep pt-2 first:border-0 first:pt-0">
                    <a href={n.link} target="_blank" rel="noreferrer" className="text-[11px] leading-snug hover:underline">
                      {n.titulo}
                    </a>
                  </li>
                ))}
                {!noticias.length && <li className="text-[11px] text-muted-foreground">Sem notícias no momento.</li>}
              </ul>
            </div>
          </aside>
        </section>
      )}

      {data?.ok && tab === "campinho" && (
        <section className="space-y-3">
          {boards.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {boards.map((b) => (
                <span key={b.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveId(b.id)}
                    className={`brutal-sm px-2 py-1 font-condensed text-xs uppercase ${b.id === activeId ? "bg-primary text-primary-foreground" : "bg-panel"}`}
                  >
                    {b.nome}
                  </button>
                  <button onClick={() => move(b.id, -1)} className="text-xs">←</button>
                  <button onClick={() => move(b.id, 1)} className="text-xs">→</button>
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
            className="w-full brutal-sm bg-panel py-2 font-condensed text-sm uppercase hover:bg-accent"
          >
            + Adicionar campinho
          </button>
        </section>
      )}

      {data?.ok && tab === "jogadores" && (
        <section className="space-y-3">
          <div className="brutal p-3">
            <div className="flex flex-wrap gap-2">
              <input
                value={filtroNome}
                onChange={(e) => setFiltroNome(e.target.value)}
                placeholder="Buscar por nome"
                style={{ fontSize: 16 }}
                className="min-w-[180px] flex-1 brutal-sm bg-panel-2 px-2 py-1 outline-none"
              />
              <button
                onClick={() => setSoFavoritos((v) => !v)}
                className={`brutal-sm px-2 py-1 font-condensed text-xs uppercase ${soFavoritos ? "bg-accent" : "bg-panel"}`}
              >
                ★ Favoritos
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => setFiltroPos(null)}
                className={`brutal-sm px-2 py-0.5 font-condensed text-[11px] uppercase ${!filtroPos ? "bg-primary text-primary-foreground" : "bg-panel"}`}
              >
                Todos
              </button>
              {[1, 2, 3, 4, 5, 6].map((p) => (
                <button
                  key={p}
                  onClick={() => setFiltroPos(filtroPos === p ? null : p)}
                  className={`brutal-sm px-2 py-0.5 font-condensed text-[11px] uppercase ${filtroPos === p ? "bg-primary text-primary-foreground" : "bg-panel"}`}
                >
                  {POS_NOME[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {jogadoresLista.map((a) => (
              <div key={a.atleta_id} className="flex items-center gap-2 brutal px-2 py-2">
                <button onClick={() => setAberto(a)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  {playerPhoto(a) ? (
                    <img src={playerPhoto(a)!} alt={a.apelido} className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary font-display text-xs">
                      {a.apelido.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <img src={escudo(clubes[String(a.clube_id)], "30x30")} alt="" className="h-5 w-5 object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">{a.apelido}</span>
                    <span className="block text-[10px] text-muted-foreground">
                      {POS_ABREV[a.posicao_id]} · méd {fmt(a.media_num, 1)} · C$ {fmt(a.preco_num, 2)}
                    </span>
                  </span>
                </button>
                <button
                  onClick={() => toggleFavorito(a.atleta_id)}
                  title="Favoritar"
                  className={`text-lg leading-none ${favoritos.includes(a.atleta_id) ? "text-accent" : "text-muted-foreground"}`}
                >
                  ★
                </button>
              </div>
            ))}
            {!jogadoresLista.length && (
              <p className="text-sm text-muted-foreground">Nenhum jogador encontrado.</p>
            )}
          </div>
        </section>
      )}

      {data?.ok && tab === "noticias" && (
        <section className="grid gap-3 sm:grid-cols-2">
          {noticias.map((n) => (
            <a
              key={n.link}
              href={n.link}
              target="_blank"
              rel="noreferrer"
              className="brutal p-3 hover:bg-accent"
            >
              <p className="font-condensed text-sm uppercase leading-snug">{n.titulo}</p>
              {n.data && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(n.data).toLocaleDateString("pt-BR")}
                </p>
              )}
            </a>
          ))}
          {!noticias.length && <p className="text-sm text-muted-foreground">Sem notícias no momento.</p>}
        </section>
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

      <p className="mt-6 text-center text-[10px] text-muted-foreground/70">
        {mounted
          ? `Atualizado às ${atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
          : ""}
      </p>
    </main>
  );
}
