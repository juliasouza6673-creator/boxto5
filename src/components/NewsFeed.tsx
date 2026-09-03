import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getBestOfRound } from "@/lib/cartola.functions";
import type { Clube } from "@/lib/cartola-types";
import { POS_ABREV, POS_NOME } from "@/lib/cartola-types";
import { escudo, fmt } from "@/lib/cartola-ui";
import { useSubcategorias } from "@/lib/subcategorias";

type NewsItem = { titulo: string; link: string; data: string | null; fonte: string };

type Props = { noticias: NewsItem[]; clubes: Record<string, Clube> };

export function NewsFeed({ noticias, clubes }: Props) {
  const { data: subs } = useSubcategorias();
  const fn = useServerFn(getBestOfRound);
  const { data: best } = useQuery({
    queryKey: ["best-of-round", subs ? Object.keys(subs).length : 0],
    queryFn: () => fn({ data: { subs: subs ?? {} } }),
    staleTime: 15 * 60_000,
  });

  const recs = useMemo(() => {
    if (!best?.ok) return [];
    return [1, 2, 3, 4, 5]
      .map((p) => best.byPos[String(p)]?.[0])
      .filter((r): r is NonNullable<typeof r> => !!r);
  }, [best]);

  const feed = useMemo(() => {
    const out: Array<{ tipo: "noticia"; item: NewsItem } | { tipo: "rec"; item: (typeof recs)[number] }> = [];
    let ri = 0;
    noticias.forEach((n, i) => {
      out.push({ tipo: "noticia", item: n });
      if ((i + 1) % 3 === 0 && recs[ri]) out.push({ tipo: "rec", item: recs[ri++]! });
    });
    while (ri < recs.length) out.push({ tipo: "rec", item: recs[ri++]! });
    return out;
  }, [noticias, recs]);

  if (!feed.length) return <p className="brutal p-4 text-center text-sm text-muted-foreground">Sem conteúdo no momento.</p>;

  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 sm:grid sm:grid-cols-2 sm:overflow-visible">
      {feed.map((f, i) =>
        f.tipo === "noticia" ? (
          <a
            key={`n-${i}`}
            href={f.item.link}
            target="_blank"
            rel="noreferrer"
            className="min-w-[85%] shrink-0 snap-center brutal p-3 hover:bg-accent sm:min-w-0"
          >
            <span className="block font-condensed text-sm uppercase leading-snug">{f.item.titulo}</span>
            {f.item.data && (
              <span className="mt-1 block text-[10px] text-muted-foreground">
                {new Date(f.item.data).toLocaleDateString("pt-BR")}
              </span>
            )}
          </a>
        ) : (
          <article key={`r-${i}`} className="min-w-[85%] shrink-0 snap-center brutal bg-accent p-3 text-accent-foreground sm:min-w-0">
            <p className="font-condensed text-[10px] uppercase tracking-widest">Recomendação da rodada</p>
            <div className="mt-1 flex items-center gap-2">
              <img src={escudo(clubes[String(f.item.clube_id)], "45x45")} alt="" className="h-8 w-8 object-contain" />
              <div>
                <p className="font-display text-base leading-none">
                  {f.item.apelido}
                  {subs?.[String(f.item.atleta_id)] ? ` (${subs[String(f.item.atleta_id)]})` : ""}
                </p>
                <p className="text-[10px]">
                  {POS_NOME[f.item.posicao_id]} · {f.item.mando === "casa" ? "em casa" : "fora"} contra{" "}
                  {clubes[String(f.item.adversario)]?.abreviacao}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-snug">
              Enfrenta um adversário que cedeu média de {fmt(f.item.mediaCedida, 1)} pontos a{" "}
              {POS_ABREV[f.item.posicao_id]}
              {subs?.[String(f.item.atleta_id)] ? ` (${subs[String(f.item.atleta_id)]})` : ""} nos últimos 5 jogos jogando{" "}
              {f.item.mando === "casa" ? "fora de casa" : "em casa"}. Média no mando {fmt(f.item.mediaMando, 1)} ·
              recorrência {fmt(f.item.recorrencia, 0)}%.
            </p>
            <p className="mt-1 text-[10px] font-bold">
              {f.item.posicao_id === 1
                ? `Defesas cedidas: ${f.item.defesasCedidas}`
                : f.item.posicao_id === 5
                  ? `Gols cedidos: ${f.item.golsCedidos}`
                  : `Desarmes cedidos: ${f.item.desarmesCedidos}`}
            </p>
          </article>
        ),
      )}
    </div>
  );
}
