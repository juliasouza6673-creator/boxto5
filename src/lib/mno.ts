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
  // Sempre usar a pontuação do último jogo em que o atleta REALMENTE entrou em campo.
  const P = i.jogou_ultima && i.pontos_ultima !== 0 ? i.pontos_ultima : (i.pontos_ultimo_jogo_real ?? i.pontos_ultima ?? 0);

  let mno: number;
  let fator: string;

  if (i.jogos_disputados === 0 && i.rodada > 1) {
    mno = i.preco_atual * 0.4;
    fator = "Estreante após a primeira rodada: meta reduzida sobre o preço.";
  } else if (i.rodada === 1) {
    mno = i.preco_atual * 0.43;
    fator = "Rodada 1: meta calculada apenas sobre o preço inicial.";
  } else if (i.rodada === 2) {
    // média ponderada entre preço inicial e a pontuação da rodada 1
    mno = 0.55 * P + 0.22 * i.preco_atual;
    fator = "Rodada 2: média ponderada entre o preço e a pontuação da rodada 1.";
  } else {
    // MPV_t = f(C_{t-1}, S_{t-1}): a inércia do algoritmo exige pontuação próxima da anterior
    mno = 0.8 * P + 0.085 * i.preco_atual;
    fator = `Baseado na última partida em que entrou em campo (${P.toFixed(2)} pts) e no preço atual (C$ ${i.preco_atual.toFixed(2)}).`;
  }

  if (!i.jogou_ultima && i.jogos_disputados > 0 && i.rodada >= 3) {
    fator += " Ele não jogou a última rodada — base: o último jogo disputado.";
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
