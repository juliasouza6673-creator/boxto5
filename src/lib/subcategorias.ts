import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Sub =
  | "ZAE"
  | "ZAD"
  | "LE"
  | "LD"
  | "VOL"
  | "MD"
  | "ME"
  | "MCO"
  | "CA"
  | "PE"
  | "PD";

export const SUB_NOME: Record<Sub, string> = {
  ZAE: "Zagueiro Esquerdo",
  ZAD: "Zagueiro Direito",
  LE: "Lateral Esquerdo",
  LD: "Lateral Direito",
  VOL: "Volante",
  MD: "Meia Direito",
  ME: "Meia Esquerdo",
  MCO: "Meia Ofensivo",
  CA: "Centroavante",
  PE: "Ponta Esquerda",
  PD: "Ponta Direita",
};

/** Subcategorias válidas por posição do Cartola (1 GOL e 6 TEC não têm). */
export const SUBS_POR_POSICAO: Record<number, Sub[]> = {
  2: ["LD", "LE"],
  3: ["ZAD", "ZAE"],
  4: ["VOL", "MCO", "MD", "ME"],
  5: ["PD", "PE", "CA"],
};

export const POSICAO_DA_SUB: Record<Sub, number> = {
  LD: 2,
  LE: 2,
  ZAD: 3,
  ZAE: 3,
  VOL: 4,
  MCO: 4,
  MD: 4,
  ME: 4,
  PD: 5,
  PE: 5,
  CA: 5,
};

/** Tabela de confrontos por subcategoria (bidirecional). */
const BASE_ENFRENTA: Partial<Record<Sub | "GOL", Array<Sub>>> = {
  PE: ["LD", "ZAD"],
  PD: ["LE", "ZAE"],
  VOL: ["MCO", "VOL"],
  MD: ["VOL", "ZAE", "LE"],
  ME: ["VOL", "LD", "ZAD"],
  CA: ["ZAD", "ZAE"],
  GOL: ["CA", "PD", "PE"],
};

export const ENFRENTA: Record<string, Sub[]> = (() => {
  const out: Record<string, Sub[]> = {};
  const push = (k: string, v: Sub) => {
    out[k] = out[k] ?? [];
    if (!out[k]!.includes(v)) out[k]!.push(v);
  };
  for (const [k, list] of Object.entries(BASE_ENFRENTA)) {
    for (const v of list ?? []) {
      push(k, v);
      if (k !== "GOL") push(v, k as Sub);
    }
  }
  return out;
})();

/** Grupo de fallback: subcategorias da mesma posição geral. */
export function grupoPosicao(sub: Sub): Sub[] {
  return SUBS_POR_POSICAO[POSICAO_DA_SUB[sub]] ?? [sub];
}

export type SubMap = Record<string, Sub>;

export function parseSubcategoriasTxt(txt: string) {
  const linhas = txt.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith("#"));
  const out: Array<{ atleta_id: number; nome: string; clube: string; posicao_id: number | null; subcategoria: Sub }> = [];
  const erros: string[] = [];
  for (const [i, linha] of linhas.entries()) {
    const [id, nome, clube, posicao, sub] = linha.split(";").map((s) => s?.trim() ?? "");
    const atletaId = Number(id);
    const subUp = (sub ?? "").toUpperCase() as Sub;
    if (!atletaId || !SUB_NOME[subUp]) {
      if (i === 0 && /atleta/i.test(id ?? "")) continue; // cabeçalho
      erros.push(`Linha ${i + 1}: inválida`);
      continue;
    }
    out.push({
      atleta_id: atletaId,
      nome: nome ?? "",
      clube: clube ?? "",
      posicao_id: Number(posicao) || POSICAO_DA_SUB[subUp] || null,
      subcategoria: subUp,
    });
  }
  return { registros: out, erros };
}

export function useSubcategorias() {
  return useQuery({
    queryKey: ["subcategorias"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SubMap> => {
      const { data, error } = await supabase.from("player_subcategories").select("atleta_id, subcategoria");
      if (error) throw error;
      const map: SubMap = {};
      for (const r of data ?? []) map[String(r.atleta_id)] = r.subcategoria as Sub;
      return map;
    },
  });
}

export function useIsAdmin(userId: string | null) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: userId!, _role: "admin" });
      if (error) return false;
      return !!data;
    },
  });
}

export function useSubcategoriaMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["subcategorias"] });
  return {
    async salvar(registros: Array<{ atleta_id: number; nome?: string; clube?: string; posicao_id?: number | null; subcategoria: Sub }>) {
      const { error } = await supabase.from("player_subcategories").upsert(
        registros.map((r) => ({
          atleta_id: r.atleta_id,
          nome: r.nome ?? null,
          clube: r.clube ?? null,
          posicao_id: r.posicao_id ?? null,
          subcategoria: r.subcategoria,
        })),
        { onConflict: "atleta_id" },
      );
      if (error) throw error;
      await invalidate();
    },
  };
}
