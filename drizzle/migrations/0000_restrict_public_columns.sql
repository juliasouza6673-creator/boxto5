DROP POLICY IF EXISTS "status visiveis para todos" ON public.player_status_overrides;
CREATE POLICY "status publicos leitura" ON public.player_status_overrides FOR SELECT TO anon, authenticated USING (atleta_id IS NOT NULL AND status_id IN (2,3,5,6,7));
REVOKE SELECT ON public.player_status_overrides FROM anon;
GRANT SELECT (atleta_id, status_id) ON public.player_status_overrides TO anon;

DROP POLICY IF EXISTS "escalacoes visiveis para todos" ON public.probable_lineups;
CREATE POLICY "escalacoes publicas leitura" ON public.probable_lineups FOR SELECT TO anon, authenticated USING (rodada > 0 AND clube_id > 0);
REVOKE SELECT ON public.probable_lineups FROM anon;
GRANT SELECT (id, rodada, clube_id, atletas) ON public.probable_lineups TO anon;