CREATE TABLE public.round_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rodada integer NOT NULL,
  tipo text NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rodada, tipo)
);
GRANT SELECT ON public.round_recommendations TO anon, authenticated;
GRANT ALL ON public.round_recommendations TO service_role;
ALTER TABLE public.round_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recomendacoes leitura publica" ON public.round_recommendations FOR SELECT TO anon, authenticated
  USING (rodada > 0 AND tipo IN ('best', 'sg'));