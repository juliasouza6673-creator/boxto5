import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getBestOfRound, getBestSG } from "@/lib/cartola.functions";
import type { Atleta, Clube } from "@/lib/cartola-types";
import { POS_ABREV, POS_NOME, STATUS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, playerPhoto } from "@/lib/cartola-ui";
import { SUB_NOME, useSubcategorias, type Sub } from "@/lib/subcategorias";

type CedidaResumo = {
  mediaCedida: number;
  amostra: number;
  usouFallback: boolean;
  gols?: number;
  assistencias?: number;
  desarmes?: number;
  defesas?: number;
  sg?: number;
};

/** Contador que avança a cada `ms` milissegundos (para alternar listas). */
function useTick(ms: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((v) => v + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

/** Fatia rotativa de `n` itens. */
function janela<T>(arr: T[], n: number, tick: number): T[] {
  if (arr.length <= n) return arr;
  const pags = Math.ceil(arr.length / n);
  const i = tick % pags;
  return arr.slice(i * n, i * n + n);
}

type NewsItem = { titulo: string; link: string; data: string | null; fonte: string };

type Props = {
  atletas: Atleta[];
  clubes: Record<string, Clube>;
  noticias: NewsItem[];
  cedidas: Record<string, CedidaResumo>;
  adversario: Record<string, number>;
  onOpenPlayer: (a: Atleta) => void;
  onOpenBest: () => void;
  onOpenBestSG: () => void;
};

const SNAP_KEY = "boxto5.status.snapshot";

type Mudanca = { atleta_id: number; de: number; para: number; em: number };

const corStatus = (id: number) =>
  id === 7 ? "text-success" : id === 2 ? "text-warning" : id === 5 ? "text-muted-foreground" : "text-destructive";

/** Compara o status atual com o último visto e guarda as mudanças. */
function useMudancasDeStatus(atletas: Atleta[]) {
  const [mudancas, setMudancas] = useState<Mudanca[]>([]);
  useEffect(() => {
    if (!atletas.length) return;
    try {
      const raw = localStorage.getItem(SNAP_KEY);
      const prev = raw ? (JSON.parse(raw) as { statuses: Record<string, number>; mudancas: Mudanca[] }) : null;
      const atual: Record<string, number> = {};
      for (const a of atletas) atual[String(a.atleta_id)] = a.status_id;
      const agora = Date.now();
      const novas: Mudanca[] = [];
      if (prev?.statuses) {
        for (const a of atletas) {
          const antes = prev.statuses[String(a.atleta_id)];
          // Só interessa quem virou Provável ou quem era Provável e mudou de status.
          if (antes !== undefined && antes !== a.status_id && (antes === 7 || a.status_id === 7)) {
            novas.push({ atleta_id: a.atleta_id, de: antes, para: a.status_id, em: agora });
          }
        }
      }
      const historico = [...novas, ...(prev?.mudancas ?? [])]
        .filter((m) => agora - m.em < 48 * 3600_000)
        .filter((m, i, arr) => arr.findIndex((x) => x.atleta_id === m.atleta_id) === i)
        .slice(0, 24);
      localStorage.setItem(SNAP_KEY, JSON.stringify({ statuses: atual, mudancas: historico }));
      setMudancas(historico);
    } catch {
      /* ignore */
    }
  }, [atletas]);
  return mudancas;
}

export function HomeSection({
  atletas,
  clubes,
  noticias,
  cedidas,
  adversario,
  onOpenPlayer,
  onOpenBest,
  onOpenBestSG,
}: Props) {
  const { data: subs } = useSubcategorias();
  const bestFn = useServerFn(getBestOfRound);
  const sgFn = useServerFn(getBestSG);
  const mudancas = useMudancasDeStatus(atletas);
  const atletasById = useMemo(() => new Map(atletas.map((a) => [a.atleta_id, a])), [atletas]);

  const { data: best } = useQuery({
    queryKey: ["best-of-round", subs ? Object.keys(subs).length : 0],
    queryFn: () => bestFn({ data: { subs: subs ?? {} } }),
    staleTime: 15 * 60_000,
  });
  const { data: sg } = useQuery({ queryKey: ["best-sg"], queryFn: () => sgFn(), staleTime: 15 * 60_000 });

  const tick = useTick(7000);
  // Alterna entre os 3 melhores de cada posição.
  const topPicks = useMemo(() => {
    if (!best?.ok) return [];
    return [1, 2, 3, 4, 5]
      .map((p) => {
        const top3 = best.byPos[String(p)]?.slice(0, 3) ?? [];
        return top3.length ? top3[tick % top3.length] : undefined;
      })
      .filter((r): r is NonNullable<typeof r> => !!r);
  }, [best, tick]);
  const mudancasVisiveis = janela(mudancas, 5, tick);

  const topSG = sg?.ok ? sg.ranking.slice(0, 3) : [];

  /** Time que mais cede e subcategoria mais generosa da rodada. */
  const cedimentoDestaques = useMemo(() => {
    const porClube = new Map<number, number[]>();
    const porSub = new Map<string, number[]>();
    for (const [chave, v] of Object.entries(cedidas)) {
      const [clube, sub] = chave.split("-");
      if (!clube || !sub || !v.amostra) continue;
      (porClube.get(Number(clube)) ?? porClube.set(Number(clube), []).get(Number(clube))!).push(v.mediaCedida);
      (porSub.get(sub) ?? porSub.set(sub, []).get(sub)!).push(v.mediaCedida);
    }
    const media = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
    const clubes5 = [...porClube.entries()]
      .map(([id, arr]) => ({ id, media: media(arr) }))
      .sort((a, b) => b.media - a.media);
    const subs5 = [...porSub.entries()]
      .map(([sub, arr]) => ({ sub, media: media(arr) }))
      .sort((a, b) => b.media - a.media);
    return { clubes: clubes5.slice(0, 3), subs: subs5.slice(0, 3) };
  }, [cedidas]);

  /** Quadro "Quem Mais Cede" segmentado por posição. */
  const GRUPOS_QUADRO: Array<{ sigla: string; subs: string[] }> = [
    { sigla: "GOL", subs: ["GOL"] },
    { sigla: "LD", subs: ["LD"] },
    { sigla: "LE", subs: ["LE"] },
    { sigla: "ZAG", subs: ["ZAD", "ZAE"] },
    { sigla: "MEI", subs: ["VOL", "MCO", "MD", "ME"] },
    { sigla: "ATA", subs: ["PD", "PE", "CA"] },
  ];

  const cedePorPosicao = useMemo(() => {
    const media = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);
    return GRUPOS_QUADRO.map(({ sigla, subs: grupo }) => {
      type Acc = { medias: number[]; gols: number; assistencias: number; desarmes: number; defesas: number; sg: number };
      const porClube = new Map<number, Acc>();
      for (const [chave, v] of Object.entries(cedidas)) {
        const [clube, sub] = chave.split("-");
        if (!clube || !sub || !grupo.includes(sub) || !v.amostra) continue;
        const acc = porClube.get(Number(clube)) ?? { medias: [], gols: 0, assistencias: 0, desarmes: 0, defesas: 0, sg: 0 };
        acc.medias.push(v.mediaCedida);
        acc.gols += v.gols ?? 0;
        acc.assistencias += v.assistencias ?? 0;
        acc.desarmes += v.desarmes ?? 0;
        acc.defesas += v.defesas ?? 0;
        acc.sg = Math.max(acc.sg, v.sg ?? 0);
        porClube.set(Number(clube), acc);
      }
      const tipo = sigla === "GOL" ? "gol" : sigla === "MEI" || sigla === "ATA" ? "ataque" : "defesa";
      // Critério de desempate por setor: defesas (GOL), desarmes+SG (defesa), gols+assistências (ataque).
      const chave = (c: Acc) =>
        tipo === "gol" ? c.defesas + c.sg * 5 : tipo === "defesa" ? c.desarmes + c.sg * 5 : (c.gols + c.assistencias) * 5;
      return {
        sigla,
        tipo,
        top: [...porClube.entries()]
          .map(([id, c]) => ({ id, media: media(c.medias), ...c, rank: chave(c) * 0.5 + media(c.medias) }))
          .sort((a, b) => b.rank - a.rank)
          .slice(0, 3),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cedidas]);

  type Dica = { tipo: string; conteudo: React.ReactNode };
  const dicas = useMemo(() => {
    const out: Dica[] = [];
    if (topSG[0]) {
      const s = topSG[0];
      out.push({
        tipo: "Melhor SG",
        conteudo: (
          <span>
            <b>{clubes[String(s.clube_id)]?.nome}</b> tem {s.chance}% de chance de manter o SG contra{" "}
            {clubes[String(s.adversario)]?.nome} ({s.mando === "casa" ? "em casa" : "fora"}).
          </span>
        ),
      });
    }
    const p0 = topPicks[0];
    if (p0) {
      out.push({
        tipo: "Cedimento alto",
        conteudo: (
          <span>
            <b>{p0.apelido}</b> ({POS_ABREV[p0.posicao_id]}) enfrenta um adversário que cede{" "}
            {fmt(p0.mediaCedida, 1)} pontos e ele vem de média {fmt(p0.mediaMando, 1)} no mando.
          </span>
        ),
      });
    }
    const clubeTop = cedimentoDestaques.clubes[0];
    if (clubeTop) {
      out.push({
        tipo: "Time que mais cede",
        conteudo: (
          <span>
            <b>{clubes[String(clubeTop.id)]?.nome}</b> é quem mais cede pontos nesta rodada (média{" "}
            {fmt(clubeTop.media, 1)} por subcategoria).
          </span>
        ),
      });
    }
    const subTop = cedimentoDestaques.subs[0];
    if (subTop) {
      out.push({
        tipo: "Subcategoria da rodada",
        conteudo: (
          <span>
            Vale conferir <b>{subTop.sub === "GOL" ? "Goleiros" : SUB_NOME[subTop.sub as Sub]}</b>: é a posição mais
            explorada da rodada (cedimento médio {fmt(subTop.media, 1)}).
          </span>
        ),
      });
    }
    for (const p of topPicks.slice(1, 4)) {
      out.push({
        tipo: `Destaque ${POS_NOME[p.posicao_id]}`,
        conteudo: (
          <span>
            <b>{p.apelido}</b> — recorrência de {fmt(p.recorrencia, 0)}% acima de 5 pontos contra este adversário.
          </span>
        ),
      });
    }
    return out;
  }, [topSG, topPicks, cedimentoDestaques, clubes]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      {/* Lateral esquerda — Atualização de Mercado */}
      <aside className="space-y-3">
        <section className="brutal p-3">
          <h2 className="font-display text-lg">Atualização de Mercado</h2>
          <p className="text-[11px] text-muted-foreground">
            Quem virou Provável ou saiu de Provável desde a sua última visita.
          </p>
          <div key={`mv-${tick % Math.max(1, Math.ceil(mudancas.length / 5))}`} className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-right-4 duration-500">
            {mudancasVisiveis.map((m) => {
              const a = atletasById.get(m.atleta_id);
              if (!a) return null;
              return (
                <button
                  key={m.atleta_id}
                  onClick={() => onOpenPlayer(a)}
                  className="flex w-full items-center gap-2 brutal-sm bg-panel-2 px-2 py-1.5 text-left"
                >
                  {playerPhoto(a) ? (
                    <img src={playerPhoto(a)!} alt="" className="h-7 w-7 rounded-full object-cover" />
                  ) : (
                    <span className="h-7 w-7 rounded-full bg-secondary" />
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-bold">
                      {POS_ABREV[a.posicao_id]} {a.apelido}
                    </span>
                    <span className="block text-[10px]">
                      <span className="text-muted-foreground">{clubes[String(a.clube_id)]?.abreviacao} · </span>
                      <span className={corStatus(m.de)}>{STATUS_NOME[m.de] ?? "-"}</span>
                      <span className="text-muted-foreground"> → </span>
                      <span className={`font-bold ${corStatus(m.para)}`}>{STATUS_NOME[m.para] ?? "-"}</span>
                    </span>
                  </span>
                </button>
              );
            })}
            {!mudancas.length && (
              <p className="text-[11px] text-muted-foreground">
                Nenhuma mudança de status registrada ainda. Assim que a API ou o admin alterar um jogador, ela aparece
                aqui.
              </p>
            )}
          </div>
        </section>
      </aside>

      <div className="space-y-4">
        <section className="brutal p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 font-display text-xl">Principais Jogadores</h2>
            <button
              onClick={onOpenBest}
              className="brutal-sm bg-primary px-2 py-1 font-condensed text-[11px] uppercase text-primary-foreground"
            >
              Melhores Opções →
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {topPicks.map((p) => {
              const a = atletasById.get(p.atleta_id);
              return (
                <button
                  key={`${p.posicao_id}-${p.atleta_id}`}
                  onClick={() => a && onOpenPlayer(a)}
                  className="flex items-center gap-2 brutal-sm bg-panel-2 px-2 py-2 text-left"
                >
                  <img src={escudo(clubes[String(p.clube_id)], "45x45")} alt="" className="h-7 w-7 object-contain" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-bold">
                      {POS_ABREV[p.posicao_id]} {p.apelido}
                      <span className="ml-1 font-normal text-muted-foreground">
                        {subs?.[String(p.atleta_id)] ? `· ${subs[String(p.atleta_id)]}` : ""}
                      </span>
                    </span>
                    <span className="block text-[10px]">
                      esperado {fmt(p.esperado, 1)} · mando {fmt(p.mediaMando, 1)} · cede {fmt(p.mediaCedida, 1)} · recorrência{" "}
                      {fmt(p.recorrencia, 0)}%
                    </span>
                  </span>
                </button>
              );
            })}
            {!topPicks.length && (
              <p className="text-[11px] text-muted-foreground">Calculando as melhores opções da rodada…</p>
            )}
          </div>
        </section>

        <section className="brutal p-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 font-display text-xl">Principais SGs</h2>
            <button
              onClick={onOpenBestSG}
              className="brutal-sm bg-accent px-2 py-1 font-condensed text-[11px] uppercase text-accent-foreground"
            >
              Ver todos →
            </button>
          </div>
          <div className="mt-3 space-y-1.5">
            {topSG.map((s) => (
              <button
                key={`${s.clube_id}`}
                onClick={onOpenBestSG}
                className="flex w-full items-center gap-2 brutal-sm bg-panel px-2 py-1.5"
              >
                <img src={escudo(clubes[String(s.clube_casa_id)], "30x30")} alt="" className="h-6 w-6 object-contain" />
                <span className="font-condensed text-[11px] uppercase">x</span>
                <img
                  src={escudo(clubes[String(s.clube_visitante_id)], "30x30")}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
                <span className="flex-1 text-left text-[11px]">
                  SG de <b>{clubes[String(s.clube_id)]?.abreviacao}</b>
                </span>
                <span className="font-display text-sm text-primary">{s.chance}%</span>
              </button>
            ))}
            {!topSG.length && <p className="text-[11px] text-muted-foreground">Calculando os melhores SGs…</p>}
          </div>
        </section>

        <section className="brutal p-3">
          <h2 className="font-display text-xl">Quem Mais Cede</h2>
          <p className="text-[11px] text-muted-foreground">
            Top 3 times que mais cedem por posição nas últimas 5 rodadas, no mando. Goleiros: defesas e SG. Laterais e
            zagueiros: desarmes e SG. Meias e atacantes: gols e assistências.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cedePorPosicao.map((g) => (
              <div key={g.sigla} className="brutal-sm bg-panel px-2 py-1.5">
                <p className="font-condensed text-[11px] uppercase tracking-widest text-primary">{g.sigla}</p>
                <ul className="mt-1 space-y-1">
                  {g.top.map((c) => (
                    <li key={c.id} className="text-[11px]">
                      <span className="flex items-center gap-1.5">
                        <img src={escudo(clubes[String(c.id)], "30x30")} alt="" className="h-4 w-4 object-contain" />
                        <span className="flex-1 truncate font-bold">{clubes[String(c.id)]?.abreviacao}</span>
                        <b>{fmt(c.media, 1)} pts</b>
                      </span>
                      <span className="block pl-5 text-[10px] text-muted-foreground">
                        {g.tipo === "gol"
                          ? `${c.defesas} defesas · ${c.sg} SG cedidos`
                          : g.tipo === "defesa"
                            ? `${c.desarmes} desarmes · ${c.sg} SG cedidos`
                            : `${c.gols} gols · ${c.assistencias} assist.`}
                      </span>
                    </li>
                  ))}
                  {!g.top.length && <li className="text-[10px] text-muted-foreground">Sem dados</li>}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Top Dicas</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {janela(dicas, 4, tick).map((d, i) => (
              <article key={`d-${i}`} className="brutal bg-accent p-3 text-accent-foreground">
                <p className="font-condensed text-[10px] uppercase tracking-widest">{d.tipo}</p>
                <p className="mt-1 text-[12px] leading-snug">{d.conteudo}</p>
              </article>
            ))}
            {!dicas.length && (
              <p className="brutal p-4 text-center text-sm text-muted-foreground">Reunindo dicas da rodada…</p>
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-xl">Notícias do Brasileirão</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {noticias.map((n, i) => (
              <a key={`n-${i}`} href={n.link} target="_blank" rel="noreferrer" className="brutal p-3 hover:bg-panel-2">
                <p className="font-condensed text-[10px] uppercase tracking-widest text-muted-foreground">
                  {n.fonte}
                  {n.data ? ` · ${n.data}` : ""}
                </p>
                <p className="mt-1 font-condensed text-sm uppercase leading-snug">{n.titulo}</p>
              </a>
            ))}
            {!noticias.length && (
              <p className="brutal p-4 text-center text-sm text-muted-foreground">Buscando notícias…</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
