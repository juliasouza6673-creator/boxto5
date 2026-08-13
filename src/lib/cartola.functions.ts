import { createServerFn } from "@tanstack/react-start";
import type { Esquema } from "./cartola-types";

export type BestPick = {
  atleta_id: number;
  apelido: string;
  foto?: string | null;
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
      const contrario = info.mando === "casa" ? ("fora" as const) : ("casa" as const);
      const [histRaw, histContrario, ced, minut, formTime, formAdv] = await Promise.all([
        m.playerMandoHistory(data.atletaId, info.mando, rodada, 5),
        m.playerMandoHistory(data.atletaId, contrario, rodada, 5),
        m.cedimentos(info.adversario, data.posicaoId, info.mando, rodada, 5),
        m.minutagem(data.atletaId, rodada, 5),
        m.teamForm(data.clubeId, info.mando, rodada, 5),
        m.teamForm(info.adversario, contrario, rodada, 5),
      ]);
      // Sem jogos no mando previsto: usa as últimas 5 em casa como referência
      const fallbackCasa =
        !histRaw.length && info.mando !== "casa"
          ? await m.playerMandoHistory(data.atletaId, "casa", rodada, 5)
          : [];
      const hist = histRaw.length ? histRaw : fallbackCasa;
      const mediaMando = hist.length ? hist.reduce((s, g) => s + g.pontuacao, 0) / 5 : 0;
      return {
        ok: true as const,
        semJogo: false,
        rodada,
        mando: info.mando,
        mandoContrario: contrario,
        adversario: info.adversario,
        historico: hist,
        historicoContrario: histContrario,
        usouFallbackCasa: !histRaw.length && fallbackCasa.length > 0,
        mediaMando,
        cedimentos: ced,
        minutagem: minut,
        formTime,
        formAdversario: formAdv,
        pontuacaoEsperada: mediaMando + ced.mediaCedida,
        confianca: Math.min(1, (hist.length + ced.amostra / 3) / 8),
        enfrentaPosicoes: m.enfrentaPosicoes(data.posicaoId),
      };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  });


export const getExpectedPoints = createServerFn({ method: "POST" })
  .inputValidator((d: { jogadores: Array<{ atletaId: number; clubeId: number; posicaoId: number }> }) => d)
  .handler(async ({ data }) => {
    const m = await import("./cartola-analysis.server");
    try {
      const status = await m.getStatus();
      const rodada = status.rodada_atual ?? 1;
      const om = await m.opponentMap(rodada);
      const cedCache = new Map<string, Awaited<ReturnType<typeof m.cedimentos>>>();
      const out: Record<string, number> = {};
      for (const j of data.jogadores.slice(0, 20)) {
        const info = om[j.clubeId];
        if (!info) continue;
        let hist = await m.playerMandoHistory(j.atletaId, info.mando, rodada, 5);
        if (!hist.length && info.mando !== "casa") hist = await m.playerMandoHistory(j.atletaId, "casa", rodada, 5);
        const key = `${info.adversario}-${j.posicaoId}-${info.mando}`;
        let ced = cedCache.get(key);
        if (!ced) {
          ced = await m.cedimentos(info.adversario, j.posicaoId, info.mando, rodada, 5);
          cedCache.set(key, ced);
        }
        const mediaMando = hist.length ? hist.reduce((s, g) => s + g.pontuacao, 0) / 5 : 0;
        out[String(j.atletaId)] = mediaMando + ced.mediaCedida;
      }
      return { ok: true as const, esperado: out };
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
      .filter((a) => a.status_id === 7 || a.status_id === 2)
      .filter((a) => om[a.clube_id])
      .filter((a) => (a.jogos_num ?? 0) >= 1);

    for (const posId of [1, 2, 3, 4, 5, 6]) {
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
          foto: a.foto ?? null,
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

/** Ranking de prováveis SGs da rodada: defesa que mais preserva x ataque que mais cede. */
export const getBestSG = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("./cartola-analysis.server");
  try {
    const status = await m.getStatus();
    const rodada = status.rodada_atual ?? 1;
    const partidas = await m.getPartidas(rodada);
    const out = [] as Array<{
      clube_id: number;
      adversario: number;
      mando: "casa" | "fora";
      defesa: Awaited<ReturnType<typeof m.teamForm>>;
      ataqueAdversario: Awaited<ReturnType<typeof m.teamForm>>;
      score: number;
    }>;
    for (const p of partidas.partidas ?? []) {
      for (const lado of ["casa", "fora"] as const) {
        const clube = lado === "casa" ? p.clube_casa_id : p.clube_visitante_id;
        const adv = lado === "casa" ? p.clube_visitante_id : p.clube_casa_id;
        const advMando = lado === "casa" ? ("fora" as const) : ("casa" as const);
        const [defesa, ataqueAdversario] = await Promise.all([
          m.teamForm(clube, lado, rodada, 5),
          m.teamForm(adv, advMando, rodada, 5),
        ]);
        const amostra = Math.max(1, defesa.jogos.length);
        const amostraAdv = Math.max(1, ataqueAdversario.jogos.length);
        const score =
          (defesa.sgMantidos / amostra) * 60 +
          (ataqueAdversario.sgCedidos / amostraAdv) * 30 +
          Math.max(0, 10 - (defesa.golsSofridos / amostra) * 5) +
          Math.max(0, 10 - (ataqueAdversario.golsFeitos / amostraAdv) * 5);
        out.push({ clube_id: clube, adversario: adv, mando: lado, defesa, ataqueAdversario, score });
      }
    }
    return { ok: true as const, rodada, ranking: out.sort((a, b) => b.score - a.score) };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message };
  }
});

/** Médias por mando dos jogadores e cedimento por posição do adversário, para um confronto. */
export const getMatchInsights = createServerFn({ method: "POST" })
  .inputValidator((d: { casa: number; fora: number }) => d)
  .handler(async ({ data }) => {
    const m = await import("./cartola-analysis.server");
    try {
      const status = await m.getStatus();
      const rodada = status.rodada_atual ?? 1;
      const mediaMando: Record<string, number> = {};
      const jogosMando: Record<string, number> = {};
      let rounds = 0;
      for (let r = rodada - 1; r >= 1 && rounds < 8; r--) {
        const [pts, mm] = await Promise.all([m.getPontuados(r).catch(() => null), m.mandoMap(r)]);
        if (!pts) continue;
        rounds++;
        for (const [id, a] of Object.entries(pts.atletas ?? {})) {
          if (a.clube_id !== data.casa && a.clube_id !== data.fora) continue;
          const alvo = a.clube_id === data.casa ? "casa" : "fora";
          if (mm[a.clube_id] !== alvo) continue;
          if ((jogosMando[id] ?? 0) >= 5) continue;
          mediaMando[id] = (mediaMando[id] ?? 0) + (a.pontuacao ?? 0);
          jogosMando[id] = (jogosMando[id] ?? 0) + 1;
        }
      }
      for (const id of Object.keys(mediaMando)) mediaMando[id] = mediaMando[id]! / (jogosMando[id] || 1);

      const cedida: Record<string, number> = {};
      for (const pos of [1, 2, 3, 4, 5, 6]) {
        const [cCasa, cFora] = await Promise.all([
          m.cedimentos(data.fora, pos, "casa", rodada, 5),
          m.cedimentos(data.casa, pos, "fora", rodada, 5),
        ]);
        cedida[`casa-${pos}`] = cCasa.mediaCedida;
        cedida[`fora-${pos}`] = cFora.mediaCedida;
      }
      return { ok: true as const, mediaMando, cedida };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message };
    }
  });
