import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Atleta, Clube, Partida } from "@/lib/cartola-types";
import { POS_ABREV, STATUS_NOME } from "@/lib/cartola-types";
import { escudo, playerPhoto } from "@/lib/cartola-ui";
import { useSubcategorias } from "@/lib/subcategorias";
import campinhoBg from "@/assets/campinho7.png.asset.json";

type Pos = { id: number; x: number; y: number };

/** Posição padrão (em %) por subcategoria/posição — atacando para cima. */
const SUB_POS: Record<string, [number, number]> = {
  GOL: [50, 90], ZAG: [50, 74], ZAD: [64, 74], ZAE: [36, 74], LD: [85, 64], LE: [15, 64],
  VOL: [50, 56], MD: [80, 42], ME: [20, 42], MCO: [50, 40], PD: [80, 22], PE: [20, 22], CA: [50, 12],
};
const POS_DEF: Record<number, [number, number]> = { 1: [50, 90], 2: [15, 64], 3: [50, 74], 4: [50, 45], 5: [50, 14] };

const em = (a: Atleta) => a.status_id === 7 || a.status_id === 2;

function layout(list: Atleta[], subs: Record<string, string> | undefined): Pos[] {
  const usados: Record<string, number> = {};
  return list.map((a) => {
    const sub = subs?.[String(a.atleta_id)]?.toUpperCase();
    const base = (sub && SUB_POS[sub]) || POS_DEF[a.posicao_id] || [50, 50];
    const k = `${base[0]}-${base[1]}`;
    const n = usados[k] ?? 0;
    usados[k] = n + 1;
    const off = n === 0 ? 0 : (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 18;
    return { id: a.atleta_id, x: Math.min(92, Math.max(8, base[0] + off)), y: base[1] };
  });
}

function sugestao(elenco: Atleta[]): Atleta[] {
  const cota: Record<number, number> = { 1: 1, 2: 2, 3: 2, 4: 3, 5: 3 };
  const out: Atleta[] = [];
  for (const a of elenco.filter(em).sort((x, y) => y.media_num - x.media_num)) {
    if ((cota[a.posicao_id] ?? 0) > 0) {
      cota[a.posicao_id] = (cota[a.posicao_id] ?? 0) - 1;
      out.push(a);
    }
  }
  return out;
}

type Props = {
  partidas: Partida[];
  rodada: number;
  clubes: Record<string, Clube>;
  atletas: Atleta[];
  isAdmin: boolean;
  onOpenPlayer: (a: Atleta) => void;
};

export function ConfrontoPitches({ partidas, rodada, clubes, atletas, isAdmin, onOpenPlayer }: Props) {
  const { data: salvas } = useQuery({
    queryKey: ["probable-lineups-all", rodada],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("probable_lineups").select("clube_id, atletas").eq("rodada", rodada);
      const map: Record<number, Pos[] | number[]> = {};
      for (const r of data ?? []) map[r.clube_id] = (r.atletas as Pos[] | number[]) ?? [];
      return map;
    },
  });

  return (
    <div className="space-y-5">
      {partidas.map((p, i) => {
        const d = p.partida_data ? new Date(p.partida_data.replace(" ", "T")) : null;
        return (
          <article key={i} className="brutal bg-panel p-3">
            <header className="mb-3 flex flex-wrap items-center justify-center gap-3 border-b-2 border-dashed border-border pb-2">
              <img src={escudo(clubes[String(p.clube_casa_id)], "45x45")} alt="" className="h-9 w-9 object-contain" />
              <span className="font-display text-lg uppercase">
                {clubes[String(p.clube_casa_id)]?.abreviacao} x {clubes[String(p.clube_visitante_id)]?.abreviacao}
              </span>
              <img src={escudo(clubes[String(p.clube_visitante_id)], "45x45")} alt="" className="h-9 w-9 object-contain" />
              <span className="w-full text-center font-mono text-[10px] uppercase text-muted-foreground">
                {d ? d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Data a definir"}
                {p.local ? ` · ${p.local}` : ""}
              </span>
            </header>
            <div className="grid gap-3 sm:grid-cols-2">
              {[p.clube_casa_id, p.clube_visitante_id].map((cid, side) => (
                <TeamPitch
                  key={cid}
                  clubeId={cid}
                  mando={side === 0 ? "Mandante" : "Visitante"}
                  rodada={rodada}
                  clubes={clubes}
                  atletas={atletas}
                  salvo={salvas?.[cid]}
                  isAdmin={isAdmin}
                  onOpenPlayer={onOpenPlayer}
                />
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function TeamPitch({
  clubeId, mando, rodada, clubes, atletas, salvo, isAdmin, onOpenPlayer,
}: {
  clubeId: number; mando: string; rodada: number; clubes: Record<string, Clube>; atletas: Atleta[];
  salvo: Pos[] | number[] | undefined; isAdmin: boolean; onOpenPlayer: (a: Atleta) => void;
}) {
  const qc = useQueryClient();
  const { data: subs } = useSubcategorias();
  const clube = clubes[String(clubeId)];
  const elenco = useMemo(() => atletas.filter((a) => a.clube_id === clubeId), [atletas, clubeId]);
  const byId = useMemo(() => new Map(elenco.map((a) => [a.atleta_id, a])), [elenco]);

  const base: Pos[] = useMemo(() => {
    if (salvo && salvo.length) {
      if (typeof salvo[0] === "number") {
        const list = (salvo as number[]).map((id) => byId.get(id)).filter((a): a is Atleta => !!a);
        return layout(list, subs);
      }
      return salvo as Pos[];
    }
    return layout(sugestao(elenco), subs);
  }, [salvo, byId, elenco, subs]);

  const [editando, setEditando] = useState(false);
  const [draft, setDraft] = useState<Pos[]>([]);
  const [busca, setBusca] = useState("");
  const [gaveta, setGaveta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const campo = useRef<HTMLDivElement>(null);
  const arrastando = useRef<number | null>(null);

  const atual = editando ? draft : base;
  // Para todos: só aparece Provável/Dúvida. No editor o admin vê todos os que posicionou.
  const visiveis = atual.filter((p) => {
    const a = byId.get(p.id);
    return a && (editando || em(a));
  });
  const desfalques = elenco.filter((a) => a.status_id === 3 || a.status_id === 6);

  const mover = (e: React.PointerEvent) => {
    if (arrastando.current === null || !campo.current) return;
    const r = campo.current.getBoundingClientRect();
    const x = Math.min(95, Math.max(5, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(95, Math.max(5, ((e.clientY - r.top) / r.height) * 100));
    const id = arrastando.current;
    setDraft((d) => d.map((p) => (p.id === id ? { ...p, x, y } : p)));
  };

  const salvar = async () => {
    setSalvando(true);
    const atletasJson = draft.map((p) => ({ id: p.id, x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
    const { error } = await supabase
      .from("probable_lineups")
      .upsert({ rodada, clube_id: clubeId, atletas: atletasJson }, { onConflict: "rodada,clube_id" });
    setSalvando(false);
    if (!error) {
      await qc.invalidateQueries({ queryKey: ["probable-lineups-all", rodada] });
      await qc.invalidateQueries({ queryKey: ["probable-lineup"] });
      setEditando(false);
    }
  };

  const sugestoes =
    editando && busca.trim().length >= 2
      ? elenco
          .filter((a) => a.apelido.toLowerCase().includes(busca.trim().toLowerCase()))
          .filter((a) => !draft.some((p) => p.id === a.atleta_id))
          .slice(0, 6)
      : [];

  return (
    <div className="mx-auto w-full max-w-[340px]">
      <div className="mb-1 flex items-center gap-2">
        <img src={escudo(clube, "30x30")} alt="" className="h-5 w-5 object-contain" />
        <span className="flex-1 font-condensed text-xs uppercase">
          {clube?.nome ?? ""} <span className="text-muted-foreground">· {mando}</span>
        </span>
        {isAdmin && !editando && (
          <button
            onClick={() => { setDraft(base); setEditando(true); }}
            className="brutal-sm bg-accent px-1.5 py-0.5 font-condensed text-[10px] uppercase"
          >
            Editar
          </button>
        )}
      </div>

      <div
        ref={campo}
        onPointerMove={mover}
        onPointerUp={() => (arrastando.current = null)}
        onPointerLeave={() => (arrastando.current = null)}
        className="relative aspect-[3/4] w-full overflow-hidden border-2 border-ink"
        style={{ backgroundImage: `url(${campinhoBg.url})`, backgroundSize: "100% 100%", touchAction: editando ? "none" : "auto" }}
      >
        {visiveis.map((p) => {
          const a = byId.get(p.id)!;
          const foto = playerPhoto(a);
          return (
            <div
              key={p.id}
              className="group absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${p.x}%`, top: `${p.y}%`, cursor: editando ? "grab" : "pointer" }}
              onPointerDown={(e) => {
                if (!editando) return;
                e.preventDefault();
                arrastando.current = p.id;
              }}
              onClick={() => !editando && onOpenPlayer(a)}
            >
              <span
                className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-[3px] bg-panel ${a.status_id === 2 ? "border-warning" : a.status_id === 7 ? "border-success" : "border-destructive"}`}
              >
                <img src={foto ?? escudo(clube, "45x45")} alt="" className={foto ? "h-full w-full object-cover" : "h-6 w-6 object-contain"} draggable={false} />
              </span>
              <span className="mt-0.5 max-w-full truncate bg-ink px-1 text-[9px] font-bold leading-tight text-panel">
                {subs?.[String(a.atleta_id)] ?? POS_ABREV[a.posicao_id]} {a.apelido}
              </span>
              {editando && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setDraft((d) => d.filter((x) => x.id !== p.id)); }}
                  className="absolute -right-0 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] text-destructive-foreground"
                  aria-label="Remover"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {!visiveis.length && (
          <p className="absolute inset-0 flex items-center justify-center p-4 text-center font-condensed text-xs uppercase text-panel">
            Sem prováveis
          </p>
        )}
      </div>

      {editando && (
        <div className="mt-2 space-y-1">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Adicionar jogador (2 letras)"
            style={{ fontSize: 16 }}
            className="w-full brutal-sm bg-panel-2 px-2 py-1 text-xs outline-none"
          />
          {sugestoes.map((a) => (
            <button
              key={a.atleta_id}
              onClick={() => {
                setDraft((d) => [...d, ...layout([a], subs)]);
                setBusca("");
              }}
              className="block w-full brutal-sm bg-panel px-2 py-1 text-left text-xs"
            >
              + {POS_ABREV[a.posicao_id]} {a.apelido} · {STATUS_NOME[a.status_id] ?? "—"}
            </button>
          ))}
          <div className="flex gap-2">
            <button
              onClick={() => void salvar()}
              disabled={salvando}
              className="flex-1 brutal-sm bg-primary px-2 py-1 font-condensed text-xs uppercase text-primary-foreground"
            >
              {salvando ? "Salvando…" : "Salvar →"}
            </button>
            <button onClick={() => setEditando(false)} className="brutal-sm bg-panel-2 px-2 py-1 font-condensed text-xs uppercase">
              Cancelar
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">Arraste as bolinhas para posicionar. O que você salvar é o que todos veem.</p>
        </div>
      )}

      <button
        onClick={() => setGaveta((v) => !v)}
        className="mt-2 w-full brutal-sm bg-panel-2 px-2 py-1 text-left font-condensed text-[11px] uppercase"
      >
        {gaveta ? "▾" : "▸"} Contundidos e suspensos ({desfalques.length})
      </button>
      {gaveta && (
        <div className="mt-1 flex flex-wrap gap-1">
          {desfalques.map((a) => (
            <button key={a.atleta_id} onClick={() => onOpenPlayer(a)} className="brutal-sm bg-panel px-1.5 py-0.5 text-[10px]">
              {POS_ABREV[a.posicao_id]} {a.apelido} · <span className="text-destructive">{STATUS_NOME[a.status_id]}</span>
            </button>
          ))}
          {!desfalques.length && <span className="text-[10px] text-muted-foreground">Nenhum desfalque.</span>}
        </div>
      )}
    </div>
  );
}
