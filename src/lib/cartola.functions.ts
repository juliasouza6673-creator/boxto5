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
  mediaMando: number;
  mando: "casa" | "fora";
  adversario: number;
  mediaCedida: number;
  recorrencia: number;
  desarmesCedidos: number;
  defesasCedidas: number;
  golsCedidos: number;
  minutos: number;
  tendencia: "subindo" | "estavel" | "caindo";
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
      const [histRaw, histContrario, ced, minut, formTime, formAdv, ultimasRodadas] = await Promise.all([
        m.playerMandoHistory(data.atletaId, info.mando, rodada, 5),
        m.playerMandoHistory(data.atletaId, contrario, rodada, 5),
        m.cedimentos(info.adversario, data.posicaoId, info.mando, rodada, 5),
        m.minutagem(data.atletaId, rodada, 5),
        m.teamForm(data.clubeId, info.mando, rodada, 5),
        m.teamForm(info.adversario, contrario, rodada, 5),
        m.playerLastRounds(data.atletaId, rodada, 10),
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
        ultimasRodadas,
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
        .slice(0, 16);
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

        const [hist, minut] = await Promise.all([
          posId === 6 ? Promise.resolve([]) : m.playerMandoHistory(a.atleta_id, info.mando, rodada, 5),
          posId === 6 ? Promise.resolve(null) : m.minutagem(a.atleta_id, rodada, 5),
        ]);
        const mediaMando = hist.length ? hist.reduce((s, g) => s + g.pontuacao, 0) / hist.length : media;
        const minutos = minut?.minutosEstimados ?? 90;
        // Tendência via média móvel de 3 vs anteriores
        const ord = [...hist].sort((x, y) => x.rodada - y.rodada).map((g) => g.pontuacao);
        const mm3 = ord.slice(-3);
        const antes = ord.slice(0, -3);
        const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
        const delta = mm3.length ? avg(mm3) - (antes.length ? avg(antes) : avg(mm3)) : 0;
        const tendencia = delta > 0.8 ? ("subindo" as const) : delta < -0.8 ? ("caindo" as const) : ("estavel" as const);

        const fatorMin = 0.6 + 0.4 * Math.min(1, minutos / 90);
        const bonusTend = tendencia === "subindo" ? 1.08 : tendencia === "caindo" ? 0.92 : 1;
        const bonusRec = 1 + (ced.recorrencia / 100) * 0.25;

        scored.push({
          atleta_id: a.atleta_id,
          apelido: a.apelido,
          foto: a.foto ?? null,
          clube_id: a.clube_id,
          posicao_id: posId,
          preco: a.preco_num,
          jogos,
          media,
          mediaMando,
          mando: info.mando,
          adversario: info.adversario,
          mediaCedida: ced.mediaCedida,
          recorrencia: ced.recorrencia,
          desarmesCedidos: ced.desarmesCedidos,
          defesasCedidas: ced.defesasCedidas,
          golsCedidos: ced.golsCedidos,
          minutos,
          tendencia,
          score: (mediaMando * 0.6 + media * 0.4 + ced.mediaCedida) * (0.6 + 0.4 * peso) * fatorMin * bonusTend * bonusRec,
        });
      }
      byPos[String(posId)] = scored.sort((x, y) => y.score - x.score).slice(0, 10);
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
    type Item = {
      clube_id: number;
      adversario: number;
      mando: "casa" | "fora";
      clube_casa_id: number;
      clube_visitante_id: number;
      defesa: Awaited<ReturnType<typeof m.teamForm>>;
      ataqueAdversario: Awaited<ReturnType<typeof m.teamForm>>;
      chance: number;
    };
    const out: Item[] = [];
    for (const p of partidas.partidas ?? []) {
      const opcoes: Item[] = [];
      for (const lado of ["casa", "fora"] as const) {
        const clube = lado === "casa" ? p.clube_casa_id : p.clube_visitante_id;
        const adv = lado === "casa" ? p.clube_visitante_id : p.clube_casa_id;
        const advMando = lado === "casa" ? ("fora" as const) : ("casa" as const);
        // amostra maior (até 8 jogos) sempre respeitando o mando
        const [defesa, ataqueAdversario] = await Promise.all([
          m.teamForm(clube, lado, rodada, 8),
          m.teamForm(adv, advMando, rodada, 8),
        ]);
        const nD = Math.max(1, defesa.jogos.length);
        const nA = Math.max(1, ataqueAdversario.jogos.length);
        const golsSofridosPorJogo = defesa.golsSofridos / nD;
        const golsFeitosAdvPorJogo = ataqueAdversario.golsFeitos / nA;
        // expectativa de gols do adversário nesse confronto
        let lambda = Math.sqrt(Math.max(0.15, golsSofridosPorJogo) * Math.max(0.15, golsFeitosAdvPorJogo));
        lambda *= lado === "casa" ? 0.9 : 1.12; // peso de mando
        const poisson = Math.exp(-lambda);
        const empirico = (defesa.sgMantidos / nD) * 0.5 + (ataqueAdversario.sgCedidos / nA) * 0.5;
        const confianca = Math.min(1, (defesa.jogos.length + ataqueAdversario.jogos.length) / 10);
        const chance = Math.round(
          Math.max(4, Math.min(88, (poisson * 0.6 + empirico * 0.4) * 100 * (0.75 + 0.25 * confianca))),
        );
        opcoes.push({
          clube_id: clube,
          adversario: adv,
          mando: lado,
          clube_casa_id: p.clube_casa_id,
          clube_visitante_id: p.clube_visitante_id,
          defesa,
          ataqueAdversario,
          chance,
        });
      }
      const melhor = opcoes.sort((a, b) => b.chance - a.chance)[0];
      if (melhor) out.push(melhor);
    }
    return { ok: true as const, rodada, ranking: out.sort((a, b) => b.chance - a.chance) };
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

/** Parciais ao vivo da rodada (mercado fechado). */
export const getParciais = createServerFn({ method: "GET" }).handler(async () => {
  const m = await import("./cartola-analysis.server");
  try {
    const p = await m.getParciais();
    const pontos: Record<string, number> = {};
    for (const [id, a] of Object.entries(p.atletas ?? {})) pontos[id] = a.pontuacao ?? 0;
    return { ok: true as const, rodada: p.rodada, pontos, atualizadoEm: Date.now() };
  } catch (err) {
    return { ok: false as const, error: (err as Error).message, pontos: {} as Record<string, number> };
  }
});
