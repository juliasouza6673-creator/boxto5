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
  mediaCedida: number;
  mediaBasicaCedida: number;
  assistenciasCedidas: number;
  golsCedidos: number;
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
  const soma = jogos.reduce((s, g) => s + g.pontuacao, 0);
  const basica = jogos.reduce((s, g) => {
    let v = 0;
    for (const [k, w] of Object.entries(weights)) v += (g.scout[k] ?? 0) * w;
    return s + v;
  }, 0);
  return {
    jogos: jogos.sort((a, b) => b.rodada - a.rodada),
    mediaCedida: soma / count,
    mediaBasicaCedida: basica / count,
    assistenciasCedidas: jogos.reduce((s, g) => s + (g.scout['A'] ?? 0), 0),
    golsCedidos: jogos.reduce((s, g) => s + (g.scout['G'] ?? 0), 0),
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
