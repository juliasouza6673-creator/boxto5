import { useState } from "react";
import type { Atleta, Clube } from "@/lib/cartola-types";
import { escudo } from "@/lib/cartola-ui";

export type FillScope = "todos" | "defesa" | "meias" | "ataque";

const MINIS: Record<FillScope, number[]> = {
  todos: [1, 2, 3, 4, 5, 6],
  defesa: [1, 2, 3, 6],
  meias: [4],
  ataque: [5],
};

function Mini({ scope }: { scope: FillScope }) {
  const pos = MINIS[scope];
  const dots: Array<[number, number]> = [];
  if (pos.includes(5)) dots.push([30, 15], [50, 12], [70, 15]);
  if (pos.includes(4)) dots.push([25, 40], [50, 38], [75, 40]);
  if (pos.includes(3)) dots.push([38, 65], [62, 65]);
  if (pos.includes(2)) dots.push([12, 62], [88, 62]);
  if (pos.includes(1)) dots.push([50, 88]);
  return (
    <svg viewBox="0 0 100 100" className="h-16 w-12 rounded border border-border bg-pitch-a">
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={7} className="fill-primary" />
      ))}
    </svg>
  );
}

export function AdvancedTools({
  clubes,
  atletas,
  onFill,
  onClose,
}: {
  clubes: Record<string, Clube>;
  atletas: Atleta[];
  onFill: (clubeId: number, scope: FillScope) => void;
  onClose: () => void;
}) {
  const [clubeId, setClubeId] = useState<number | null>(null);
  const times = Object.values(clubes)
    .filter((c) => c.escudos && atletas.some((a) => a.clube_id === c.id))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-background/85 p-3" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-panel p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg tracking-wide">Ferramentas avançadas</h3>
          <button onClick={onClose} className="text-muted-foreground">
            ✕
          </button>
        </div>
        <p className="mb-2 text-xs text-muted-foreground">1. Escolha o time</p>
        <div className="mb-4 grid grid-cols-7 gap-2">
          {times.map((c) => (
            <button
              key={c.id}
              onClick={() => setClubeId(c.id)}
              className={`rounded-lg border p-1 ${clubeId === c.id ? "border-accent" : "border-border"}`}
            >
              <img src={escudo(c, "45x45")} alt={c.nome} className="h-7 w-7 object-contain" />
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">2. Escalar</p>
        <div className="grid grid-cols-4 gap-2">
          {(["todos", "defesa", "meias", "ataque"] as FillScope[]).map((s) => (
            <button
              key={s}
              disabled={!clubeId}
              onClick={() => {
                if (clubeId) {
                  onFill(clubeId, s);
                  onClose();
                }
              }}
              className="flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-xs disabled:opacity-40"
            >
              <Mini scope={s} />
              {s === "todos" ? "Time inteiro" : s === "defesa" ? "Defesa" : s === "meias" ? "Meias" : "Ataque"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
