import { useMemo, useState } from "react";

import type { Atleta, Clube } from "@/lib/cartola-types";
import { POS_ABREV, POS_NOME, STATUS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, playerPhoto } from "@/lib/cartola-ui";
import { SUBS_POR_POSICAO, useSubcategorias, type Sub } from "@/lib/subcategorias";

export type LinhaTabela = {
  jogos: number;
  mediaMando: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
};

type Props = {
  atletas: Atleta[];
  clubes: Record<string, Clube>;
  favoritos: number[];
  onToggleFavorito: (id: number) => void;
  onOpenPlayer: (a: Atleta) => void;
  linhas: Record<string, LinhaTabela>;
  cedidas: Record<string, { mediaCedida: number; amostra: number; usouFallback: boolean }>;
  adversario: Record<string, number>;
  mando: Record<string, "casa" | "fora">;
  carregando?: boolean;
};

type ColKey = "sub" | "nome" | "jogos" | "media" | "cedida" | "mando" | "G" | "A" | "DS" | "DE";

const COLUNAS: Array<{ key: ColKey; abrev: string; titulo: string; numerica: boolean }> = [
  { key: "sub", abrev: "SUB", titulo: "Subcategoria", numerica: false },
  { key: "nome", abrev: "Jogador", titulo: "Nome do jogador", numerica: false },
  { key: "jogos", abrev: "J", titulo: "Jogos", numerica: true },
  { key: "media", abrev: "M", titulo: "Média geral", numerica: true },
  { key: "cedida", abrev: "MC", titulo: "Média cedida pelo adversário no mando que vai jogar", numerica: true },
  { key: "mando", abrev: "MM", titulo: "Média do jogador no mando", numerica: true },
  { key: "G", abrev: "G", titulo: "Gols (últimos 5 no mando)", numerica: true },
  { key: "A", abrev: "A", titulo: "Assistências (últimos 5 no mando)", numerica: true },
  { key: "DS", abrev: "DS", titulo: "Desarmes (últimos 5 no mando)", numerica: true },
  { key: "DE", abrev: "DE", titulo: "Defesas — goleiros (últimos 5 no mando)", numerica: true },
];

const STATUS_FILTROS = [
  { id: 7, label: "Provável" },
  { id: 2, label: "Dúvida" },
  { id: 5, label: "Nulo" },
  { id: 6, label: "Contundido" },
  { id: 3, label: "Suspenso" },
];

export function PlayersTable({
  atletas,
  clubes,
  favoritos,
  onToggleFavorito,
  onOpenPlayer,
  linhas,
  cedidas,
  adversario,
  mando,
  carregando,
}: Props) {
  const { data: subs } = useSubcategorias();
  const [busca, setBusca] = useState("");
  const [posSel, setPosSel] = useState<number[]>([]);
  const [subSel, setSubSel] = useState<string[]>([]);
  const [statusSel, setStatusSel] = useState<number[]>([]);
  const [soFav, setSoFav] = useState(false);
  const [ordem, setOrdem] = useState<{ col: ColKey; dir: "desc" | "asc" }>({ col: "media", dir: "desc" });

  const todasSubs = useMemo(() => ["GOL", ...Object.values(SUBS_POR_POSICAO).flat()], []);

  const toggle = <T,>(arr: T[], v: T, set: (n: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const dados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const valor = (a: Atleta, col: ColKey): number | string => {
      const l = linhas[String(a.atleta_id)];
      const sub = a.posicao_id === 1 ? "GOL" : (subs?.[String(a.atleta_id)] ?? "");
      const adv = adversario[String(a.clube_id)];
      const ced = adv !== undefined && sub ? cedidas[`${adv}-${sub}`]?.mediaCedida : undefined;
      switch (col) {
        case "sub":
          return sub;
        case "nome":
          return a.apelido.toLowerCase();
        case "jogos":
          return a.jogos_num ?? 0;
        case "media":
          return a.media_num ?? 0;
        case "cedida":
          return ced ?? -1;
        case "mando":
          return l?.mediaMando ?? -1;
        case "G":
          return l?.gols ?? 0;
        case "A":
          return l?.assistencias ?? 0;
        case "DS":
          return l?.desarmes ?? 0;
        case "DE":
          return l?.defesas ?? 0;
      }
    };
    return atletas
      .filter((a) => (posSel.length ? posSel.includes(a.posicao_id) : true))
      .filter((a) =>
        subSel.length
          ? subSel.includes(a.posicao_id === 1 ? "GOL" : (subs?.[String(a.atleta_id)] ?? "—"))
          : true,
      )
      .filter((a) => (statusSel.length ? statusSel.includes(a.status_id) : true))
      .filter((a) => (soFav ? favoritos.includes(a.atleta_id) : true))
      .filter((a) => (q ? a.apelido.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        const va = valor(a, ordem.col);
        const vb = valor(b, ordem.col);
        const cmp = typeof va === "string" || typeof vb === "string"
          ? String(va).localeCompare(String(vb))
          : (va as number) - (vb as number);
        return ordem.dir === "desc" ? -cmp : cmp;
      })
      .slice(0, 200);
  }, [atletas, posSel, subSel, statusSel, soFav, favoritos, busca, ordem, linhas, cedidas, adversario, subs]);

  const ordenar = (col: ColKey) =>
    setOrdem((o) => (o.col === col ? { col, dir: o.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }));

  return (
    <div className="space-y-3">
      <div className="brutal p-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome"
            style={{ fontSize: 16 }}
            className="min-w-[180px] flex-1 brutal-sm bg-panel-2 px-2 py-1 outline-none"
          />
          <button
            onClick={() => setSoFav((v) => !v)}
            className={`brutal-sm px-2 py-1 font-condensed text-xs uppercase ${soFav ? "bg-accent" : "bg-panel"}`}
          >
            ★ Favoritos
          </button>
        </div>

        <p className="mt-2 font-condensed text-[10px] uppercase text-muted-foreground">Posição</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5, 6].map((p) => (
            <button
              key={p}
              onClick={() => toggle(posSel, p, setPosSel)}
              className={`brutal-sm px-2 py-0.5 font-condensed text-[11px] uppercase ${posSel.includes(p) ? "bg-primary text-primary-foreground" : "bg-panel"}`}
            >
              {POS_NOME[p]}
            </button>
          ))}
        </div>

        <p className="mt-2 font-condensed text-[10px] uppercase text-muted-foreground">Subcategoria</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {todasSubs.map((s) => (
            <button
              key={s}
              onClick={() => toggle(subSel, s, setSubSel)}
              className={`brutal-sm px-2 py-0.5 font-condensed text-[11px] uppercase ${subSel.includes(s) ? "bg-primary text-primary-foreground" : "bg-panel"}`}
            >
              {s}
            </button>
          ))}
        </div>

        <p className="mt-2 font-condensed text-[10px] uppercase text-muted-foreground">Status</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {STATUS_FILTROS.map((s) => (
            <button
              key={s.id}
              onClick={() => toggle(statusSel, s.id, setStatusSel)}
              className={`brutal-sm px-2 py-0.5 font-condensed text-[11px] uppercase ${statusSel.includes(s.id) ? "bg-primary text-primary-foreground" : "bg-panel"}`}
            >
              {s.label}
            </button>
          ))}
          {(posSel.length || subSel.length || statusSel.length) > 0 && (
            <button
              onClick={() => {
                setPosSel([]);
                setSubSel([]);
                setStatusSel([]);
              }}
              className="brutal-sm bg-destructive px-2 py-0.5 font-condensed text-[11px] uppercase text-destructive-foreground"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {carregando && (
        <p className="font-condensed text-[11px] uppercase text-muted-foreground">
          Calculando médias no mando e cedimentos…
        </p>
      )}

      <div className="brutal overflow-x-auto">
        <table className="w-full min-w-[720px] text-[11px]">
          <thead>
            <tr className="border-b-2 border-border bg-panel-2">
              <th className="px-1 py-2" />
              <th className="px-1 py-2 text-left font-condensed uppercase">Time</th>
              {COLUNAS.map((c) => (
                <th key={c.key} className={`px-1 py-2 ${c.numerica ? "text-right" : "text-left"}`}>
                  <button
                    onClick={() => ordenar(c.key)}
                    title={c.titulo}
                    className={`font-condensed uppercase ${ordem.col === c.key ? "text-primary" : ""}`}
                  >
                    {c.abrev}
                    {ordem.col === c.key ? (ordem.dir === "desc" ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map((a) => {
              const l = linhas[String(a.atleta_id)];
              const sub = a.posicao_id === 1 ? "GOL" : (subs?.[String(a.atleta_id)] ?? "—");
              const adv = adversario[String(a.clube_id)];
              const ced = adv !== undefined ? cedidas[`${adv}-${sub}`]?.mediaCedida : undefined;
              return (
                <tr key={a.atleta_id} className="border-b border-dashed border-border/50">
                  <td className="px-1 py-1">
                    <button
                      onClick={() => onToggleFavorito(a.atleta_id)}
                      title="Favoritar e comparar"
                      className={`text-base leading-none ${favoritos.includes(a.atleta_id) ? "text-accent" : "text-muted-foreground"}`}
                    >
                      ★
                    </button>
                  </td>
                  <td className="px-1 py-1">
                    <img
                      src={escudo(clubes[String(a.clube_id)], "30x30")}
                      alt={clubes[String(a.clube_id)]?.abreviacao ?? ""}
                      title={clubes[String(a.clube_id)]?.nome ?? ""}
                      className="h-5 w-5 object-contain"
                    />
                  </td>
                  <td className="px-1 py-1 font-condensed uppercase">{sub}</td>
                  <td className="px-1 py-1">
                    <button onClick={() => onOpenPlayer(a)} className="flex items-center gap-1.5 text-left">
                      {playerPhoto(a) ? (
                        <img src={playerPhoto(a)!} alt="" className="h-6 w-6 rounded-full object-cover" />
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-secondary" />
                      )}
                      <span className="font-bold">{a.apelido}</span>
                      <span
                        className={`font-condensed text-[9px] uppercase ${a.status_id === 7 ? "text-success" : a.status_id === 2 ? "text-warning" : "text-muted-foreground"}`}
                      >
                        {STATUS_NOME[a.status_id] ?? ""}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {mando[String(a.clube_id)] === "casa" ? "casa" : mando[String(a.clube_id)] === "fora" ? "fora" : ""}
                      </span>
                    </button>
                  </td>
                  <td className="px-1 py-1 text-right">{a.jogos_num ?? 0}</td>
                  <td className="px-1 py-1 text-right">{fmt(a.media_num, 1)}</td>
                  <td className="px-1 py-1 text-right font-bold text-primary">{ced === undefined ? "-" : fmt(ced, 1)}</td>
                  <td className="px-1 py-1 text-right">{l ? fmt(l.mediaMando, 1) : "-"}</td>
                  <td className="px-1 py-1 text-right">{l?.gols ?? 0}</td>
                  <td className="px-1 py-1 text-right">{l?.assistencias ?? 0}</td>
                  <td className="px-1 py-1 text-right">{l?.desarmes ?? 0}</td>
                  <td className="px-1 py-1 text-right">{a.posicao_id === 1 ? (l?.defesas ?? 0) : "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!dados.length && <p className="p-4 text-center text-sm text-muted-foreground">Nenhum jogador encontrado.</p>}
      </div>
      <p className="text-[10px] text-muted-foreground">
        MC = média cedida pelo adversário à subcategoria · MM = média do jogador no mando · G/A/DS/DE somados nos
        últimos 5 jogos no mando. Toque no cabeçalho para ordenar; passe o mouse para ver o nome completo da coluna.
        {" "}Posições: {POS_ABREV[1]}, {POS_ABREV[2]}, {POS_ABREV[3]}, {POS_ABREV[4]}, {POS_ABREV[5]}, {POS_ABREV[6]}.
      </p>
    </div>
  );
}
