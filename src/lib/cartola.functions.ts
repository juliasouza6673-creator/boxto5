import { createServerFn } from "@tanstack/react-start";
import type { Esquema } from "./cartola-types";

export type BestPick = {
  atleta_id: number;
  apelido: string;
  clube_id: number;
  posicao_id: number;
  preco: number;
  jogos: number;
  media: number;
  mando: "casa" | "fora";
  adversario: number;
  mediaCedida: number;
  score: number;
};

export const getBootstrap = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("./cartola-analysis.server");
  const { cartolaGet } = await import("./cartola.server");
  try {
    const [status, mercado, esquemas] = await Promise.all([
      m.getStatus(),
      m.getMercado(),
      cartolaGet<Esquema[]>("/esquemas", 10 * 60_000).catch(() => [] as Esquema[]),
    ]);
    const rodada = status.rodada_atual ?? 1;
    const partidas = await m
      .getPartidas(rodada)
      .catch(() => ({ rodada, partidas: [] }));
    return {
      ok: true as const,
      status,
      mercado,
      esquemas,
      partidas,
      atualizadoEm: Date.now(),
    };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
});

export const getMarketStatus = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("./cartola-analysis.server");
  try {
    return { ok: true as const, status: await m.getStatus(), atualizadoEm: Date.now() };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
});

export const getMercadoAtletas = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("./cartola-analysis.server");
  try {
    return { ok: true as const, mercado: await m.getMercado(), atualizadoEm: Date.now() };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
});

export const getPlayerAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d: { atletaId: number; clubeId: number; posicaoId: number }) => d)
  .handler(async ({ data }) => {
    const m = await import("./cartola-analysis.server");
    try {
      const status = await m.getStatus();
      const rodada = status.rodada_atual ?? 1;
      const om = await m.opponentMap(rodada);
      const info = om[data.clubeId];
      if (!info) return { ok: true as const, semJogo: true, rodada };
      const [hist, ced] = await Promise.all([
        m.playerMandoHistory(data.atletaId, info.mando, rodada, 5),
        m.cedimentos(info.adversario, data.posicaoId, info.mando, rodada, 5),
      ]);
      const mediaMando = hist.length ? hist.reduce((s, g) => s + g.pontuacao, 0) / 5 : 0;
      return {
        ok: true as const,
        semJogo: false,
        rodada,
        mando: info.mando,
        adversario: info.adversario,
        historico: hist,
        mediaMando,
        cedimentos: ced,
        pontuacaoEsperada: mediaMando + ced.mediaCedida,
        confianca: Math.min(1, (hist.length + ced.amostra / 3) / 8),
        enfrentaPosicoes: m.enfrentaPosicoes(data.posicaoId),
      };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  });

export const getBestOfRound = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("./cartola-analysis.server");
  try {
    const status = await m.getStatus();
    const rodada = status.rodada_atual ?? 1;
    const [mercado, om] = await Promise.all([m.getMercado(), m.opponentMap(rodada)]);
    const cedCache = new Map<string, Awaited<ReturnType<typeof m.cedimentos>>>();
    const byPos: Record<string, BestPick[]> = {};

    const candidatos = mercado.atletas
      .filter((a) => [7, 2, 5].includes(a.status_id))
      .filter((a) => om[a.clube_id])
      .filter((a) => (a.jogos_num ?? 0) >= 2);

    for (const posId of [1, 2, 3, 4, 5]) {
      const pool = candidatos
        .filter((a) => a.posicao_id === posId)
        .sort((a, b) => (b.media_num ?? 0) - (a.media_num ?? 0))
        .slice(0, 12);
      const scored: BestPick[] = [];
      for (const a of pool) {
        const info = om[a.clube_id]!;
        const key = `${info.adversario}-${posId}-${info.mando}`;
        let ced = cedCache.get(key);
        if (!ced) {
          ced = await m.cedimentos(info.adversario, posId, info.mando, rodada, 5);
          cedCache.set(key, ced);
        }
        const jogos = a.jogos_num ?? 0;
        const peso = Math.min(1, jogos / 8);
        const media = a.media_num ?? 0;
        scored.push({
          atleta_id: a.atleta_id,
          apelido: a.apelido,
          clube_id: a.clube_id,
          posicao_id: posId,
          preco: a.preco_num,
          jogos,
          media,
          mando: info.mando,
          adversario: info.adversario,
          mediaCedida: ced.mediaCedida,
          score: (media + ced.mediaCedida) * (0.6 + 0.4 * peso),
        });
      }
      byPos[String(posId)] = scored.sort((x, y) => y.score - x.score).slice(0, 5);
    }
    return { ok: true as const, rodada, byPos };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
});
