CREATE TABLE public.cedimento_layouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rodada integer NOT NULL,
  clube_id integer NOT NULL,
  posicoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rodada, clube_id)
);
GRANT SELECT ON public.cedimento_layouts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cedimento_layouts TO authenticated;
GRANT ALL ON public.cedimento_layouts TO service_role;
ALTER TABLE public.cedimento_layouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "layouts leitura publica" ON public.cedimento_layouts FOR SELECT TO anon, authenticated USING (rodada > 0 AND clube_id > 0);
CREATE POLICY "admin gerencia layouts" ON public.cedimento_layouts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER cedimento_layouts_updated BEFORE UPDATE ON public.cedimento_layouts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();