CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own boards select" ON public.boards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own boards insert" ON public.boards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own boards update" ON public.boards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own boards delete" ON public.boards FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX boards_user_unique ON public.boards(user_id);