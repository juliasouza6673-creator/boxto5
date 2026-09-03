import type { Atleta, Clube, Scout } from "./cartola-types";
import { SCOUT_NEGATIVOS } from "./cartola-types";

export function escudo(clube: Clube | undefined, size: "30x30" | "45x45" | "60x60" = "45x45") {
  return clube?.escudos?.[size] ?? clube?.escudos?.["45x45"] ?? "";
}

export function statusClass(statusId: number) {
  if (statusId === 7) return "bg-success";
  if (statusId === 2) return "bg-warning";
  if (statusId === 5) return "bg-muted-foreground";
  return "bg-destructive";
}

export function statusBorderClass(statusId: number) {
  if (statusId === 7) return "border-success";
  if (statusId === 2) return "border-warning";
  if (statusId === 5) return "border-muted-foreground";
  return "border-destructive";
}

export function isScoutNegative(key: string) {
  return SCOUT_NEGATIVOS.includes(key);
}

export function scoutEntries(scout: Scout | null | undefined) {
  if (!scout) return [];
  return Object.entries(scout).filter(([, v]) => v > 0);
}

export function fmt(n: number | null | undefined, d = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return n.toFixed(d).replace(".", ",");
}

export function isEscalavel(a: Atleta) {
  // Nulo (5) é apenas informativo — nunca esconde o jogador.
  return a.status_id !== 6 && a.status_id !== 3;
}

export function playerPhoto(a: Atleta | undefined) {
  if (!a?.foto) return null;
  return a.foto.replace("FORMATO", "140x140");
}
