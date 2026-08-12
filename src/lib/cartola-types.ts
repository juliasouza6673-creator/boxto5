export type Scout = Record<string, number>;

export type Atleta = {
  atleta_id: number;
  apelido: string;
  apelido_abreviado?: string;
  foto?: string | null;
  clube_id: number;
  posicao_id: number;
  status_id: number;
  preco_num: number;
  variacao_num: number;
  media_num: number;
  pontos_num: number;
  jogos_num: number;
  minimo_para_valorizar?: number;
  scout?: Scout | null;
};

export type Clube = {
  id: number;
  nome: string;
  abreviacao: string;
  nome_fantasia?: string;
  escudos?: Record<string, string>;
};

export type Posicao = { id: number; nome: string; abreviacao: string };

export type Esquema = {
  esquema_id: number;
  nome: string;
  posicoes: Record<string, number>;
};

export type MercadoStatus = {
  rodada_atual: number;
  status_mercado: number;
  fechamento: { dia: number; mes: number; ano: number; hora: number; minuto: number; timestamp: number };
  times_escalados?: number;
};

export type Partida = {
  clube_casa_id: number;
  clube_visitante_id: number;
  partida_data?: string;
  local?: string;
  valida?: boolean;
};

export type MercadoPayload = {
  atletas: Atleta[];
  clubes: Record<string, Clube>;
  posicoes: Record<string, Posicao>;
};

export const POS_ABREV: Record<number, string> = {
  1: "GOL",
  2: "LAT",
  3: "ZAG",
  4: "MEI",
  5: "ATA",
  6: "TEC",
};

export const POS_NOME: Record<number, string> = {
  1: "Goleiro",
  2: "Lateral",
  3: "Zagueiro",
  4: "Meia",
  5: "Atacante",
  6: "Técnico",
};

export const STATUS_NOME: Record<number, string> = {
  2: "Dúvida",
  3: "Suspenso",
  5: "Nulo",
  6: "Contundido",
  7: "Provável",
};

export const SCOUT_POSITIVOS = ["G", "A", "SG", "DS", "FS", "FF", "FD", "FT", "DE", "DP", "PS"];
export const SCOUT_NEGATIVOS = ["GS", "PP", "CA", "CV", "GC", "I", "PC", "FC", "V"];
