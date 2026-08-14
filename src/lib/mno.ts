export type MnoInput = {
  rodada: number;
  preco_atual: number;
  pontos_ultima: number;
  jogou_ultima: boolean;
  pontos_ultimo_jogo_real?: number | null;
  jogos_disputados: number;
};

export type MnoResult = {
  mno_estimado: number;
  dificuldade: "Muito Fácil" | "Fácil" | "Moderada" | "Difícil" | "Muito Difícil";
  fator_chave: string;
  recomendacao_patrimonio: "Ganho Alto" | "Ganho Moderado" | "Risco de Perda" | "Risco Alto de Perda";
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeMNO(i: MnoInput): MnoResult {
  const usaReal = !i.jogou_ultima || i.pontos_ultima === 0;
  const P = usaReal ? (i.pontos_ultimo_jogo_real ?? i.pontos_ultima ?? 0) : i.pontos_ultima;

  let mno: number;
  let fator: string;

  if (i.jogos_disputados === 0 && i.rodada > 1) {
    mno = i.preco_atual * 0.4;
    fator = "Estreante após a primeira rodada: meta reduzida sobre o preço.";
  } else if (i.rodada === 1) {
    mno = i.preco_atual * 0.45;
    fator = "Rodada 1: meta calculada apenas sobre o preço inicial.";
  } else if (i.rodada === 2) {
    mno = i.preco_atual * 0.9 - P;
    fator = "Rodada 2: preço ainda pesa muito e a pontuação anterior abate a meta.";
  } else if (i.rodada === 3) {
    mno = i.preco_atual * 0.85 - P * 0.5;
    fator = "Rodada 3: transição entre preço e desempenho recente.";
  } else if (P < 5) {
    mno = 0.8 * P + 1.58;
    fator = "Favorecido pela pontuação baixa no último jogo.";
  } else if (P < 12) {
    mno = 0.74 * P + 1.62;
    fator = "Meta equilibrada pela pontuação média do último jogo.";
  } else {
    mno = 0.82 * P + 1.85;
    fator = "Puxado pela mitada do último jogo.";
  }

  if (usaReal && i.jogos_disputados > 0 && i.rodada >= 4) {
    fator += " Base: último jogo em que realmente entrou em campo.";
  }

  const mno_estimado = round2(mno);
  const dificuldade: MnoResult["dificuldade"] =
    mno_estimado < 0 ? "Muito Fácil" : mno_estimado < 3 ? "Fácil" : mno_estimado < 6.5 ? "Moderada" : mno_estimado < 9.5 ? "Difícil" : "Muito Difícil";
  const recomendacao_patrimonio: MnoResult["recomendacao_patrimonio"] =
    mno_estimado < 3 ? "Ganho Alto" : mno_estimado < 6.5 ? "Ganho Moderado" : mno_estimado < 9.5 ? "Risco de Perda" : "Risco Alto de Perda";

  return { mno_estimado, dificuldade, fator_chave: fator, recomendacao_patrimonio };
}

/** Parcial ao vivo x MNO -> variação estimada em cartoletas. */
export function liveValuation(pontos_parcial: number, mno_estimado: number) {
  const diferenca = pontos_parcial - mno_estimado;
  const variacao_cartoletas = Math.round(diferenca * 0.25 * 100) / 100;
  const positivo = diferenca >= 0;
  return {
    diferenca,
    variacao_cartoletas,
    status: positivo ? ("VALORIZANDO" as const) : ("DESVALORIZANDO" as const),
    cor_hex: positivo ? "#00C853" : "#D50000",
    texto_exibicao: positivo
      ? `+C$ ${variacao_cartoletas.toFixed(2)}`
      : `-C$ ${Math.abs(variacao_cartoletas).toFixed(2)}`,
  };
}
