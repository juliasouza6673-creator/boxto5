import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPlayerAnalysis } from "@/lib/cartola.functions";
import type { Atleta, Clube, Scout } from "@/lib/cartola-types";
import { POS_NOME, STATUS_NOME } from "@/lib/cartola-types";
import { escudo, fmt, isScoutNegative, playerPhoto, statusBorderClass } from "@/lib/cartola-ui";

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
  onClose: () => void;
};

export function PlayerModal({ atleta, atletas, clubes, onClose }: Props) {
  const [tab, setTab] = useState<"geral" | "cedimentos">("geral");
  const [showAll, setShowAll] = useState(false);
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
            <h3 className="font-display text-xl leading-tight tracking-wide">{atleta.apelido}</h3>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <img src={escudo(clube, "30x30")} alt="" className="h-4 w-4 object-contain" />
              {clube?.abreviacao} · {POS_NOME[atleta.posicao_id]} · {STATUS_NOME[atleta.status_id]}
            </p>
            <div className="mt-1">
              <ScoutLine scout={atleta.scout} />
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
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
                {[
                  ["Preço", `C$ ${fmt(atleta.preco_num, 2)}`],
                  ["Média geral", fmt(atleta.media_num, 2)],
                  ["Última pontuação", fmt(atleta.pontos_num, 2)],
                  ["Jogos", String(atleta.jogos_num)],
                  [
                    atleta.posicao_id === 1 ? "Defesas" : "Desarmes",
                    String(atleta.scout?.[atleta.posicao_id === 1 ? "DE" : "DS"] ?? 0),
                  ],
                  [
                    atleta.variacao_num >= 0 ? "Valorização" : "Desvalorização",
                    fmt(Math.abs(atleta.variacao_num), 2),
                  ],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-lg border border-border bg-panel-2 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">{k}</p>
                    <p className="font-display text-lg tracking-wide">{v}</p>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowAll((s) => !s)}
                className="w-full rounded-lg border border-border py-2 font-display text-sm tracking-wide text-muted-foreground hover:border-accent hover:text-accent"
              >
                {showAll ? "Mostrar menos" : "Mostrar tudo"}
              </button>
              {showAll && (
                <dl className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {Object.entries(atleta.scout ?? {}).map(([k, v]) => (
                    <div key={k} className="flex justify-between px-3 py-1.5">
                      <dt className={isScoutNegative(k) ? "text-destructive" : "text-success"}>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-1.5">
                    <dt className="text-muted-foreground">Mínimo para valorizar</dt>
                    <dd>{fmt(atleta.minimo_para_valorizar ?? null, 2)}</dd>
                  </div>
                </dl>
              )}

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

              {ok && (
                <section>
                  <h4 className="mb-1 font-display tracking-wide">Enfrenta</h4>
                  <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <img src={escudo(adversario, "30x30")} alt="" className="h-4 w-4 object-contain" />
                    {enfrenta.map((e) => e.apelido).join(", ") || "escalação provável indisponível"}
                  </p>
                </section>
              )}
            </div>
          )}

          {tab === "cedimentos" && ok && (
            <div className="space-y-4">
              <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <img src={escudo(clube, "30x30")} alt="" className="h-5 w-5 object-contain" /> x
                <img src={escudo(adversario, "30x30")} alt="" className="h-5 w-5 object-contain" />
                <span>({ok.mando === "casa" ? "mandante" : "visitante"})</span>
              </p>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ["Média cedida", fmt(ok.cedimentos.mediaCedida, 2)],
                  ["Média básica cedida", fmt(ok.cedimentos.mediaBasicaCedida, 2)],
                  ["Assistências cedidas", String(ok.cedimentos.assistenciasCedidas)],
                  ["Gols cedidos", String(ok.cedimentos.golsCedidos)],
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
                    <p className="mb-1 text-center text-xs text-muted-foreground">
                      {g.apelido} · rodada {g.rodada} · {fmt(g.pontuacao, 2)} pts
                    </p>
                    <ScoutLine scout={g.scout} />
                  </div>
                ))}
                {!ok.cedimentos.jogos.length && (
                  <p className="text-center text-xs text-muted-foreground">Sem amostra suficiente.</p>
                )}
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
              <select
                value={compareId ?? ""}
                onChange={(e) => setCompareId(Number(e.target.value) || null)}
                className="mb-4 w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm"
              >
                <option value="">Escolher {POS_NOME[atleta.posicao_id]}…</option>
                {atletas
                  .filter((a) => a.posicao_id === atleta.posicao_id && a.atleta_id !== atleta.atleta_id)
                  .sort((a, b) => b.media_num - a.media_num)
                  .slice(0, 120)
                  .map((a) => (
                    <option key={a.atleta_id} value={a.atleta_id}>
                      {a.apelido} — {clubes[String(a.clube_id)]?.abreviacao}
                    </option>
                  ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-2 text-center font-display text-lg">{atleta.apelido}</p>
                  <Metrics atleta={atleta} analysis={analysis} clubes={clubes} />
                </div>
                <div>
                  {outro ? (
                    <>
                      <p className="mb-2 text-center font-display text-lg">{outro.apelido}</p>
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
