import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlayerAnalysis } from "@/lib/cartola.functions";
import type { Atleta, Clube, Scout } from "@/lib/cartola-types";
import { POS_NOME, STATUS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, isScoutNegative, playerPhoto, statusBorderClass } from "@/lib/cartola-ui";
import { ScoreChart } from "@/components/ScoreChart";
import { computeMNO } from "@/lib/mno";

type Analysis = Awaited<ReturnType<typeof getPlayerAnalysis>>;

function ScoutLine({ scout }: { scout: Scout | null | undefined }) {
  const entries = Object.entries(scout ?? {}).filter(([, v]) => v > 0);
  if (!entries.length) return <p className="text-center text-xs text-muted-foreground">sem scouts</p>;
  return (
    <p className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-center text-xs font-semibold">
      {entries.map(([k, v], i) => (
        <span key={k} className={isScoutNegative(k) ? "text-destructive" : "text-success"}>
          {k} {v}
          {i < entries.length - 1 ? "," : ""}
        </span>
      ))}
    </p>
  );
}


type FormData = {
  jogos: Array<{ rodada: number; adversario: number; golsPro: number; golsContra: number; resultado: "V" | "E" | "D" }>;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsSofridos: number;
  golsFeitos: number;
  sgMantidos: number;
  sgCedidos: number;
};

function TeamFormBox({
  titulo,
  form,
  clubes,
}: {
  titulo: string;
  form: FormData;
  clubes: Record<string, Clube>;
}) {
  if (!form?.jogos?.length)
    return <p className="text-center text-xs text-muted-foreground">Sem retrospecto nesse mando.</p>;
  return (
    <div className="rounded-lg border border-border bg-panel-2 p-2 text-center">
      <p className="mb-1 font-display text-xs tracking-wide text-muted-foreground">{titulo}</p>
      <p className="mb-1 text-[11px]">
        <span className="text-success">{form.vitorias}V</span> · {form.empates}E ·{" "}
        <span className="text-destructive">{form.derrotas}D</span> · {form.golsFeitos} gols feitos ·{" "}
        {form.golsSofridos} sofridos · <span className="text-success">{form.sgMantidos} SGs</span>
      </p>
      <div className="flex flex-wrap justify-center gap-1">
        {form.jogos.map((g) => (
          <span
            key={g.rodada}
            className={`flex items-center gap-1 rounded border px-1 py-0.5 text-[10px] ${g.resultado === "V" ? "border-success text-success" : g.resultado === "E" ? "border-border text-muted-foreground" : "border-destructive text-destructive"}`}
          >
            R{g.rodada}
            <img src={escudo(clubes[String(g.adversario)], "30x30")} alt="" className="h-3.5 w-3.5 object-contain" />
            {g.golsPro}x{g.golsContra}
          </span>
        ))}
      </div>
    </div>
  );
}

function useAnalysis(a: Atleta | null) {
  const fn = useServerFn(getPlayerAnalysis);
  return useQuery({
    queryKey: ["analysis", a?.atleta_id],
    enabled: !!a,
    staleTime: 10 * 60_000,
    queryFn: () =>
      fn({ data: { atletaId: a!.atleta_id, clubeId: a!.clube_id, posicaoId: a!.posicao_id } }),
  });
}

function Metrics({
  atleta,
  analysis,
  clubes,
}: {
  atleta: Atleta;
  analysis: Analysis | undefined;
  clubes: Record<string, Clube>;
}) {
  const ok = analysis?.ok && !analysis.semJogo ? analysis : null;
  const rows: Array<[string, string]> = [
    ["Preço", `C$ ${fmt(atleta.preco_num, 2)}`],
    ["Média geral", fmt(atleta.media_num, 2)],
    ["Última pontuação", fmt(atleta.pontos_num, 2)],
    ["Jogos", String(atleta.jogos_num)],
    [
      atleta.posicao_id === 1 ? "Defesas" : "Desarmes",
      String((atleta.scout?.[atleta.posicao_id === 1 ? "DE" : "DS"] ?? 0)),
    ],
    [
      atleta.variacao_num >= 0 ? "Valorização" : "Desvalorização",
      fmt(Math.abs(atleta.variacao_num), 2),
    ],
    ["Média no mando", ok ? fmt(ok.mediaMando, 2) : "-"],
    ["Média cedida", ok ? fmt(ok.cedimentos.mediaCedida, 2) : "-"],
    ["Média básica cedida", ok ? fmt(ok.cedimentos.mediaBasicaCedida, 2) : "-"],
    ["Assistências cedidas", ok ? String(ok.cedimentos.assistenciasCedidas) : "-"],
    ["Gols cedidos", ok ? String(ok.cedimentos.golsCedidos) : "-"],
    ["Pontuação esperada", ok ? fmt(ok.pontuacaoEsperada, 2) : "-"],
  ];
  const adv = ok ? clubes[String(ok.adversario)] : undefined;
  return (
    <div>
      {ok && (
        <p className="mb-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          {ok.mando === "casa" ? "Em casa contra" : "Fora contra"}
          <img src={escudo(adv, "30x30")} alt={adv?.nome ?? ""} className="h-5 w-5 object-contain" />
          {adv?.abreviacao}
        </p>
      )}
      <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between px-3 py-1.5 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-display tracking-wide">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type Props = {
  atleta: Atleta;
  atletas: Atleta[];
  clubes: Record<string, Clube>;
  onOpenPlayer?: ((a: Atleta) => void) | undefined;
  onSell?: (() => void) | undefined;
  onClose: () => void;
};

function Foto({ a, size = "h-14 w-14" }: { a: Atleta; size?: string }) {
  const src = playerPhoto(a);
  return src ? (
    <img src={src} alt={a.apelido} className={`${size} rounded-full border-2 object-cover ${statusBorderClass(a.status_id)}`} />
  ) : (
    <span className={`${size} flex items-center justify-center rounded-full bg-secondary font-display`}>
      {a.apelido.slice(0, 2).toUpperCase()}
    </span>
  );
}

export function PlayerModal({ atleta, atletas, clubes, onOpenPlayer, onSell, onClose }: Props) {
  const [tab, setTab] = useState<"geral" | "cedimentos">("geral");
  const [showAll, setShowAll] = useState(false);
  const [busca, setBusca] = useState("");
  const [compareId, setCompareId] = useState<number | null>(null);
  const [comparing, setComparing] = useState(false);
  const { data: analysis, isLoading } = useAnalysis(atleta);
  const outro = atletas.find((a) => a.atleta_id === compareId) ?? null;
  const { data: analysisB } = useAnalysis(outro);

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const ok = analysis?.ok && !analysis.semJogo ? analysis : null;
  const clube = clubes[String(atleta.clube_id)];
  const adversario = ok ? clubes[String(ok.adversario)] : undefined;

  const enfrenta = useMemo(() => {
    if (!ok) return [];
    return atletas
      .filter((a) => a.clube_id === ok.adversario)
      .filter((a) => ok.enfrentaPosicoes.includes(a.posicao_id))
      .filter((a) => a.status_id === 7 || a.status_id === 2)
      .sort((a, b) => b.media_num - a.media_num)
      .slice(0, 5);
  }, [atletas, ok]);

  const recomendado = ok ? ok.cedimentos.mediaCedida >= Math.max(2, ok.mediaMando * 0.8) : false;

  const mno = useMemo(() => {
    const rodada = analysis?.ok && "rodada" in analysis ? (analysis.rodada ?? 1) : 1;
    const ultimoReal = ok?.ultimasRodadas.find((r) => r.pontuacao !== null)?.pontuacao ?? atleta.pontos_num;
    return computeMNO({
      rodada,
      preco_atual: atleta.preco_num,
      pontos_ultima: atleta.pontos_num,
      jogou_ultima: atleta.pontos_num !== 0,
      pontos_ultimo_jogo_real: ultimoReal,
      jogos_disputados: atleta.jogos_num,
    });
  }, [analysis, ok, atleta]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/85 p-3 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-border p-4">
          {playerPhoto(atleta) ? (
            <img
              src={playerPhoto(atleta)!}
              alt={atleta.apelido}
              className={`h-14 w-14 rounded-full border-2 object-cover ${statusBorderClass(atleta.status_id)}`}
            />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-secondary font-display">
              {atleta.apelido.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="flex flex-wrap items-baseline gap-2 font-display text-xl leading-tight tracking-wide">
              {atleta.apelido}
              <span className="rounded bg-black px-1.5 py-0.5 text-xs font-bold text-white">
                C$ {fmt(atleta.preco_num, 2)}
              </span>
            </h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <img src={escudo(clube, "30x30")} alt="" className="h-4 w-4 object-contain" />
              {clube?.abreviacao} · {POS_NOME[atleta.posicao_id]} · {STATUS_NOME[atleta.status_id]}
            </p>
            <div className="mt-1">
              <ScoutLine scout={atleta.scout} />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              ✕
            </button>
            {onSell && (
              <button
                onClick={onSell}
                className="rounded-lg border border-destructive px-2 py-1 text-xs font-semibold text-destructive"
              >
                Vender
              </button>
            )}
          </div>
        </header>

        <nav className="flex border-b border-border">
          {(["geral", "cedimentos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 font-display text-sm tracking-wide ${tab === t ? "border-b-2 border-accent text-accent" : "text-muted-foreground"}`}
            >
              {t === "geral" ? "Geral" : "Cedimentos para o Jogador"}
            </button>
          ))}
        </nav>

        <div className="overflow-y-auto p-4 text-sm">
          {isLoading && <p className="py-6 text-center text-muted-foreground">Cruzando dados da rodada…</p>}

          {tab === "geral" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border-2 border-accent bg-panel-2 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Média geral</p>
                  <p className="font-display text-lg tracking-wide">{fmt(atleta.media_num, 2)}</p>
                </div>
                {[
                  ["Última pontuação", fmt(atleta.pontos_num, 2)],
                  ["Jogos", String(atleta.jogos_num)],
                  [
                    atleta.posicao_id === 1 ? "Defesas" : "Desarmes",
                    String(atleta.scout?.[atleta.posicao_id === 1 ? "DE" : "DS"] ?? 0),
                  ],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{k}</p>
                    <p className="font-display text-lg tracking-wide">{v}</p>
                  </div>
                ))}
                <div className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">
                    {atleta.variacao_num >= 0 ? "Última valorização" : "Última desvalorização"}
                  </p>
                  <p
                    className={`font-display text-lg tracking-wide ${atleta.variacao_num >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {atleta.variacao_num >= 0 ? "+" : "-"}
                    {fmt(Math.abs(atleta.variacao_num), 2)}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Minutagem média</p>
                  <p className="font-display text-lg tracking-wide">
                    {ok ? `${ok.minutagem.minutosEstimados}'` : "-"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {ok?.minutagem.ultimoJogo
                      ? `último jogo: R${ok.minutagem.ultimoJogo.rodada}${ok.minutagem.ultimoJogo.minutos ? ` · ${ok.minutagem.ultimoJogo.minutos}'` : " · minutos não informados"}`
                      : "sem registro recente"}
                    {ok && !ok.minutagem.preciso ? " · estimativa imprecisa" : ""}
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">Mínimo para valorizar (MNO)</p>
                  <p className="font-display text-lg tracking-wide text-accent">{mno.mno_estimado.toFixed(2)} pts</p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Dificuldade <b className="text-foreground">{mno.dificuldade}</b> ·{" "}
                  <b
                    className={
                      mno.recomendacao_patrimonio.startsWith("Ganho") ? "text-success" : "text-destructive"
                    }
                  >
                    {mno.recomendacao_patrimonio}
                  </b>
                </p>
                <p className="text-[10px] text-muted-foreground">{mno.fator_chave}</p>
              </div>

              {ok && <ScoreChart dados={ok.ultimasRodadas} />}

              {ok && (
                <section>
                  <h4 className="mb-2 text-center font-display tracking-wide">
                    Últimas pontuações {ok.mando === "casa" ? "em casa" : "fora"} — média {fmt(ok.mediaMando, 2)}
                  </h4>
                  <div className="space-y-2">
                    {ok.historico.map((g) => (
                      <div key={g.rodada} className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                        <p className="mb-1 text-center text-xs text-muted-foreground">
                          Rodada {g.rodada} · {fmt(g.pontuacao, 2)} pts
                        </p>
                        <ScoutLine scout={g.scout} />
                      </div>
                    ))}
                    {!ok.historico.length && (
                      <p className="text-center text-xs text-muted-foreground">
                        Sem jogos nesse mando nas rodadas anteriores.
                      </p>
                    )}
                  </div>
                </section>
              )}

              <button
                onClick={() => setShowAll((s) => !s)}
                className="w-full rounded-lg border border-border py-2 font-display text-sm tracking-wide text-muted-foreground hover:border-accent hover:text-accent"
              >
                {showAll ? "Mostrar menos" : "Mostrar tudo"}
              </button>

              {showAll && ok && (
                <section>
                  <h4 className="mb-2 text-center font-display tracking-wide">
                    Últimas 5 pontuações {ok.mandoContrario === "casa" ? "em casa" : "fora"} (mando contrário)
                  </h4>
                  <div className="space-y-2">
                    {ok.historicoContrario.map((g) => (
                      <div key={g.rodada} className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                        <p className="mb-1 text-center text-xs text-muted-foreground">
                          Rodada {g.rodada} · {fmt(g.pontuacao, 2)} pts
                        </p>
                        <ScoutLine scout={g.scout} />
                      </div>
                    ))}
                    {!ok.historicoContrario.length && (
                      <p className="text-center text-xs text-muted-foreground">Sem jogos nesse mando.</p>
                    )}
                  </div>
                </section>
              )}


              {ok && (
                <section>
                  <h4 className="mb-1 font-display tracking-wide">Enfrenta</h4>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <img src={escudo(adversario, "30x30")} alt="" className="h-4 w-4 object-contain" />
                    {enfrenta.length ? (
                      enfrenta.map((e) => (
                        <button
                          key={e.atleta_id}
                          onClick={() => onOpenPlayer?.(e)}
                          className="flex items-center gap-1 rounded-lg border border-border bg-panel-2 px-2 py-1 hover:border-accent"
                        >
                          {playerPhoto(e) ? (
                            <img src={playerPhoto(e)!} alt="" className="h-5 w-5 rounded-full object-cover" />
                          ) : (
                            <span className="h-5 w-5 rounded-full bg-secondary" />
                          )}
                          <span className="text-foreground">{e.apelido}</span>
                        </button>
                      ))
                    ) : (
                      <span>escalação provável indisponível</span>
                    )}
                  </div>
                  <div className="mt-3">
                    <TeamFormBox
                      titulo={`${clube?.abreviacao ?? "Time"} — últimos jogos ${ok.mando === "casa" ? "em casa" : "fora"}`}
                      form={ok.formTime}
                      clubes={clubes}
                    />
                  </div>
                </section>
              )}
            </div>
          )}

          {tab === "cedimentos" && ok && (
            <div className="space-y-4">
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <img
                  src={escudo(ok.mando === "casa" ? clube : adversario, "45x45")}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
                x
                <img
                  src={escudo(ok.mando === "casa" ? adversario : clube, "45x45")}
                  alt=""
                  className="h-6 w-6 object-contain"
                />
                <span>({ok.mando === "casa" ? "mandante" : "visitante"})</span>
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Média cedida", fmt(ok.cedimentos.mediaCedida, 2)],
                  ["Média básica cedida", fmt(ok.cedimentos.mediaBasicaCedida, 2)],
                  ["Assistências cedidas", String(ok.cedimentos.assistenciasCedidas)],
                  ["Gols cedidos", String(ok.cedimentos.golsCedidos)],
                  ["Desarmes cedidos", String(ok.cedimentos.desarmesCedidos)],
                  ...(atleta.posicao_id === 1
                    ? ([["Defesas cedidas", String(ok.cedimentos.defesasCedidas)]] as Array<[string, string]>)
                    : []),
                  ...([1, 2, 3].includes(atleta.posicao_id)
                    ? ([
                        [
                          "SGs cedidos pelo adversário",
                          `${ok.formAdversario.sgCedidos} em ${ok.formAdversario.jogos.length}`,
                        ],
                      ] as Array<[string, string]>)
                    : []),
                  ["Média do jogador no mando", fmt(ok.mediaMando, 2)],
                  ["Pontuação esperada", fmt(ok.pontuacaoEsperada, 2)],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-center">
                    <p className="text-[11px] text-muted-foreground">{k}</p>
                    <p className="font-display text-lg tracking-wide">{v}</p>
                  </div>
                ))}
              </div>

              <div
                className={`rounded-lg border px-3 py-2 text-center text-xs ${recomendado ? "border-success text-success" : "border-border text-muted-foreground"}`}
              >
                {recomendado ? "★ Dica tática: confronto favorável — bom cedimento do adversário." : "Cedimento baixo para a posição — pondere outras opções."}{" "}
                Amostra: {ok.historico.length} jogos do atleta e {ok.cedimentos.amostra} do adversário
                (confiança {Math.round(ok.confianca * 100)}%).
              </div>

              <section className="space-y-2">
                <h4 className="text-center font-display tracking-wide">
                  Jogadores da posição contra {adversario?.abreviacao}
                </h4>
                {ok.cedimentos.jogos.map((g, i) => (
                  <div key={`${g.apelido}-${i}`} className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                    <div className="mb-1 flex items-center gap-2">
                      <img
                        src={escudo(clubes[String(g.clube_id ?? 0)], "30x30")}
                        alt=""
                        className="h-5 w-5 shrink-0 object-contain"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{g.apelido}</span>
                      <span className="shrink-0 pl-3 text-[11px] text-muted-foreground">R{g.rodada}</span>
                      <span
                        className={`shrink-0 pl-3 font-display text-sm ${g.pontuacao >= 0 ? "text-success" : "text-destructive"}`}
                      >
                        {fmt(g.pontuacao, 2)}
                      </span>
                    </div>
                    <ScoutLine scout={g.scout} />
                  </div>
                ))}
                {!ok.cedimentos.jogos.length && (
                  <p className="text-center text-xs text-muted-foreground">Sem amostra suficiente.</p>
                )}
                <TeamFormBox
                  titulo={`${adversario?.abreviacao ?? "Adversário"} — últimos jogos ${ok.mandoContrario === "casa" ? "em casa" : "fora"}`}
                  form={ok.formAdversario}
                  clubes={clubes}
                />
              </section>
            </div>
          )}

          {tab === "cedimentos" && !ok && !isLoading && (
            <p className="py-8 text-center text-muted-foreground">Sem confronto definido para este jogador.</p>
          )}
        </div>

        <footer className="border-t border-border p-3">
          <button
            onClick={() => setComparing(true)}
            className="w-full rounded-lg border border-accent py-2 font-display tracking-wide text-accent"
          >
            Comparar com outro jogador
          </button>
        </footer>
      </div>

      {comparing && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-background/90 p-3"
          onClick={() => setComparing(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border p-3">
              <h3 className="font-display text-lg tracking-wide">Comparar jogadores</h3>
              <button onClick={() => setComparing(false)} className="text-muted-foreground">
                ✕
              </button>
            </header>
            <div className="overflow-y-auto p-4">
              <div className="mb-4">
                <input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Digite 3 letras do nome do jogador…"
                  className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
                />
                {busca.trim().length >= 3 && (
                  <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {atletas
                      .filter(
                        (a) =>
                          a.atleta_id !== atleta.atleta_id &&
                          a.apelido.toLowerCase().includes(busca.trim().toLowerCase()),
                      )
                      .sort((a, b) => b.media_num - a.media_num)
                      .slice(0, 20)
                      .map((a) => (
                        <button
                          key={a.atleta_id}
                          onClick={() => {
                            setCompareId(a.atleta_id);
                            setBusca("");
                          }}
                          className="flex w-full items-center gap-2 rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-left hover:border-accent"
                        >
                          {playerPhoto(a) ? (
                            <img src={playerPhoto(a)!} alt="" className="h-7 w-7 rounded-full object-cover" />
                          ) : (
                            <span className="h-7 w-7 rounded-full bg-secondary" />
                          )}
                          <img src={escudo(clubes[String(a.clube_id)], "30x30")} alt="" className="h-4 w-4 object-contain" />
                          <span className="flex-1 truncate text-sm">{a.apelido}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {clubes[String(a.clube_id)]?.abreviacao} · {POS_NOME[a.posicao_id]}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-2 flex flex-col items-center gap-1">
                    <Foto a={atleta} size="h-16 w-16" />
                    <p className="text-center font-display text-lg">{atleta.apelido}</p>
                  </div>
                  <Metrics atleta={atleta} analysis={analysis} clubes={clubes} />
                </div>
                <div>
                  {outro ? (
                    <>
                      <div className="mb-2 flex flex-col items-center gap-1">
                        <Foto a={outro} size="h-16 w-16" />
                        <p className="text-center font-display text-lg">{outro.apelido}</p>
                      </div>
                      <Metrics atleta={outro} analysis={analysisB} clubes={clubes} />
                    </>
                  ) : (
                    <p className="pt-10 text-center text-sm text-muted-foreground">Selecione um jogador.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
