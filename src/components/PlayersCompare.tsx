import { useMemo, useState } from "react";
import type { Atleta, Clube } from "@/lib/cartola-types";
import { POS_ABREV } from "@/lib/cartola-types";
import { escudo, fmt, playerPhoto } from "@/lib/cartola-ui";
import { SUB_NOME, useSubcategorias, type Sub } from "@/lib/subcategorias";

type Props = {
  favoritos: number[];
  atletas: Atleta[];
  clubes: Record<string, Clube>;
  onOpenPlayer: (a: Atleta) => void;
};

const LINHAS: Array<{ key: string; label: string; get: (a: Atleta) => number }> = [
  { key: "media", label: "Média", get: (a) => a.media_num ?? 0 },
  { key: "pontos", label: "Última pontuação", get: (a) => a.pontos_num ?? 0 },
  { key: "jogos", label: "Jogos", get: (a) => a.jogos_num ?? 0 },
  { key: "preco", label: "Preço (C$)", get: (a) => a.preco_num ?? 0 },
  { key: "variacao", label: "Variação", get: (a) => a.variacao_num ?? 0 },
];

const num = (v: number) => (Number.isInteger(v) ? String(v) : fmt(v, 2));

export function PlayersCompare({ favoritos, atletas, clubes, onOpenPlayer }: Props) {
  const { data: subs } = useSubcategorias();
  const [selecionados, setSelecionados] = useState<number[]>([]);

  const favs = useMemo(
    () => favoritos.map((id) => atletas.find((a) => a.atleta_id === id)).filter((a): a is Atleta => !!a),
    [favoritos, atletas],
  );

  const escolhidos = useMemo(
    () => favs.filter((a) => selecionados.includes(a.atleta_id)).slice(0, 5),
    [favs, selecionados],
  );

  const scoutKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of escolhidos) for (const k of Object.keys(a.scout ?? {})) set.add(k);
    return [...set].sort();
  }, [escolhidos]);

  const toggle = (id: number) =>
    setSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 5 ? prev : [...prev, id],
    );

  const porPosicao = useMemo(() => {
    const g: Record<number, Atleta[]> = {};
    for (const a of favs) (g[a.posicao_id] = g[a.posicao_id] ?? []).push(a);
    return g;
  }, [favs]);

  if (!favs.length)
    return (
      <p className="brutal p-4 text-center text-sm text-muted-foreground">
        Favorite jogadores na aba Atletas (★) para compará-los aqui.
      </p>
    );

  return (
    <div className="space-y-3">
      <div className="brutal p-3">
        <h3 className="font-display text-base">Favoritos ({favs.length}) — selecione até 5</h3>
        <div className="mt-2 space-y-2">
          {Object.entries(porPosicao).map(([pos, list]) => (
            <div key={pos}>
              <p className="font-condensed text-[11px] uppercase text-muted-foreground">{POS_ABREV[Number(pos)]}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {list.map((a) => {
                  const sub = subs?.[String(a.atleta_id)];
                  return (
                    <button
                      key={a.atleta_id}
                      onClick={() => toggle(a.atleta_id)}
                      className={`brutal-sm px-2 py-1 text-[11px] ${selecionados.includes(a.atleta_id) ? "bg-primary text-primary-foreground" : "bg-panel"}`}
                    >
                      {a.apelido}
                      {sub ? ` (${sub})` : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {escolhidos.length >= 2 ? (
        <div className="brutal overflow-x-auto p-3">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr>
                <th className="w-28 text-left" />
                {escolhidos.map((a) => (
                  <th key={a.atleta_id} className="px-1 pb-2 text-center align-bottom">
                    <button onClick={() => onOpenPlayer(a)} className="flex w-full flex-col items-center gap-1">
                      {playerPhoto(a) ? (
                        <img src={playerPhoto(a)!} alt={a.apelido} className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary font-display text-xs">
                          {a.apelido.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                      <img src={escudo(clubes[String(a.clube_id)], "30x30")} alt="" className="h-4 w-4 object-contain" />
                      <span className="font-condensed text-[11px] uppercase leading-tight">{a.apelido}</span>
                      <span className="text-[9px] text-muted-foreground">
                        {POS_ABREV[a.posicao_id]}
                        {subs?.[String(a.atleta_id)] ? ` · ${subs[String(a.atleta_id)]}` : ""}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...LINHAS.map((l) => ({ label: l.label, values: escolhidos.map(l.get) })),
                ...scoutKeys.map((k) => ({
                  label: k,
                  values: escolhidos.map((a) => a.scout?.[k] ?? 0),
                }))].map((linha) => {
                const max = Math.max(...linha.values);
                return (
                  <tr key={linha.label} className="border-t border-dashed border-border/50">
                    <td className="py-1 font-condensed text-[11px] uppercase text-muted-foreground">{linha.label}</td>
                    {linha.values.map((v, i) => (
                      <td
                        key={i}
                        className={`py-1 text-center ${v === max && max > 0 ? "font-bold text-success" : ""}`}
                      >
                        {num(v)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {escolhidos.some((a) => subs?.[String(a.atleta_id)]) && (
            <p className="mt-2 text-[10px] text-muted-foreground">
              Subcategorias:{" "}
              {escolhidos
                .map((a) => {
                  const s = subs?.[String(a.atleta_id)];
                  return s ? `${a.apelido} — ${SUB_NOME[s as Sub]}` : null;
                })
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
        </div>
      ) : (
        <p className="brutal p-4 text-center text-sm text-muted-foreground">Selecione pelo menos 2 favoritos.</p>
      )}
    </div>
  );
}
