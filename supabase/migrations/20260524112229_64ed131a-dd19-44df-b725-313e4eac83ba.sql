
CREATE TABLE public.app_settings (
  id text PRIMARY KEY,
  about_content text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view app settings"
  ON public.app_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage app settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

INSERT INTO public.app_settings (id, about_content)
VALUES ('app', 'Welcome to Golfixation — live golf tournament scoring and leaderboards.')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.tournaments ADD COLUMN about_content text;
