-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- SUBCATEGORIAS
CREATE TABLE public.player_subcategories (
  atleta_id bigint PRIMARY KEY,
  nome text,
  clube text,
  posicao_id integer,
  subcategoria text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.player_subcategories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_subcategories TO authenticated;
GRANT ALL ON public.player_subcategories TO service_role;

ALTER TABLE public.player_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcategorias visiveis para todos" ON public.player_subcategories
  FOR SELECT USING (true);
CREATE POLICY "admin gerencia subcategorias" ON public.player_subcategories
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ESCALACOES PROVAVEIS
CREATE TABLE public.probable_lineups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rodada integer NOT NULL,
  clube_id integer NOT NULL,
  atletas jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rodada, clube_id)
);

GRANT SELECT ON public.probable_lineups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.probable_lineups TO authenticated;
GRANT ALL ON public.probable_lineups TO service_role;

ALTER TABLE public.probable_lineups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "escalacoes visiveis para todos" ON public.probable_lineups
  FOR SELECT USING (true);
CREATE POLICY "admin gerencia escalacoes" ON public.probable_lineups
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_player_subcategories_updated_at
  BEFORE UPDATE ON public.player_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_probable_lineups_updated_at
  BEFORE UPDATE ON public.probable_lineups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();