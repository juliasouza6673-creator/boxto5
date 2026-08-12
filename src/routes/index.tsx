import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getBootstrap, getMarketStatus } from "@/lib/cartola.functions";
import type { Atleta, Clube, Partida } from "@/lib/cartola-types";
import { POS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, isEscalavel, playerPhoto } from "@/lib/cartola-ui";
import { useBoards, type SlotState } from "@/lib/board";
import { MatchTicker } from "@/components/MatchTicker";
import { Pitch } from "@/components/Pitch";
import { PlayerPicker } from "@/components/PlayerPicker";
import { PlayerModal } from "@/components/PlayerModal";
import { BestRoundModal } from "@/components/BestRoundModal";
import { AuthDialog } from "@/components/AuthDialog";
import { AdvancedTools, type FillScope } from "@/components/AdvancedTools";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tatics Pro — escalação e análise de cedimentos do Cartola FC" },
      {
        name: "description",
        content:
          "Monte escalações no campo tático, veja médias por mando, cedimentos do adversário e as melhores opções da rodada do Cartola FC.",
      },
      { property: "og:title", content: "Tatics Pro — escalação e scouts do Cartola FC" },
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

function Countdown({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, timestamp * 1000 - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <span className="font-display tracking-wide text-accent">
      {d} dias, {h} horas, {m} minutos e {s} segundos
    </span>
  );
}

function Index() {
  const bootstrapFn = useServerFn(getBootstrap);
  const statusFn = useServerFn(getMarketStatus);
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
  const [picker, setPicker] = useState<SlotState | null>(null);
  const [aberto, setAberto] = useState<Atleta | null>(null);
  const [best, setBest] = useState(false);
  const [auth, setAuth] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [match, setMatch] = useState<Partida | null>(null);
  const [avisoFechado, setAvisoFechado] = useState(false);

  useEffect(() => {
    if (!userId) {
      const t = setInterval(() => setAvisoFechado(false), 90_000);
      return () => clearInterval(t);
    }
    return;
  }, [userId]);

  const atletas: Atleta[] = data?.ok ? data.mercado.atletas : [];
  const clubes: Record<string, Clube> = data?.ok ? data.mercado.clubes : {};
  const partidas: Partida[] = data?.ok ? data.partidas.partidas : [];
  const esquemas = data?.ok ? data.esquemas : [];
  const atletasById = useMemo(() => new Map(atletas.map((a) => [a.atleta_id, a])), [atletas]);
  const board = boards.find((b) => b.id === activeId) ?? boards[0];

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

  const fechamento = live?.ok ? live.status.fechamento?.timestamp : data?.ok ? data.status.fechamento?.timestamp : 0;
  const atualizado = new Date(live?.ok ? live.atualizadoEm : (data?.ok ? data.atualizadoEm : Date.now()));

  return (
    <main className="mx-auto max-w-4xl px-3 pb-16 pt-3 sm:px-6">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="font-display text-2xl uppercase tracking-wide">
          Tatics<span className="text-accent">Pro</span>
        </h1>
        <button
          onClick={() => setBest(true)}
          className="rounded-lg border border-accent px-2 py-1 text-xs font-semibold text-accent"
        >
          Melhores opções para rodada
        </button>
        <span className="flex-1" />
        {userId ? (
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-lg border border-border px-3 py-1 text-xs text-muted-foreground"
          >
            Sair
          </button>
        ) : (
          <button
            onClick={() => setAuth(true)}
            className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground"
          >
            Entrar
          </button>
        )}
      </header>

      {!!fechamento && (
        <div className="mb-3 rounded-xl border border-border bg-panel px-3 py-2 text-xs text-muted-foreground">
          Mercado fecha em <Countdown timestamp={fechamento} /> ·{" "}
          <span>Atualizado às {atualizado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}

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

      {isLoading && <p className="py-10 text-center text-muted-foreground">Carregando mercado do Cartola…</p>}
      {data && !data.ok && (
        <p className="rounded-xl border border-destructive/50 bg-panel p-4 text-center text-sm text-destructive">
          {data.error}
        </p>
      )}

      {data?.ok && (
        <div className="space-y-3">
          <MatchTicker partidas={partidas} clubes={clubes} atletas={atletas} onSelectMatch={setMatch} />

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
              onChange={(patch) => update(board.id, patch)}
              onSlotClick={setPicker}
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
          posicaoId={picker.pos}
          atletas={atletas}
          clubes={clubes}
          usados={board.slots.map((s) => s.atletaId).filter(Boolean) as number[]}
          recomendados={recomendados}
          onPick={(a) => {
            update(board.id, (b) => ({
              ...b,
              slots: b.slots.map((s) => (s.id === picker.id ? { ...s, atletaId: a.atleta_id } : s)),
            }));
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}

      {advanced && (
        <AdvancedTools clubes={clubes} atletas={atletas} onFill={preencher} onClose={() => setAdvanced(false)} />
      )}

      {aberto && (
        <PlayerModal atleta={aberto} atletas={atletas} clubes={clubes} onClose={() => setAberto(null)} />
      )}

      {best && <BestRoundModal clubes={clubes} onClose={() => setBest(false)} />}
      {auth && <AuthDialog onClose={() => setAuth(false)} />}

      {match && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-background/85 p-0 sm:items-center sm:p-4"
          onClick={() => setMatch(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-panel sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-center gap-3 border-b border-border p-4">
              <img src={escudo(clubes[String(match.clube_casa_id)], "45x45")} alt="" className="h-8 w-8" />
              <span className="font-display">x</span>
              <img src={escudo(clubes[String(match.clube_visitante_id)], "45x45")} alt="" className="h-8 w-8" />
              <button onClick={() => setMatch(null)} className="ml-auto text-muted-foreground">
                ✕
              </button>
            </header>
            <div className="space-y-1.5 overflow-y-auto p-3">
              {atletas
                .filter(
                  (a) =>
                    (a.clube_id === match.clube_casa_id || a.clube_id === match.clube_visitante_id) &&
                    (a.status_id === 7 || a.status_id === 2),
                )
                .sort((a, b) => b.media_num - a.media_num)
                .map((a) => (
                  <button
                    key={a.atleta_id}
                    onClick={() => {
                      setAberto(a);
                      setMatch(null);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2 text-left"
                  >
                    {playerPhoto(a) ? (
                      <img src={playerPhoto(a)!} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <span className="h-8 w-8 rounded-full bg-secondary" />
                    )}
                    <img src={escudo(clubes[String(a.clube_id)], "30x30")} alt="" className="h-4 w-4" />
                    <span className="min-w-0 flex-1 truncate text-sm">{a.apelido}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {POS_NOME[a.posicao_id]} · média {fmt(a.media_num, 1)}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
