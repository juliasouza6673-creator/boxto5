import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Atleta } from "./cartola-types";

/** Status manuais suportados (mesmos IDs do Cartola). */
export const STATUS_OPCOES: Array<{ id: number; label: string }> = [
  { id: 7, label: "Provável" },
  { id: 2, label: "Dúvida" },
  { id: 6, label: "Contundido" },
  { id: 5, label: "Nulo" },
  { id: 3, label: "Suspenso" },
];

export type StatusMap = Record<string, number>;

export function useStatusOverrides() {
  return useQuery({
    queryKey: ["status-overrides"],
    staleTime: 60_000,
    queryFn: async (): Promise<StatusMap> => {
      const { data, error } = await supabase.from("player_status_overrides").select("atleta_id, status_id");
      if (error) throw error;
      const map: StatusMap = {};
      for (const r of data ?? []) map[String(r.atleta_id)] = r.status_id;
      return map;
    },
  });
}

export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ atletaId, statusId }: { atletaId: number; statusId: number | null }) => {
      if (statusId === null) {
        const { error } = await supabase.from("player_status_overrides").delete().eq("atleta_id", atletaId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from("player_status_overrides")
        .upsert({ atleta_id: atletaId, status_id: statusId }, { onConflict: "atleta_id" });
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["status-overrides"] }),
  });
}

/** Aplica os status definidos pelo admin por cima do que vem da API. */
export function aplicarStatus(atletas: Atleta[], overrides: StatusMap | undefined): Atleta[] {
  if (!overrides || !Object.keys(overrides).length) return atletas;
  return atletas.map((a) => {
    const s = overrides[String(a.atleta_id)];
    return s === undefined || s === a.status_id ? a : { ...a, status_id: s };
  });
}
