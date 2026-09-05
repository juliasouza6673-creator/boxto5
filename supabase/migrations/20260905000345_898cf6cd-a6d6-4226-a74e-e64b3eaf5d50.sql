CREATE TABLE public.player_status_overrides (
  atleta_id BIGINT PRIMARY KEY,
  status_id INTEGER NOT NULL,
  nota TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.player_status_overrides TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_status_overrides TO authenticated;
GRANT ALL ON public.player_status_overrides TO service_role;

ALTER TABLE public.player_status_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "status visiveis para todos"
  ON public.player_status_overrides FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "admin gerencia status"
  ON public.player_status_overrides FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_player_status_overrides_updated_at
  BEFORE UPDATE ON public.player_status_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();