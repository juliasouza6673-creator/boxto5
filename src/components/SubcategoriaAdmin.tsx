import { useState } from "react";
import type { Atleta } from "@/lib/cartola-types";
import { POS_ABREV } from "@/lib/cartola-types";
import {
  SUBS_POR_POSICAO,
  parseSubcategoriasTxt,
  useSubcategoriaMutations,
  useSubcategorias,
  type Sub,
} from "@/lib/subcategorias";

type Props = { atletas: Atleta[] };

export function SubcategoriaAdmin({ atletas }: Props) {
  const { data: subs } = useSubcategorias();
  const { salvar } = useSubcategoriaMutations();
  const [status, setStatus] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const importar = async (file: File) => {
    setStatus("Importando…");
    try {
      const { registros, erros } = parseSubcategoriasTxt(await file.text());
      if (!registros.length) {
        setStatus("Nenhum registro válido encontrado.");
        return;
      }
      await salvar(registros);
      setStatus(`${registros.length} jogadores atualizados.${erros.length ? ` ${erros.length} linha(s) ignorada(s).` : ""}`);
    } catch (e) {
      setStatus(`Erro: ${(e as Error).message}`);
    }
  };

  const resultados = busca.trim().length >= 2
    ? atletas
        .filter((a) => SUBS_POR_POSICAO[a.posicao_id])
        .filter((a) => a.apelido.toLowerCase().includes(busca.trim().toLowerCase()))
        .slice(0, 20)
    : [];

  return (
    <div className="brutal bg-accent/30 p-3">
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full text-left font-display text-base"
      >
        Admin · Subcategorias {aberto ? "▾" : "▸"}
      </button>

      {aberto && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="font-condensed text-[11px] uppercase">
              Importar TXT (atleta_id;nome;clube;posicao;subcategoria)
            </p>
            <input
              type="file"
              accept=".txt,.csv,text/plain"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importar(f);
              }}
              className="mt-1 text-xs"
            />
          </div>

          <div>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Editar subcategoria: busque o jogador"
              style={{ fontSize: 16 }}
              className="w-full brutal-sm bg-panel px-2 py-1 outline-none"
            />
            <div className="mt-2 space-y-1">
              {resultados.map((a) => (
                <div key={a.atleta_id} className="flex items-center gap-2 brutal-sm bg-panel px-2 py-1">
                  <span className="min-w-0 flex-1 truncate text-xs">
                    {a.apelido} <span className="text-muted-foreground">({POS_ABREV[a.posicao_id]})</span>
                  </span>
                  <select
                    value={subs?.[String(a.atleta_id)] ?? ""}
                    onChange={async (e) => {
                      const v = e.target.value as Sub;
                      if (!v) return;
                      setStatus("Salvando…");
                      try {
                        await salvar([
                          { atleta_id: a.atleta_id, nome: a.apelido, posicao_id: a.posicao_id, subcategoria: v },
                        ]);
                        setStatus(`${a.apelido} → ${v}`);
                      } catch (err) {
                        setStatus(`Erro: ${(err as Error).message}`);
                      }
                    }}
                    className="brutal-sm bg-panel-2 px-1 py-0.5 text-xs"
                  >
                    <option value="">—</option>
                    {(SUBS_POR_POSICAO[a.posicao_id] ?? []).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {status && <p className="text-[11px] text-foreground">{status}</p>}
        </div>
      )}
    </div>
  );
}
