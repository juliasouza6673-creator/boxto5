import { useMemo, useState } from "react";

import type { Atleta, Clube } from "@/lib/cartola-types";
import { POS_ABREV, POS_NOME, STATUS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, playerPhoto } from "@/lib/cartola-ui";
import { SUBS_POR_POSICAO, useSubcategorias } from "@/lib/subcategorias";

export type LinhaTabela = {
  jogos: number;
  mediaMando: number;
  gols: number;
  assistencias: number;
  desarmes: number;
  defesas: number;
  historico?: Array<{ rodada: number; pontuacao: number; scout: Record<string, number>; mando: "casa" | "fora" }>;
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

type Modo = "gerais" | "ataque" | "defesa";
type Col = { key: string; abrev: string; titulo: string };

const COLS_GERAIS: Col[] = [
  { key: "jogos", abrev: "J", titulo: "Jogos" },
  { key: "preco", abrev: "C$", titulo: "Preço" },
  { key: "variacao", abrev: "VAR", titulo: "Variação (C$)" },
  { key: "ultima", abrev: "ÚLT", titulo: "Última pontuação" },
  { key: "media", abrev: "MÉD", titulo: "Média geral" },
  { key: "mando", abrev: "MM", titulo: "Média no mando" },
  { key: "cedida", abrev: "MC", titulo: "Média cedida pelo adversário" },
  { key: "mpv", abrev: "MÍN", titulo: "Mínimo para valorizar" },
];
const COLS_ATAQUE: Col[] = [
  { key: "G", abrev: "G", titulo: "Gols" },
  { key: "A", abrev: "A", titulo: "Assistências" },
  { key: "FT", abrev: "FT", titulo: "Finalização na trave" },
  { key: "FD", abrev: "FD", titulo: "Finalização defendida" },
  { key: "FF", abrev: "FF", titulo: "Finalização para fora" },
  { key: "FS", abrev: "FS", titulo: "Faltas sofridas" },
  { key: "PP", abrev: "PP", titulo: "Pênalti perdido" },
  { key: "I", abrev: "I", titulo: "Impedimentos" },
  { key: "PS", abrev: "PS", titulo: "Pênalti sofrido" },
];
const COLS_DEFESA: Col[] = [
  { key: "SG", abrev: "SG", titulo: "Jogos sem sofrer gol (GOL/ZAG/LAT)" },
  { key: "DP", abrev: "DP", titulo: "Defesa de pênalti (GOL)" },
  { key: "DE", abrev: "DE", titulo: "Defesas (GOL)" },
  { key: "DS", abrev: "DS", titulo: "Desarmes" },
  { key: "GC", abrev: "GC", titulo: "Gol contra" },
  { key: "CV", abrev: "CV", titulo: "Cartão vermelho" },
  { key: "CA", abrev: "CA", titulo: "Cartão amarelo" },
  { key: "GS", abrev: "GS", titulo: "Gols sofridos (GOL)" },
  { key: "FC", abrev: "FC", titulo: "Faltas cometidas" },
  { key: "PC", abrev: "PC", titulo: "Pênalti cometido" },
];
const SO_GOL = ["DP", "DE", "GS"];
const SG_POS = [1, 2, 3];

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
  const [statusSel, setStatusSel] = useState<number[]>([7]);
  const [clubeSel, setClubeSel] = useState<number[]>([]);
  const [mandoSel, setMandoSel] = useState<"geral" | "casa" | "fora">("geral");
  const [janela, setJanela] = useState(0); // 0 = temporada inteira; 5/10 = últimos N jogos no mando
  const [minJogos, setMinJogos] = useState(0);
  const [modos, setModos] = useState<Modo[]>(["gerais"]);
  const [soFav, setSoFav] = useState(false);
  const [ordem, setOrdem] = useState<{ col: string; dir: "desc" | "asc" }>({ col: "jogos", dir: "desc" });

  const todasSubs = useMemo(() => ["GOL", ...Object.values(SUBS_POR_POSICAO).flat()], []);
  const listaClubes = useMemo(
    () => Object.values(clubes).filter((c) => c.escudos).sort((a, b) => a.nome.localeCompare(b.nome)),
    [clubes],
  );
  const maxJogos = useMemo(() => Math.max(1, ...atletas.map((a) => a.jogos_num ?? 0)), [atletas]);

  const colunas = useMemo(
    () => [
      ...(modos.includes("gerais") ? COLS_GERAIS : []),
      ...(modos.includes("ataque") ? COLS_ATAQUE : []),
      ...(modos.includes("defesa") ? COLS_DEFESA : []),
    ],
    [modos],
  );

  const toggle = <T,>(arr: T[], v: T, set: (n: T[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const subDe = (a: Atleta) => (a.posicao_id === 1 ? "GOL" : (subs?.[String(a.atleta_id)] ?? "—"));

  /** Jogos da janela selecionada (respeita o mando escolhido). */
  const jogosJanela = (a: Atleta) => {
    if (!janela) return null;
    const h = linhas[String(a.atleta_id)]?.historico ?? [];
    const filtrados = mandoSel === "geral" ? h : h.filter((g) => g.mando === mandoSel);
    return filtrados.slice(0, janela);
  };

  const scoutsJanela = (a: Atleta): Record<string, number> => {
    const jogos = jogosJanela(a) ?? [];
    const acc: Record<string, number> = {};
    for (const j of jogos) {
      for (const [k, v] of Object.entries(j.scout ?? {})) acc[k] = (acc[k] ?? 0) + v;
    }
    return acc;
  };

  const valor = (a: Atleta, col: string): number | null => {
    const l = linhas[String(a.atleta_id)];
    const sc = janela ? scoutsJanela(a) : (a.scout ?? {});
    switch (col) {
      case "jogos":
        return janela ? (jogosJanela(a)?.length ?? 0) : (a.jogos_num ?? 0);
      case "preco":
        return a.preco_num;
      case "variacao":
        return a.variacao_num;
      case "ultima":
        return a.pontos_num;
      case "media": {
        if (!janela) return a.media_num;
        const jogos = jogosJanela(a) ?? [];
        return jogos.length ? jogos.reduce((s, g) => s + g.pontuacao, 0) / jogos.length : null;
      }
      case "mando":
        return l ? l.mediaMando : null;
      case "cedida": {
        const adv = adversario[String(a.clube_id)];
        return adv !== undefined ? (cedidas[`${adv}-${subDe(a)}`]?.mediaCedida ?? null) : null;
      }
      case "mpv":
        return a.minimo_para_valorizar ?? null;
      case "SG":
        return SG_POS.includes(a.posicao_id) ? (sc['SG'] ?? 0) : 0;
      default:
        if (SO_GOL.includes(col) && a.posicao_id !== 1) return null;
        return sc[col] ?? 0;
    }
  };

  const dados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return atletas
      .filter((a) => a.posicao_id !== 6)
      .filter((a) => (posSel.length ? posSel.includes(a.posicao_id) : true))
      .filter((a) => (subSel.length ? subSel.includes(subDe(a)) : true))
      .filter((a) => (statusSel.length ? statusSel.includes(a.status_id) : true))
      .filter((a) => (clubeSel.length ? clubeSel.includes(a.clube_id) : true))
      .filter((a) => (mandoSel === "geral" ? true : mando[String(a.clube_id)] === mandoSel))
      .filter((a) => (a.jogos_num ?? 0) >= minJogos)
      .filter((a) => (soFav ? favoritos.includes(a.atleta_id) : true))
      .filter((a) => (q ? a.apelido.toLowerCase().includes(q) : true))
      .sort((a, b) => {
        if (ordem.col === "nome") {
          const c = a.apelido.localeCompare(b.apelido);
          return ordem.dir === "desc" ? -c : c;
        }
        const va = valor(a, ordem.col) ?? -999;
        const vb = valor(b, ordem.col) ?? -999;
        return ordem.dir === "desc" ? vb - va : va - vb;
      })
      .slice(0, 200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atletas, posSel, subSel, statusSel, clubeSel, mandoSel, janela, minJogos, soFav, favoritos, busca, ordem, linhas, cedidas, adversario, subs, mando]);

  const ordenar = (col: string) =>
    setOrdem((o) => (o.col === col ? { col, dir: o.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }));

  const chip = (ativo: boolean) =>
    `brutal-sm px-2 py-0.5 font-condensed text-[11px] uppercase ${ativo ? "bg-primary text-primary-foreground" : "bg-panel"}`;

  const confronto = (a: Atleta) => {
    const adv = adversario[String(a.clube_id)];
    const m = mando[String(a.clube_id)];
    const eu = clubes[String(a.clube_id)]?.abreviacao ?? "";
    const ele = adv !== undefined ? (clubes[String(adv)]?.abreviacao ?? "") : "";
    if (!ele) return "";
    return m === "casa" ? `${eu} x ${ele}` : `${ele} x ${eu}`;
  };

  return (
    <div className="space-y-3">
      <div className="brutal grid gap-3 p-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome"
              style={{ fontSize: 16 }}
              className="min-w-[160px] flex-1 brutal-sm bg-panel-2 px-2 py-1 outline-none"
            />
            <button onClick={() => setSoFav((v) => !v)} className={chip(soFav)}>
              ★ Favoritos
            </button>
          </div>
          <div>
            <p className="font-condensed text-[10px] uppercase text-muted-foreground">Status</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {STATUS_FILTROS.map((s) => (
                <button key={s.id} onClick={() => toggle(statusSel, s.id, setStatusSel)} className={chip(statusSel.includes(s.id))}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-condensed text-[10px] uppercase text-muted-foreground">Mando</p>
            <div className="mt-1 flex gap-1.5">
              {(["geral", "casa", "fora"] as const).map((m) => (
                <button key={m} onClick={() => setMandoSel(m)} className={chip(mandoSel === m)}>
                  {m === "geral" ? "Geral" : m === "casa" ? "Em casa" : "Fora"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-condensed text-[10px] uppercase text-muted-foreground">
              Últimos jogos {mandoSel !== "geral" ? `(${mandoSel === "casa" ? "em casa" : "fora"})` : ""}
            </p>
            <div className="mt-1 flex gap-1.5">
              {([0, 5, 10] as const).map((n) => (
                <button key={n} onClick={() => setJanela(n)} className={chip(janela === n)}>
                  {n === 0 ? "Temporada" : `Últimos ${n}`}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="font-condensed text-[10px] uppercase text-muted-foreground">
              Mínimo de jogos
              <select
                value={minJogos}
                onChange={(e) => setMinJogos(Number(e.target.value))}
                className="ml-1 block brutal-sm bg-panel px-1 py-0.5 text-xs text-foreground"
              >
                {Array.from({ length: maxJogos + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? "Todos" : `${i}+`}
                  </option>
                ))}
              </select>
            </label>
            <label className="font-condensed text-[10px] uppercase text-muted-foreground">
              Times
              <select
                value=""
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v === -1) setClubeSel([]);
                  else if (v) toggle(clubeSel, v, setClubeSel);
                }}
                className="ml-1 block brutal-sm bg-panel px-1 py-0.5 text-xs text-foreground"
              >
                <option value="">{clubeSel.length ? `${clubeSel.length} selecionado(s)` : "Todos os times"}</option>
                <option value={-1}>Todos os times</option>
                {listaClubes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clubeSel.includes(c.id) ? "✓ " : ""}
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {clubeSel.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {clubeSel.map((id) => (
                <button key={id} onClick={() => toggle(clubeSel, id, setClubeSel)} className="brutal-sm flex items-center gap-1 bg-panel px-1 py-0.5 text-[10px]">
                  <img src={escudo(clubes[String(id)], "30x30")} alt="" className="h-4 w-4" /> ✕
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div>
            <p className="font-condensed text-[10px] uppercase text-muted-foreground">Posição</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5].map((p) => (
                <button key={p} onClick={() => toggle(posSel, p, setPosSel)} className={chip(posSel.includes(p))}>
                  {POS_NOME[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-condensed text-[10px] uppercase text-muted-foreground">Subcategoria</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {todasSubs.map((s) => (
                <button key={s} onClick={() => toggle(subSel, s, setSubSel)} className={chip(subSel.includes(s))}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="font-condensed text-[10px] uppercase text-muted-foreground">Dados exibidos (marque um ou mais)</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(
                [
                  ["gerais", "Dados gerais"],
                  ["ataque", "Scouts de ataque"],
                  ["defesa", "Scouts de defesa"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => {
                    const n = modos.includes(m) ? modos.filter((x) => x !== m) : [...modos, m];
                    setModos(n.length ? n : [m]);
                  }}
                  className={chip(modos.includes(m))}
                >
                  {modos.includes(m) ? "✓ " : ""}
                  {label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              setPosSel([]);
              setSubSel([]);
              setStatusSel([7]);
              setClubeSel([]);
              setMandoSel("geral");
              setJanela(0);
              setMinJogos(0);
            }}
            className="brutal-sm bg-destructive px-2 py-0.5 font-condensed text-[11px] uppercase text-destructive-foreground"
          >
            Limpar filtros
          </button>
        </div>
      </div>

      {carregando && (
        <p className="font-condensed text-[11px] uppercase text-muted-foreground">Calculando médias no mando e cedimentos…</p>
      )}

      <div className="brutal overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b-2 border-border bg-panel-2">
              <th className="px-1 py-2" />
              <th className="min-w-[230px] px-2 py-2 text-left">
                <button onClick={() => ordenar("nome")} className="font-condensed uppercase">
                  Jogador{ordem.col === "nome" ? (ordem.dir === "desc" ? " ↓" : " ↑") : ""}
                </button>
              </th>
              {colunas.map((c) => (
                <th key={c.key} className="px-1.5 py-2 text-center">
                  <button
                    onClick={() => ordenar(c.key)}
                    title={c.titulo}
                    className={`font-condensed uppercase ${ordem.col === c.key ? "text-primary" : ""}`}
                  >
                    {c.abrev}
                    {ordem.col === c.key ? (ordem.dir === "desc" ? "↓" : "↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.map((a) => {
              const clube = clubes[String(a.clube_id)];
              const foto = playerPhoto(a);
              return (
                <tr key={a.atleta_id} className="border-b border-dashed border-border/50">
                  <td className="px-1 py-1.5">
                    <button
                      onClick={() => onToggleFavorito(a.atleta_id)}
                      title="Favoritar e comparar"
                      className={`text-lg leading-none ${favoritos.includes(a.atleta_id) ? "text-accent" : "text-muted-foreground"}`}
                    >
                      ★
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <button onClick={() => onOpenPlayer(a)} className="flex items-center gap-2 text-left">
                      <span className="relative shrink-0">
                        {foto ? (
                          <img src={foto} alt="" className="h-10 w-10 rounded-full border-2 border-foreground object-cover" />
                        ) : (
                          <img src={escudo(clube, "45x45")} alt="" className="h-10 w-10 object-contain" />
                        )}
                        {foto && (
                          <img src={escudo(clube, "30x30")} alt="" className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-sm font-bold">
                          [{POS_ABREV[a.posicao_id]}] {a.apelido}
                          <span
                            className={`font-condensed text-[9px] uppercase ${a.status_id === 7 ? "text-success" : a.status_id === 2 ? "text-warning" : "text-muted-foreground"}`}
                          >
                            {STATUS_NOME[a.status_id] ?? ""}
                          </span>
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {clube?.abreviacao} · {subDe(a)} {confronto(a) && `· ${confronto(a)}`}
                        </span>
                      </span>
                    </button>
                  </td>
                  {colunas.map((c) => {
                    const v = valor(a, c.key);
                    const dec = ["preco", "variacao", "ultima", "media", "mando", "cedida", "mpv"].includes(c.key);
                    const cls =
                      c.key === "variacao" && v !== null
                        ? v > 0
                          ? "text-success"
                          : v < 0
                            ? "text-destructive"
                            : ""
                        : c.key === "cedida"
                          ? "font-bold text-primary"
                          : "";
                    return (
                      <td key={c.key} className={`px-1.5 py-1.5 text-center tabular-nums ${cls}`}>
                        {v === null ? "-" : dec ? fmt(v, c.key === "preco" ? 2 : 1) : v}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!dados.length && <p className="p-4 text-center text-sm text-muted-foreground">Nenhum jogador encontrado.</p>}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Toque no cabeçalho para ordenar; passe o mouse para ver o nome completo da coluna.{" "}
        {janela
          ? `Scouts e média refletem os últimos ${janela} jogos${mandoSel === "geral" ? "" : mandoSel === "casa" ? " em casa" : " fora"}.`
          : "Scouts somam a temporada."}
      </p>
    </div>
  );
}
