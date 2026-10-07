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
import { Pitch } from "@/components/Pitch";
import { PlayerPicker } from "@/components/PlayerPicker";
import { PlayerModal } from "@/components/PlayerModal";
import { BestRoundModal } from "@/components/BestRoundModal";
import { BestSGModal } from "@/components/BestSGModal";
import { AuthDialog } from "@/components/AuthDialog";
import { AdvancedTools, type FillScope } from "@/components/AdvancedTools";
import { PlayerSearch } from "@/components/PlayerSearch";
import { computeMNO, liveValuation } from "@/lib/mno";
import { CedimentosMap } from "@/components/CedimentosMap";
import { PlayersCompare } from "@/components/PlayersCompare";
import { SubcategoriaAdmin } from "@/components/SubcategoriaAdmin";
import { HomeSection } from "@/components/HomeSection";
import { PlayersTable } from "@/components/PlayersTable";
import { ConfrontoPitches } from "@/components/ConfrontoPitches";
import { useIsAdmin, useSubcategorias } from "@/lib/subcategorias";
import { aplicarStatus, useStatusOverrides } from "@/lib/status";
import { getTabelaJogadores } from "@/lib/cartola.functions";

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
const FAV_KEY = "boxto5.favoritos";

type TabId = "inicio" | "confrontos" | "campinho" | "jogadores" | "mapa";

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
  const [tab, setTab] = useState<TabId>("inicio");
  const [filtroPos, setFiltroPos] = useState<number | null>(null);
  const [filtroNome, setFiltroNome] = useState("");
  const [soFavoritos, setSoFavoritos] = useState(false);
  const [favoritos, setFavoritos] = useState<number[]>([]);
  const [subTab, setSubTab] = useState<"atletas" | "comparativo">("atletas");
  const { data: subs } = useSubcategorias();
  const { data: isAdmin } = useIsAdmin(userId ?? null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) setFavoritos(JSON.parse(raw) as number[]);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFavorito = (id: number) => {
    setFavoritos((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

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

  const { data: overrides } = useStatusOverrides();
  const atletas: Atleta[] = useMemo(
    () => aplicarStatus(data?.ok ? data.mercado.atletas : [], overrides),
    [data, overrides],
  );
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
      .filter((a) => a.clube_id === clubeId && (a.status_id !== 6 && a.status_id !== 3))
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

  const tabelaFn = useServerFn(getTabelaJogadores);
  const { data: snap } = useQuery({
    queryKey: ["tabela-jogadores", subs ? Object.keys(subs).length : 0],
    enabled: !!data?.ok,
    staleTime: 15 * 60_000,
    queryFn: () => tabelaFn({ data: { subs: subs ?? {} } }),
  });

  const { cedidaPorAtleta, mediaMandoPorAtleta } = useMemo(() => {
    const ced: Record<string, number> = {};
    const mm: Record<string, number> = {};
    if (snap?.ok) {
      for (const a of atletas) {
        const id = String(a.atleta_id);
        const sub = a.posicao_id === 1 ? "GOL" : subs?.[id];
        const adv = snap.adversario[String(a.clube_id)];
        const c = adv !== undefined && sub ? snap.cedidas[`${adv}-${sub}`] : undefined;
        if (c) ced[id] = c.mediaCedida;
        const j = snap.jogadores[id];
        if (j) mm[id] = j.mediaMando;
      }
    }
    return { cedidaPorAtleta: ced, mediaMandoPorAtleta: mm };
  }, [snap, atletas, subs]);

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: "inicio", label: "Início" },
    { id: "confrontos", label: "Confrontos" },
    { id: "campinho", label: "Campinho" },
    { id: "jogadores", label: "Jogadores" },
    { id: "mapa", label: "Mapa de Cedimentos" },
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
            <ConfrontoPitches
              partidas={partidasOrdenadas}
              rodada={rodadaAtual}
              clubes={clubes}
              atletas={atletas}
              isAdmin={!!isAdmin}
              onOpenPlayer={setAberto}
            />
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
              cedidas={cedidaPorAtleta}
              mediasMando={mediaMandoPorAtleta}
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
          <div className="flex gap-4 border-b-2 border-border">
            {(["atletas", "comparativo"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSubTab(t)}
                className={`-mb-0.5 border-b-4 px-1 pb-1.5 font-condensed text-xs uppercase ${subTab === t ? "border-primary" : "border-transparent text-muted-foreground"}`}
              >
                {t === "atletas" ? "Atletas" : "Comparativo"}
              </button>
            ))}
          </div>

          {isAdmin && <SubcategoriaAdmin atletas={atletas} />}

          {subTab === "comparativo" && (
            <PlayersCompare
              favoritos={favoritos}
              atletas={atletas}
              clubes={clubes}
              onOpenPlayer={setAberto}
              linhas={snap?.ok ? snap.jogadores : {}}
              cedidas={snap?.ok ? snap.cedidas : {}}
              adversario={snap?.ok ? snap.adversario : {}}
              mando={snap?.ok ? snap.mando : {}}
            />
          )}

          {subTab === "atletas" && (
            <PlayersTable
              atletas={atletas}
              clubes={clubes}
              favoritos={favoritos}
              onToggleFavorito={toggleFavorito}
              onOpenPlayer={setAberto}
              linhas={snap?.ok ? snap.jogadores : {}}
              cedidas={snap?.ok ? snap.cedidas : {}}
              adversario={snap?.ok ? snap.adversario : {}}
              mando={snap?.ok ? snap.mando : {}}
              carregando={!snap}
            />
          )}
        </section>
      )}

      {data?.ok && tab === "mapa" && (
        <CedimentosMap
          clubes={clubes}
          atletas={atletas}
          producao={snap?.ok ? snap.jogadores : {}}
          onOpenPlayer={setAberto}
        />
      )}

      {data?.ok && tab === "inicio" && (
        <HomeSection
          atletas={atletas}
          clubes={clubes}
          noticias={noticias}
          cedidas={snap?.ok ? snap.cedidas : {}}
          adversario={snap?.ok ? snap.adversario : {}}
          onOpenPlayer={setAberto}
          onOpenBest={() => setBest(true)}
          onOpenBestSG={() => setBestSG(true)}
        />
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
