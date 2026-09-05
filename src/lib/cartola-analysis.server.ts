import { cartolaGet } from "./cartola.server";

export type Scout = Record<string, number>;

export type Pontuado = {
  atleta_id?: number;
  apelido: string;
  clube_id: number;
  posicao_id: number;
  pontuacao: number;
  scout?: Scout | null;
};

export type PontuadosResp = { rodada: number; atletas: Record<string, Pontuado> };
export type Partida = {
  clube_casa_id: number;
  clube_visitante_id: number;
  partida_data?: string;
  placar_oficial_mandante?: number | null;
  placar_oficial_visitante?: number | null;
};
export type PartidasResp = { rodada: number; partidas: Partida[] };

export const POSITIVE_SCOUTS = ["G", "A", "SG", "DS", "FS", "FF", "FD", "FT", "DE", "DP", "PS"];
export const NEGATIVE_SCOUTS = ["GS", "PP", "CA", "CV", "GC", "I", "PC", "FC"];

// Média Básica Cedida weights
const BASIC_LINE: Scout = { FT: 3.0, FD: 1.2, FF: 0.8, FS: 0.5, DS: 1.2 };
const BASIC_GK: Scout = { DE: 1.0, DP: 7.0 };

export async function getStatus() {
  return cartolaGet<import("./cartola-types").MercadoStatus>("/mercado/status", 60_000);
}

export async function getPartidas(rodada: number) {
  return cartolaGet<PartidasResp>(`/partidas/${rodada}`, 5 * 60_000);
}

export async function getPontuados(rodada: number) {
  return cartolaGet<PontuadosResp>(`/atletas/pontuados/${rodada}`, 10 * 60_000);
}

export async function getMercado() {
  return cartolaGet<import("./cartola-types").MercadoPayload>("/atletas/mercado", 3 * 60_000);
}

/** Map clubId -> "casa" | "fora" for a given round */
export async function mandoMap(rodada: number): Promise<Record<number, "casa" | "fora">> {
  const out: Record<number, "casa" | "fora"> = {};
  try {
    const p = await getPartidas(rodada);
    for (const m of p.partidas ?? []) {
      out[m.clube_casa_id] = "casa";
      out[m.clube_visitante_id] = "fora";
    }
  } catch {
    /* ignore missing round */
  }
  return out;
}

export async function opponentMap(rodada: number): Promise<Record<number, { adversario: number; mando: "casa" | "fora" }>> {
  const out: Record<number, { adversario: number; mando: "casa" | "fora" }> = {};
  try {
    const p = await getPartidas(rodada);
    for (const m of p.partidas ?? []) {
      out[m.clube_casa_id] = { adversario: m.clube_visitante_id, mando: "casa" };
      out[m.clube_visitante_id] = { adversario: m.clube_casa_id, mando: "fora" };
    }
  } catch {
    /* ignore */
  }
  return out;
}

export type HistoryGame = {
  rodada: number;
  pontuacao: number;
  scout: Scout;
  apelido?: string;
  clube_id?: number;
};

/** Last N games of a player in a specific mando */
export async function playerMandoHistory(
  atletaId: number,
  mando: "casa" | "fora",
  rodadaAtual: number,
  n = 5,
): Promise<HistoryGame[]> {
  const games: HistoryGame[] = [];
  for (let r = rodadaAtual - 1; r >= 1 && games.length < n; r--) {
    const [pts, mm] = await Promise.all([getPontuados(r).catch(() => null), mandoMap(r)]);
    const a = pts?.atletas?.[String(atletaId)];
    if (!a) continue;
    if (mm[a.clube_id] !== mando) continue;
    games.push({ rodada: r, pontuacao: a.pontuacao ?? 0, scout: a.scout ?? {} });
  }
  return games;
}

export type Cedimentos = {
  jogos: HistoryGame[];
  top5: HistoryGame[];
  recorrencia: number;
  mediaCedida: number;
  mediaBasicaCedida: number;
  assistenciasCedidas: number;
  golsCedidos: number;
  desarmesCedidos: number;
  defesasCedidas: number;
  amostra: number;
};


/** What the opponent conceded to players of the same position, in the equivalent mando */
export async function cedimentos(
  adversarioId: number,
  posicaoId: number,
  mandoDoJogador: "casa" | "fora",
  rodadaAtual: number,
  n = 5,
): Promise<Cedimentos> {
  const mandoAdversario = mandoDoJogador === "casa" ? "fora" : "casa";
  const jogos: HistoryGame[] = [];
  let rounds = 0;
  for (let r = rodadaAtual - 1; r >= 1 && rounds < n; r--) {
    const om = await opponentMap(r);
    const info = om[adversarioId];
    if (!info || info.mando !== mandoAdversario) continue;
    const pts = await getPontuados(r).catch(() => null);
    if (!pts) continue;
    rounds++;
    for (const a of Object.values(pts.atletas ?? {})) {
      if (a.clube_id !== info.adversario) continue;
      if (a.posicao_id !== posicaoId) continue;
      jogos.push({
        rodada: r,
        pontuacao: a.pontuacao ?? 0,
        scout: a.scout ?? {},
        apelido: a.apelido,
        clube_id: a.clube_id,
      });
    }
  }
  const weights = posicaoId === 1 ? BASIC_GK : BASIC_LINE;
  const count = jogos.length || 1;
  // Média cedida = média dos 5 maiores pontuadores da posição contra esse adversário no mando
  const top5 = [...jogos].sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 5);
  const somaTop = top5.reduce((s, g) => s + g.pontuacao, 0);
  const basica = jogos.reduce((s, g) => {
    let v = 0;
    for (const [k, w] of Object.entries(weights)) v += (g.scout[k] ?? 0) * w;
    return s + v;
  }, 0);
  const acima5 = jogos.filter((g) => g.pontuacao > 5).length;
  return {
    jogos: jogos.sort((a, b) => b.rodada - a.rodada),
    top5,
    recorrencia: jogos.length ? (acima5 / jogos.length) * 100 : 0,
    mediaCedida: somaTop / 5,
    mediaBasicaCedida: basica / count,
    assistenciasCedidas: jogos.reduce((s, g) => s + (g.scout['A'] ?? 0), 0),
    golsCedidos: jogos.reduce((s, g) => s + (g.scout['G'] ?? 0), 0),
    desarmesCedidos: jogos.reduce((s, g) => s + (g.scout['DS'] ?? 0), 0),
    defesasCedidas: jogos.reduce((s, g) => s + (g.scout['DE'] ?? 0), 0),
    amostra: jogos.length,
  };
}

/** Position matchup rules */
export function enfrentaPosicoes(posicaoId: number): number[] {
  switch (posicaoId) {
    case 5: // atacante -> zagueiros
      return [3];
    case 2: // lateral -> laterais
      return [2];
    case 4: // meia -> meias
      return [4];
    case 3: // zagueiro -> atacantes
      return [5];
    case 1: // goleiro -> atacantes
      return [5];
    default:
      return [];
  }
}

/* ---------------- Resultados por mando / SG ---------------- */

export type TeamGame = {
  rodada: number;
  adversario: number;
  golsPro: number;
  golsContra: number;
  resultado: "V" | "E" | "D";
};

export type TeamForm = {
  clube_id: number;
  mando: "casa" | "fora";
  jogos: TeamGame[];
  vitorias: number;
  empates: number;
  derrotas: number;
  golsSofridos: number;
  golsFeitos: number;
  /** jogos em que NÃO sofreu gol (preservou SG) */
  sgMantidos: number;
  /** jogos em que NÃO fez gol (cedeu SG ao adversário) */
  sgCedidos: number;
};

/** Últimos N jogos de um clube no mando indicado, com placar oficial. */
export async function teamForm(
  clubeId: number,
  mando: "casa" | "fora",
  rodadaAtual: number,
  n = 5,
): Promise<TeamForm> {
  const jogos: TeamGame[] = [];
  for (let r = rodadaAtual - 1; r >= 1 && jogos.length < n; r--) {
    let resp: PartidasResp | null = null;
    try {
      resp = await getPartidas(r);
    } catch {
      continue;
    }
    for (const m of resp?.partidas ?? []) {
      const emCasa = m.clube_casa_id === clubeId;
      const emFora = m.clube_visitante_id === clubeId;
      if (!emCasa && !emFora) continue;
      if ((emCasa ? "casa" : "fora") !== mando) continue;
      const gm = m.placar_oficial_mandante;
      const gv = m.placar_oficial_visitante;
      if (gm === null || gm === undefined || gv === null || gv === undefined) continue;
      const golsPro = emCasa ? gm : gv;
      const golsContra = emCasa ? gv : gm;
      jogos.push({
        rodada: r,
        adversario: emCasa ? m.clube_visitante_id : m.clube_casa_id,
        golsPro,
        golsContra,
        resultado: golsPro > golsContra ? "V" : golsPro === golsContra ? "E" : "D",
      });
    }
  }
  return {
    clube_id: clubeId,
    mando,
    jogos,
    vitorias: jogos.filter((g) => g.resultado === "V").length,
    empates: jogos.filter((g) => g.resultado === "E").length,
    derrotas: jogos.filter((g) => g.resultado === "D").length,
    golsSofridos: jogos.reduce((s, g) => s + g.golsContra, 0),
    golsFeitos: jogos.reduce((s, g) => s + g.golsPro, 0),
    sgMantidos: jogos.filter((g) => g.golsContra === 0).length,
    sgCedidos: jogos.filter((g) => g.golsPro === 0).length,
  };
}

/** Minutagem estimada: presença do atleta nas últimas N rodadas do clube. */
export async function minutagem(atletaId: number, rodadaAtual: number, n = 5) {
  let jogosDisputados = 0;
  let rodadas = 0;
  const detalhe: Array<{ rodada: number; jogou: boolean; pontuacao: number }> = [];
  for (let r = rodadaAtual - 1; r >= 1 && rodadas < n; r--) {
    const pts = await getPontuados(r).catch(() => null);
    if (!pts) continue;
    rodadas++;
    const a = pts.atletas?.[String(atletaId)];
    if (a) jogosDisputados++;
    detalhe.push({ rodada: r, jogou: !!a, pontuacao: a?.pontuacao ?? 0 });
  }
  const base = rodadas || 1;
  const ultimo = detalhe.find((d) => d.jogou) ?? null;
  return {
    rodadas,
    jogosDisputados,
    minutosEstimados: Math.round((jogosDisputados / base) * 90),
    /** A API do Cartola não expõe minutos jogados — o valor é uma estimativa. */
    preciso: false,
    ultimoJogo: ultimo ? { rodada: ultimo.rodada, minutos: null as number | null } : null,
    detalhe,
  };
}

/** Pontuações das últimas N rodadas (null quando o atleta não pontuou/não jogou). */
export async function playerLastRounds(
  atletaId: number,
  rodadaAtual: number,
  n = 10,
): Promise<Array<{ rodada: number; pontuacao: number | null }>> {
  const out: Array<{ rodada: number; pontuacao: number | null }> = [];
  for (let r = rodadaAtual - 1; r >= 1 && out.length < n; r--) {
    const pts = await getPontuados(r).catch(() => null);
    if (!pts) continue;
    const a = pts.atletas?.[String(atletaId)];
    out.push({ rodada: r, pontuacao: a ? (a.pontuacao ?? 0) : null });
  }
  return out.reverse();
}

/** Parciais ao vivo (só retorna dados com o mercado fechado / rodada em andamento). */
export async function getParciais() {
  return cartolaGet<PontuadosResp>("/atletas/pontuados", 45_000);
}

/* ---------------- Cedimentos por subcategoria ---------------- */

export type SubKey = string;

export type CedimentoSub = {
  sub: SubKey;
  amostra: number;
  usouFallback: boolean;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  sgCedidos: number;
  mediaCedida: number;
  /** Média cedida considerando a posição geral (para comparação com a subcategoria). */
  mediaCedidaGeral: number;
  jogos: Array<{ rodada: number; atleta_id: number | undefined; apelido: string; clube_id: number; pontuacao: number; scout: Scout }>;
};


const AMOSTRA_MINIMA = 3;

/**
 * Cedimento do adversário por subcategoria, respeitando o mando.
 * `subs` mapeia atleta_id -> sigla da subcategoria (vinda do banco).
 */
export async function cedimentoPorSubcategoria(
  adversarioId: number,
  mandoDoAdversario: "casa" | "fora",
  rodadaAtual: number,
  subs: Record<string, string>,
  n = 5,
): Promise<Record<SubKey, CedimentoSub>> {
  type Reg = { rodada: number; atleta_id?: number; apelido: string; clube_id: number; posicao_id: number; pontuacao: number; scout: Scout };
  const registros: Reg[] = [];
  let rounds = 0;
  for (let r = rodadaAtual - 1; r >= 1 && rounds < n; r--) {
    const om = await opponentMap(r);
    const info = om[adversarioId];
    if (!info || info.mando !== mandoDoAdversario) continue;
    const pts = await getPontuados(r).catch(() => null);
    if (!pts) continue;
    rounds++;
    for (const [id, a] of Object.entries(pts.atletas ?? {})) {
      if (a.clube_id !== info.adversario) continue;
      registros.push({
        rodada: r,
        atleta_id: Number(id),
        apelido: a.apelido,
        clube_id: a.clube_id,
        posicao_id: a.posicao_id,
        pontuacao: a.pontuacao ?? 0,
        scout: a.scout ?? {},
      });
    }
  }

  const gruposPosicao: Record<number, string[]> = {
    2: ["LD", "LE"],
    3: ["ZAD", "ZAE"],
    4: ["VOL", "MCO", "MD", "ME"],
    5: ["PD", "PE", "CA"],
  };
  const posicaoDaSub: Record<string, number> = {
    LD: 2, LE: 2, ZAD: 3, ZAE: 3, VOL: 4, MCO: 4, MD: 4, ME: 4, PD: 5, PE: 5, CA: 5,
  };

  const todasSubs = [...Object.keys(posicaoDaSub), "GOL"];
  const out: Record<SubKey, CedimentoSub> = {};

  const mediaTop5 = (arr: Reg[]) =>
    [...arr].sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 5).reduce((s, g) => s + g.pontuacao, 0) / 5;

  for (const sub of todasSubs) {
    const posGeral = sub === "GOL" ? 1 : posicaoDaSub[sub]!;
    const grupo = gruposPosicao[posGeral] ?? [];
    const geral = registros.filter(
      (x) => x.posicao_id === posGeral || grupo.includes(subs[String(x.atleta_id)] ?? ""),
    );
    const porSub = registros.filter(
      (x) => (sub === "GOL" ? x.posicao_id === 1 : subs[String(x.atleta_id)] === sub),
    );
    // Sempre respeita a subcategoria; só cai para a posição geral sem amostra suficiente.
    const usouFallback = sub !== "GOL" && porSub.length < AMOSTRA_MINIMA;
    const amostra = usouFallback ? geral : porSub;
    out[sub] = {
      sub,
      amostra: amostra.length,
      usouFallback,
      gols: amostra.reduce((s, g) => s + (g.scout['G'] ?? 0), 0),
      assistencias: amostra.reduce((s, g) => s + (g.scout['A'] ?? 0), 0),
      desarmes: amostra.reduce((s, g) => s + (g.scout['DS'] ?? 0), 0),
      defesas: amostra.reduce((s, g) => s + (g.scout['DE'] ?? 0), 0),
      sgCedidos: amostra.filter((g) => (g.scout['SG'] ?? 0) > 0).length,
      mediaCedida: mediaTop5(amostra),
      mediaCedidaGeral: mediaTop5(geral),
      jogos: amostra
        .sort((a, b) => b.rodada - a.rodada || b.pontuacao - a.pontuacao)
        .slice(0, 20)
        .map(({ rodada, atleta_id, apelido, clube_id, pontuacao, scout }) => ({
          rodada,
          atleta_id,
          apelido,
          clube_id,
          pontuacao,
          scout,
        })),
    };
  }
  return out;
}

/* ---------------- Snapshot da liga (tabela de jogadores) ---------------- */

export type JogadorSnapshot = {
  jogos: number;
  mediaMando: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  ultimas: Array<{ rodada: number; pontuacao: number; scout: Scout }>;
};

export type LigaSnapshot = {
  rodada: number;
  mando: Record<string, "casa" | "fora">;
  adversario: Record<string, number>;
  jogadores: Record<string, JogadorSnapshot>;
  /** chave `${clubeAdversario}-${sub}` -> média cedida na janela de 5 jogos do mando */
  cedidas: Record<string, { mediaCedida: number; amostra: number; usouFallback: boolean }>;
};

/**
 * Uma passada única pelas últimas rodadas para produzir:
 * média/scouts dos jogadores no mando da próxima rodada e cedimento por subcategoria.
 */
export async function ligaSnapshot(
  rodadaAtual: number,
  subs: Record<string, string>,
  janela = 5,
  maxRodadas = 16,
): Promise<LigaSnapshot> {
  type Row = {
    rodada: number;
    atleta_id: number;
    clube_id: number;
    posicao_id: number;
    pontuacao: number;
    scout: Scout;
    mando: "casa" | "fora";
    adversario: number;
  };
  const rows: Row[] = [];
  const rodadasLidas: number[] = [];
  for (let r = rodadaAtual - 1; r >= 1 && rodadasLidas.length < maxRodadas; r--) {
    const [pts, om] = await Promise.all([getPontuados(r).catch(() => null), opponentMap(r)]);
    if (!pts || !Object.keys(om).length) continue;
    rodadasLidas.push(r);
    for (const [id, a] of Object.entries(pts.atletas ?? {})) {
      const info = om[a.clube_id];
      if (!info) continue;
      rows.push({
        rodada: r,
        atleta_id: Number(id),
        clube_id: a.clube_id,
        posicao_id: a.posicao_id,
        pontuacao: a.pontuacao ?? 0,
        scout: a.scout ?? {},
        mando: info.mando,
        adversario: info.adversario,
      });
    }
  }

  const om = await opponentMap(rodadaAtual);
  const mando: Record<string, "casa" | "fora"> = {};
  const adversario: Record<string, number> = {};
  for (const [clube, info] of Object.entries(om)) {
    mando[clube] = info.mando;
    adversario[clube] = info.adversario;
  }

  // Jogadores: últimas `janela` partidas no mando da próxima rodada
  const porAtleta = new Map<number, Row[]>();
  for (const row of rows) {
    const m = mando[String(row.clube_id)];
    if (!m || row.mando !== m) continue;
    const arr = porAtleta.get(row.atleta_id) ?? [];
    arr.push(row);
    porAtleta.set(row.atleta_id, arr);
  }
  const jogadores: Record<string, JogadorSnapshot> = {};
  for (const [id, arr] of porAtleta) {
    const ultimos = arr.sort((a, b) => b.rodada - a.rodada).slice(0, janela);
    const soma = (k: string) => ultimos.reduce((s, g) => s + (g.scout[k] ?? 0), 0);
    jogadores[String(id)] = {
      jogos: ultimos.length,
      mediaMando: ultimos.length ? ultimos.reduce((s, g) => s + g.pontuacao, 0) / ultimos.length : 0,
      gols: soma("G"),
      assistencias: soma("A"),
      desarmes: soma("DS"),
      defesas: soma("DE"),
      ultimas: ultimos.map((g) => ({ rodada: g.rodada, pontuacao: g.pontuacao, scout: g.scout })),
    };
  }

  // Cedimentos por clube adversário e subcategoria
  const gruposPosicao: Record<number, string[]> = {
    2: ["LD", "LE"],
    3: ["ZAD", "ZAE"],
    4: ["VOL", "MCO", "MD", "ME"],
    5: ["PD", "PE", "CA"],
  };
  const posicaoDaSub: Record<string, number> = {
    LD: 2, LE: 2, ZAD: 3, ZAE: 3, VOL: 4, MCO: 4, MD: 4, ME: 4, PD: 5, PE: 5, CA: 5,
  };
  const cedidas: Record<string, { mediaCedida: number; amostra: number; usouFallback: boolean }> = {};
  for (const clubeStr of Object.keys(mando)) {
    const clube = Number(clubeStr);
    const mandoAdv = mando[clubeStr] === "casa" ? "fora" : "casa";
    // rodadas em que esse clube jogou nesse mando (as 5 mais recentes)
    const rodadasClube = [
      ...new Set(rows.filter((x) => x.adversario === clube && x.mando !== mandoAdv).map((x) => x.rodada)),
    ]
      .sort((a, b) => b - a)
      .slice(0, janela);
    const contra = rows.filter((x) => x.adversario === clube && rodadasClube.includes(x.rodada));
    for (const sub of [...Object.keys(posicaoDaSub), "GOL"]) {
      const posGeral = sub === "GOL" ? 1 : posicaoDaSub[sub]!;
      const grupo = gruposPosicao[posGeral] ?? [];
      const geral = contra.filter(
        (x) => x.posicao_id === posGeral || grupo.includes(subs[String(x.atleta_id)] ?? ""),
      );
      const porSub = contra.filter((x) =>
        sub === "GOL" ? x.posicao_id === 1 : subs[String(x.atleta_id)] === sub,
      );
      const usouFallback = sub !== "GOL" && porSub.length < AMOSTRA_MINIMA;
      const amostra = usouFallback ? geral : porSub;
      cedidas[`${clube}-${sub}`] = {
        mediaCedida:
          [...amostra].sort((a, b) => b.pontuacao - a.pontuacao).slice(0, 5).reduce((s, g) => s + g.pontuacao, 0) / 5,
        amostra: amostra.length,
        usouFallback,
      };
    }
  }

  return { rodada: rodadaAtual, mando, adversario, jogadores, cedidas };
}

