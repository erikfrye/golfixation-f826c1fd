CREATE TABLE public.override_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  captain_email text NOT NULL,
  success boolean NOT NULL DEFAULT true,
  failure_reason text,
  ip text,
  user_agent text,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.override_code_redemptions TO authenticated;
GRANT ALL ON public.override_code_redemptions TO service_role;

ALTER TABLE public.override_code_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read redemptions"
  ON public.override_code_redemptions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE INDEX idx_orc_tournament_time ON public.override_code_redemptions (tournament_id, redeemed_at DESC);
