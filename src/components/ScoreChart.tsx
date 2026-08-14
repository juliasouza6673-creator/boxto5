import { useMemo, useState } from "react";

export type RoundScore = { rodada: number; pontuacao: number | null };

const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);

function movingAvg(values: Array<number | null>, window: number) {
  const out: Array<number | null> = [];
  for (let i = 0; i < values.length; i++) {
    const slice = values.slice(0, i + 1).filter((v): v is number => v !== null);
    out.push(slice.length ? avg(slice.slice(-window)) : null);
  }
  return out;
}

export function ScoreChart({ dados }: { dados: RoundScore[] }) {
  const data = useMemo(() => dados.slice(-10), [dados]);
  const [hover, setHover] = useState<number | null>(null);

  const valores = data.map((d) => d.pontuacao);
  const disponiveis = valores.filter((v): v is number => v !== null);
  const mm3 = movingAvg(valores, 3);
  const mm5 = movingAvg(valores, 5);

  if (!data.length || !disponiveis.length)
    return (
      <div className="rounded-2xl border border-border bg-panel-2 p-4 text-center text-xs text-muted-foreground">
        Sem pontuações registradas nas últimas rodadas.
      </div>
    );

  const maior = Math.max(...disponiveis);
  const menor = Math.min(...disponiveis);
  const media = avg(disponiveis)!;
  const topo = Math.max(10, Math.ceil((maior * 1.2) / 5) * 5);
  const base = Math.min(0, Math.floor(menor / 5) * 5);
  const span = topo - base || 1;

  const W = 100;
  const H = 100;
  const y = (v: number) => H - ((v - base) / span) * H;
  const step = W / data.length;
  const cx = (i: number) => step * i + step / 2;

  const linha = (serie: Array<number | null>) =>
    serie
      .map((v, i) => (v === null ? null : `${cx(i)},${y(v)}`))
      .filter(Boolean)
      .join(" ");

  const mm3Fim = mm3.filter((v): v is number => v !== null);
  const delta = mm3Fim.length >= 2 ? mm3Fim[mm3Fim.length - 1]! - mm3Fim[mm3Fim.length - 2]! : 0;
  const tendencia = delta > 0.4 ? "↗ subindo" : delta < -0.4 ? "↘ caindo" : "→ estável";
  const idxMaior = valores.findIndex((v) => v === maior);
  const ultimaIdx = data.length - 1;

  return (
    <div className="rounded-2xl border border-border bg-panel-2 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-accent" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 20h18M6 16v-5M11 16V7M16 16v-8M21 16v-3" strokeLinecap="round" />
        </svg>
        <h4 className="font-display text-[11px] uppercase tracking-wide text-muted-foreground">
          Pontuações nas últimas rodadas
        </h4>
      </div>

      <div className="relative h-44 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full overflow-visible">
          <defs>
            <linearGradient id="barG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.8 0.16 152)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="oklch(0.55 0.15 152)" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="barO" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.82 0.15 65)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="oklch(0.6 0.16 55)" stopOpacity="0.55" />
            </linearGradient>
          </defs>

          {/* zona >= 8 pts */}
          <rect x="0" y={y(8)} width="100" height={Math.max(0, y(base) - y(8))} fill="currentColor" opacity="0.04" />
          <line x1="0" y1={y(8)} x2="100" y2={y(8)} stroke="currentColor" strokeDasharray="2 2" strokeWidth="0.4" opacity="0.35" />

          {data.map((d, i) => {
            if (d.pontuacao === null) return null;
            const v = d.pontuacao;
            const top = Math.min(y(v), y(0));
            const alt = Math.abs(y(v) - y(0));
            return (
              <rect
                key={d.rodada}
                x={cx(i) - step * 0.34}
                y={top}
                width={step * 0.68}
                height={Math.max(0.6, alt)}
                rx="1.2"
                fill={v < 2 ? "url(#barO)" : "url(#barG)"}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            );
          })}

          <polyline points={linha(mm5)} fill="none" stroke="oklch(0.75 0.1 240)" strokeWidth="0.8" strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          <polyline points={linha(mm3)} fill="none" stroke="oklch(0.55 0.08 250)" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
          {mm3.map((v, i) =>
            v === null ? null : (
              <circle
                key={i}
                cx={cx(i)}
                cy={y(v)}
                r={i === ultimaIdx ? 1.8 : 0.9}
                fill="oklch(0.55 0.08 250)"
                stroke={i === ultimaIdx ? "white" : "none"}
                strokeWidth="0.5"
              />
            ),
          )}
          {idxMaior >= 0 && (
            <text x={cx(idxMaior)} y={Math.max(4, y(maior) - 3)} textAnchor="middle" fontSize="5" fill="oklch(0.85 0.15 85)">
              ★
            </text>
          )}
        </svg>

        {hover !== null && data[hover] && data[hover]!.pontuacao !== null && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 rounded-lg border border-border bg-panel px-2 py-1 text-[10px] shadow"
            style={{ left: `${cx(hover)}%`, top: 0 }}
          >
            <p className="font-semibold">Rodada {data[hover]!.rodada}</p>
            <p>Pontuação: {data[hover]!.pontuacao!.toFixed(1)} pts</p>
            <p>MM3: {mm3[hover] !== null ? mm3[hover]!.toFixed(1) : "-"} pts</p>
            <p>MM5: {mm5[hover] !== null ? mm5[hover]!.toFixed(1) : "-"} pts</p>
          </div>
        )}
      </div>

      <div className="mt-1 flex w-full">
        {data.map((d, i) => (
          <span
            key={d.rodada}
            className={`flex-1 text-center text-[9px] ${i === ultimaIdx ? "font-semibold text-accent" : "text-muted-foreground"}`}
          >
            R{d.rodada}
            {d.pontuacao === null && <span className="block text-[8px]">pend.</span>}
          </span>
        ))}
      </div>

      <p className="mt-2 text-[9px] text-muted-foreground">
        ZONA ≥ 8 PTS · Pontuação (barras) · MM3 (linha contínua) · MM5 (tracejada)
      </p>

      <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
        <span>
          Média últimas: <b className="text-foreground">{media.toFixed(2)}</b>
        </span>
        <span>
          Maior: <b className="text-success">{maior.toFixed(1)}</b>
        </span>
        <span>
          Menor: <b className="text-destructive">{menor.toFixed(1)}</b>
        </span>
        <span>
          Tendência: <b className="text-foreground">{tendencia}</b>
        </span>
      </div>
    </div>
  );
}
