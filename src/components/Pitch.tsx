import { useRef, useState } from "react";
import type { Board, SlotState, Stroke } from "@/lib/board";
import { buildFormation } from "@/lib/board";
import type { Atleta, Clube, Esquema } from "@/lib/cartola-types";
import { POS_ABREV } from "@/lib/cartola-types";
import { escudo, fmt, playerPhoto, statusBorderClass } from "@/lib/cartola-ui";

type Tool = "none" | "pen" | "text" | "eraser";

type Props = {
  board: Board;
  esquemas: Esquema[];
  atletasById: Map<number, Atleta>;
  atletas: Atleta[];
  clubes: Record<string, Clube>;
  recomendados: number[];
  esperadoTotal: number | null;
  mercadoAberto: boolean;
  parciais: Record<string, number>;
  cedidas: Record<string, number>;
  onChange: (patch: (b: Board) => Board) => void;
  onSlotClick: (slot: SlotState) => void;
  onBenchClick: (slot: SlotState) => void;
  onPlayerClick: (a: Atleta) => void;
  onOpenAdvanced: () => void;
  onRename: (nome: string) => void;
  onDelete: () => void;
};


const IconWrench = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M14.7 6.3a4 4 0 0 0 5 5l-8.4 8.4a2.1 2.1 0 0 1-3-3L16.7 8.3" />
    <path d="M19.7 11.3 21 6.6 18.4 4 13.7 5.3" />
  </svg>
);
const IconReset = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </svg>
);
const IconPencil = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M4 20h4L20 8l-4-4L4 16v4Z" />
    <path d="m14 6 4 4" />
  </svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
  </svg>
);

export function Pitch({
  board,
  esquemas,
  atletasById,
  clubes,
  recomendados,
  esperadoTotal,
  mercadoAberto,
  parciais,
  cedidas,
  onChange,
  onSlotClick,
  onBenchClick,
  onPlayerClick,
  onOpenAdvanced,
  onRename,
  onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tool, setTool] = useState<Tool>("none");
  const [color, setColor] = useState("#ff7a18");
  const [width, setWidth] = useState(12);
  const [drawOpen, setDrawOpen] = useState(false);
  const [redoStack, setRedoStack] = useState<Stroke[]>([]);
  const [mcOn, setMcOn] = useState(false);
  const drawing = useRef<string | null>(null);
  const dragId = useRef<string | null>(null);

  const valorTotal = [...board.slots, ...board.bench].reduce(
    (s, sl) => s + (sl.atletaId ? (atletasById.get(sl.atletaId)?.preco_num ?? 0) : 0),
    0,
  );

  const rel = (e: { clientX: number; clientY: number }) => {
    const r = ref.current!.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (tool === "pen") {
      const { x, y } = rel(e);
      const id = crypto.randomUUID();
      drawing.current = id;
      setRedoStack([]);
      onChange((b) => ({ ...b, strokes: [...b.strokes, { id, d: `M ${x} ${y}`, color, width }] }));
    } else if (tool === "text") {
      const { x, y } = rel(e);
      const text = window.prompt("Texto:");
      if (text) onChange((b) => ({ ...b, bubbles: [...b.bubbles, { id: crypto.randomUUID(), x, y, text, color }] }));
      setTool("none");
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (dragId.current && !board.locked) {
      const { x, y } = rel(e);
      const id = dragId.current;
      onChange((b) => ({ ...b, slots: b.slots.map((s) => (s.id === id ? { ...s, x, y } : s)) }));
      return;
    }
    if (tool === "pen" && drawing.current) {
      const { x, y } = rel(e);
      const id = drawing.current;
      onChange((b) => ({
        ...b,
        strokes: b.strokes.map((s) => (s.id === id ? { ...s, d: `${s.d} L ${x} ${y}` } : s)),
      }));
    }
  };

  const endPointer = () => {
    drawing.current = null;
    dragId.current = null;
  };

  const eraseStroke = (s: Stroke) => {
    if (tool !== "eraser") return;
    onChange((b) => ({ ...b, strokes: b.strokes.filter((x) => x.id !== s.id) }));
  };

  const undo = () => {
    const last = board.strokes[board.strokes.length - 1];
    if (!last) return;
    setRedoStack((r) => [...r, last]);
    onChange((b) => ({ ...b, strokes: b.strokes.slice(0, -1) }));
  };

  const redo = () => {
    const last = redoStack[redoStack.length - 1];
    if (!last) return;
    setRedoStack((r) => r.slice(0, -1));
    onChange((b) => ({ ...b, strokes: [...b.strokes, last] }));
  };

  const tools: Array<[Tool | "clear", string, string]> = [
    ["pen", "✏️", "Caneta"],
    ["text", "T", "Texto"],
    ["eraser", "🩹", "Borracha"],
    ["clear", "🧹", "Limpar desenhos"],
  ];

  return (
    <section className="panel p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          value={board.nome}
          onChange={(e) => onRename(e.target.value)}
          className="min-w-24 flex-1 bg-transparent font-display text-lg tracking-wide outline-none"
        />
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="flex flex-wrap items-center gap-1 rounded-lg border border-primary/30 bg-panel-2 px-1.5 py-1"
          >
            {[
              { t: "Ferramentas avançadas", i: <IconWrench />, f: onOpenAdvanced },
              {
                t: board.locked ? "Travado (clique para liberar)" : "Livre (clique para travar)",
                i: <span className="text-[12px]">{board.locked ? "🔒" : "🔓"}</span>,
                f: () => onChange((b) => ({ ...b, locked: !b.locked })),
              },
              {
                t: "Resetar posições",
                i: <IconReset />,
                f: () =>
                  onChange((b) => ({
                    ...b,
                    slots: buildFormation(b.formacao).map((s, i) => ({ ...s, atletaId: b.slots[i]?.atletaId ?? null })),
                  })),
              },
              {
                t: "Vender time",
                i: <span className="text-[12px]">💸</span>,
                f: () =>
                  onChange((b) => ({
                    ...b,
                    slots: b.slots.map((s) => ({ ...s, atletaId: null })),
                    bench: b.bench.map((s) => ({ ...s, atletaId: null })),
                  })),
              },
              { t: "Desenhar", i: <IconPencil />, f: () => setDrawOpen((o) => !o) },
            ].map((b2) => (
              <button
                key={b2.t}
                title={b2.t}
                aria-label={b2.t}
                onClick={(e) => {
                  e.stopPropagation();
                  b2.f();
                }}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-[12px] hover:border-accent"
              >
                {b2.i}
              </button>
            ))}
            <button
              title="MC — mostrar média cedida no lugar do preço"
              aria-label="Média cedida"
              onClick={(e) => {
                e.stopPropagation();
                setMcOn((v) => !v);
              }}
              className={`h-7 rounded-md border px-1.5 font-display text-[10px] ${mcOn ? "border-accent text-accent" : "border-border text-muted-foreground"}`}
            >
              MC
            </button>
          </div>
        <button
          onClick={onDelete}
          title="Excluir campinho inteiro"
          aria-label="Excluir campinho inteiro"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-destructive/60 text-destructive hover:bg-destructive/10"
        >
          <IconTrash />
        </button>
      </div>

      <div>


          {drawOpen && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="mx-auto mb-2 flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-lg border border-primary/30 bg-panel-2 p-1.5"
              >
                {tools.map(([t, icon, label]) => (
                  <button
                    key={t}
                    title={label}
                    onClick={() =>
                      t === "clear"
                        ? onChange((b) => ({ ...b, strokes: [], bubbles: [] }))
                        : setTool(tool === t ? "none" : (t as Tool))
                    }
                    className={`h-7 w-7 rounded-md border text-[11px] ${tool === t ? "border-accent text-accent" : "border-border text-muted-foreground"}`}
                  >
                    {icon}
                  </button>
                ))}
                <button title="Desfazer" onClick={undo} className="h-7 w-7 rounded-md border border-border text-[11px] text-muted-foreground">
                  ↶
                </button>
                <button title="Refazer" onClick={redo} className="h-7 w-7 rounded-md border border-border text-[11px] text-muted-foreground">
                  ↷
                </button>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-7 w-7 rounded-md border border-border bg-transparent"
                />
                <span className="flex w-full items-center gap-1">
                  <input
                    type="range"
                    min={1}
                    max={24}
                    value={width}
                    onChange={(e) => setWidth(Number(e.target.value))}
                    className="h-6 flex-1 accent-accent"
                  />
                  <span className="text-[10px] text-muted-foreground">{width}px</span>
                </span>
              </div>
            )}
        <div
          ref={ref}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerLeave={endPointer}
          className="relative min-w-0 flex-1 touch-none overflow-hidden rounded-xl border border-border"
          style={{
            aspectRatio: "3 / 3.7",
            background:
              "repeating-linear-gradient(90deg, oklch(1 0 0 / 4%) 0 8%, transparent 8% 16%), linear-gradient(180deg, var(--pitch-b), var(--pitch-a) 65%, oklch(0.3 0.07 152))",
          }}
        >
          <div className="pointer-events-none absolute inset-2 rounded-sm border border-primary/25" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/25" />
          <div className="pointer-events-none absolute inset-x-2 top-1/2 border-t border-primary/20" />
          <div className="pointer-events-none absolute bottom-2 left-1/2 h-[16%] w-[55%] -translate-x-1/2 border border-b-0 border-primary/25" />
          <div className="pointer-events-none absolute top-2 left-1/2 h-[16%] w-[55%] -translate-x-1/2 border border-t-0 border-primary/25" />

          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 h-full w-full"
            style={{ pointerEvents: tool === "eraser" ? "auto" : "none" }}
          >
            {board.strokes.map((s) => (
              <g key={s.id}>
                <path
                  d={s.d}
                  stroke={s.color}
                  strokeWidth={s.width / 4}
                  fill="none"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ pointerEvents: "none" }}
                />
                {tool === "eraser" && (
                  <path
                    d={s.d}
                    stroke="transparent"
                    strokeWidth={Math.max(14, s.width * 3)}
                    fill="none"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      eraseStroke(s);
                    }}
                    onPointerEnter={(e) => {
                      if (e.buttons === 1) eraseStroke(s);
                    }}
                    style={{ pointerEvents: "stroke", cursor: "crosshair" }}
                  />
                )}
              </g>
            ))}
          </svg>

          {board.bubbles.map((t) => (
            <span
              key={t.id}
              onDoubleClick={() => onChange((b) => ({ ...b, bubbles: b.bubbles.filter((x) => x.id !== t.id) }))}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (tool === "eraser") {
                  onChange((b) => ({ ...b, bubbles: b.bubbles.filter((x) => x.id !== t.id) }));
                  return;
                }
                const move = (ev: PointerEvent) => {
                  const { x, y } = rel(ev);
                  onChange((b) => ({ ...b, bubbles: b.bubbles.map((x2) => (x2.id === t.id ? { ...x2, x, y } : x2)) }));
                };
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border border-border bg-panel/90 px-2 py-0.5 text-[10px]"
              style={{ left: `${t.x}%`, top: `${t.y}%`, color: t.color }}
            >
              {t.text}
            </span>
          ))}

          {board.slots.map((slot) => {
            const a = slot.atletaId ? atletasById.get(slot.atletaId) : undefined;
            const foto = a ? playerPhoto(a) : null;
            return (
              <div
                key={slot.id}
                className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
                onPointerDown={(e) => {
                  if (board.locked || tool !== "none") return;
                  e.stopPropagation();
                  dragId.current = slot.id;
                }}
              >
                <div className="relative">
                  <button
                    onClick={() => (a ? onPlayerClick(a) : onSlotClick(slot))}
                    className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 bg-panel/90 shadow ${a ? statusBorderClass(a.status_id) : "border-primary/40"}`}
                  >
                    {foto ? (
                      <img src={foto} alt={a!.apelido} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-sm text-primary/70">+</span>
                    )}
                  </button>
                  {a && (
                    <>
                      <img
                        src={escudo(clubes[String(a.clube_id)], "30x30")}
                        alt=""
                        className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background object-contain"
                      />
                      {recomendados.includes(a.atleta_id) && (
                        <span className="absolute -top-2 right-0 text-[10px] text-accent">★</span>
                      )}
                    </>
                  )}
                </div>
                <span className="mt-0.5 max-w-16 truncate rounded bg-background/60 px-1 text-[9px] leading-tight">
                  {a ? a.apelido : POS_ABREV[slot.pos]}
                </span>
                {a && (
                  <span className="rounded bg-black px-1 text-[9px] font-bold text-white">
                    {!mercadoAberto
                      ? `${fmt(parciais[String(a.atleta_id)] ?? 0, 1)} pts`
                      : mcOn
                        ? `MC ${fmt(cedidas[String(a.atleta_id)] ?? 0, 1)}`
                        : `C$ ${fmt(a.preco_num, 1)}`}
                  </span>
                )}
              </div>
            );
          })}

          <button
            onClick={() =>
              onChange((b) => ({
                ...b,
                slots: [
                  ...b.slots,
                  { id: crypto.randomUUID(), pos: 4, x: 50, y: 50, atletaId: null, extra: true },
                ],
              }))
            }
            className="absolute right-2 top-2 rounded-lg border border-primary/30 bg-background/50 px-2 py-0.5 text-[10px]"
          >
            + Jogador
          </button>

          <div className="absolute bottom-2 left-2 flex flex-col items-start gap-1">
            <span className="rounded-lg border border-success/40 bg-background/70 px-2 py-0.5 font-display text-[11px] text-success">
              {mercadoAberto
                ? `Valorização esperada: ${esperadoTotal === null ? "…" : fmt(esperadoTotal, 2)}`
                : `Pontuação: ${fmt(
                    board.slots.reduce(
                      (s, sl) => s + (sl.atletaId ? (parciais[String(sl.atletaId)] ?? 0) : 0),
                      0,
                    ),
                    2,
                  )}`}
            </span>
            <select
              value={board.formacao}
              onChange={(e) => {
                const f = e.target.value;
                onChange((b) => {
                  const novos = buildFormation(f);
                  const byPos = new Map<number, number[]>();
                  for (const s of b.slots)
                    if (s.atletaId) byPos.set(s.pos, [...(byPos.get(s.pos) ?? []), s.atletaId]);
                  const slots = novos.map((s) => {
                    const pool = byPos.get(s.pos);
                    return pool && pool.length ? { ...s, atletaId: pool.shift()! } : s;
                  });
                  const extras = b.slots.filter((s) => s.extra);
                  return { ...b, formacao: f, slots: [...slots, ...extras] };
                });
              }}
              className="rounded-lg border border-primary/30 bg-background/70 px-1.5 py-0.5 text-[10px]"
            >
              {(esquemas.length ? esquemas.map((e) => e.nome) : ["4-3-3", "4-4-2", "3-4-3"]).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <span className="absolute bottom-2 right-2 rounded-lg border border-primary/30 bg-background/70 px-2 py-0.5 font-display text-[11px] text-accent">
            C$ {fmt(valorTotal, 2)}
          </span>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-border bg-panel-2 p-2">
        <p className="mb-2 text-center font-display text-xs tracking-wide text-muted-foreground">Banco de reservas</p>
        <div className="flex justify-center gap-2 overflow-x-auto">
          {board.bench.map((slot) => {
            const a = slot.atletaId ? atletasById.get(slot.atletaId) : undefined;
            const foto = a ? playerPhoto(a) : null;
            return (
              <div key={slot.id} className="flex w-14 shrink-0 flex-col items-center">
                <div className="relative">
                  <button
                    onClick={() => (a ? onPlayerClick(a) : onBenchClick(slot))}
                    className={`flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 bg-panel shadow ${a ? statusBorderClass(a.status_id) : "border-border"}`}
                  >
                    {foto ? (
                      <img src={foto} alt={a!.apelido} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{POS_ABREV[slot.pos]}</span>
                    )}
                  </button>
                  {a && (
                    <img
                      src={escudo(clubes[String(a.clube_id)], "30x30")}
                      alt=""
                      className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-background object-contain"
                    />
                  )}
                </div>
                <span className="mt-0.5 max-w-14 truncate text-[9px] leading-tight text-muted-foreground">
                  {a ? a.apelido : POS_ABREV[slot.pos]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
