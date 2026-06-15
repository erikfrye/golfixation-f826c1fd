-- Proximity contests + entries, plus optional player gender for eligibility filtering.

-- 1) team_players.gender (optional)
ALTER TABLE public.team_players
  ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE public.team_players
  ADD CONSTRAINT team_players_gender_check
  CHECK (gender IS NULL OR gender IN ('male','female','unspecified'));

-- 2) proximity_contests
CREATE TABLE public.proximity_contests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  hole_number int NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('longest_drive','closest_to_pin','longest_putt','other')),
  eligibility text NOT NULL DEFAULT 'everyone' CHECK (eligibility IN ('everyone','men','women')),
  sponsor text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, hole_number, name)
);
CREATE INDEX proximity_contests_tournament_idx
  ON public.proximity_contests (tournament_id, hole_number, sort_order);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proximity_contests TO authenticated;
GRANT SELECT ON public.proximity_contests TO anon;
GRANT ALL ON public.proximity_contests TO service_role;

ALTER TABLE public.proximity_contests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage proximity contests"
  ON public.proximity_contests
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Public can view proximity contests of visible tournaments"
  ON public.proximity_contests
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = proximity_contests.tournament_id
      AND (t.status = ANY (ARRAY['active','completed']) OR public.is_admin(auth.uid()))
  ));

CREATE TRIGGER proximity_contests_touch_updated_at
  BEFORE UPDATE ON public.proximity_contests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) proximity_entries
CREATE TABLE public.proximity_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id uuid NOT NULL REFERENCES public.proximity_contests(id) ON DELETE CASCADE,
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.team_players(id) ON DELETE SET NULL,
  player_name_snapshot text NOT NULL,
  team_name_snapshot text NOT NULL,
  note text,
  entered_at timestamptz NOT NULL DEFAULT now(),
  entered_by uuid
);
CREATE INDEX proximity_entries_contest_idx
  ON public.proximity_entries (contest_id, entered_at DESC);
CREATE INDEX proximity_entries_tournament_idx
  ON public.proximity_entries (tournament_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proximity_entries TO authenticated;
GRANT SELECT ON public.proximity_entries TO anon;
GRANT ALL ON public.proximity_entries TO service_role;

ALTER TABLE public.proximity_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage proximity entries"
  ON public.proximity_entries
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Public can view proximity entries of visible tournaments"
  ON public.proximity_entries
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = proximity_entries.tournament_id
      AND (t.status = ANY (ARRAY['active','completed']) OR public.is_admin(auth.uid()))
  ));

CREATE POLICY "Captains add proximity entries for their team"
  ON public.proximity_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_team_captain(team_id, auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.proximity_contests c
      WHERE c.id = proximity_entries.contest_id
        AND c.tournament_id = proximity_entries.tournament_id
    )
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = proximity_entries.team_id
        AND t.tournament_id = proximity_entries.tournament_id
    )
  );

-- 4) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.proximity_contests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proximity_entries;
