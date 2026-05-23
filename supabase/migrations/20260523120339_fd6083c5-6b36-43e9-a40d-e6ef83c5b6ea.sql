
-- Helper: check if current user is an admin
CREATE TABLE public.admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE id = _user_id)
$$;

-- Admins table policies
CREATE POLICY "Admins can view admin list" ON public.admins
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can manage admins" ON public.admins
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Tournaments
CREATE TABLE public.tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed')),
  format TEXT NOT NULL DEFAULT 'texas_scramble' CHECK (format IN ('scramble','texas_scramble')),
  num_holes INTEGER NOT NULL DEFAULT 18 CHECK (num_holes IN (9, 18)),
  override_code TEXT NOT NULL,
  created_by UUID REFERENCES public.admins(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active/completed tournaments" ON public.tournaments
  FOR SELECT TO anon, authenticated USING (status IN ('active','completed') OR public.is_admin(auth.uid()));
CREATE POLICY "Admins manage tournaments" ON public.tournaments
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Holes
CREATE TABLE public.holes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par INTEGER NOT NULL DEFAULT 4,
  handicap INTEGER,
  UNIQUE (tournament_id, hole_number)
);
ALTER TABLE public.holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view holes of visible tournaments" ON public.holes
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND (t.status IN ('active','completed') OR public.is_admin(auth.uid())))
  );
CREATE POLICY "Admins manage holes" ON public.holes
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  captain_email TEXT NOT NULL,
  tee_shot_minimum INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE INDEX teams_tournament_idx ON public.teams(tournament_id);
CREATE INDEX teams_captain_email_idx ON public.teams(lower(captain_email));

CREATE POLICY "Public can view teams of visible tournaments" ON public.teams
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND (t.status IN ('active','completed') OR public.is_admin(auth.uid())))
  );
CREATE POLICY "Admins manage teams" ON public.teams
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Helper: is current user the captain of this team?
CREATE OR REPLACE FUNCTION public.is_team_captain(_team_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams t
    JOIN auth.users u ON u.id = _user_id
    WHERE t.id = _team_id AND lower(t.captain_email) = lower(u.email)
  )
$$;

-- Team players
CREATE TABLE public.team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mulligans_total INTEGER NOT NULL DEFAULT 0,
  mulligans_used INTEGER NOT NULL DEFAULT 0,
  tee_shots_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_players ENABLE ROW LEVEL SECURITY;
CREATE INDEX team_players_team_idx ON public.team_players(team_id);

CREATE POLICY "Public can view players of visible tournaments" ON public.team_players
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND (t.status IN ('active','completed') OR public.is_admin(auth.uid())))
  );
CREATE POLICY "Admins manage team players" ON public.team_players
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Captains update their team players" ON public.team_players
  FOR UPDATE TO authenticated USING (public.is_team_captain(team_id, auth.uid())) WITH CHECK (public.is_team_captain(team_id, auth.uid()));

-- Hole scores
CREATE TABLE public.hole_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  hole_number INTEGER NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  strokes INTEGER NOT NULL CHECK (strokes >= 1),
  tee_shot_player_id UUID REFERENCES public.team_players(id) ON DELETE SET NULL,
  mulligan_player_id UUID REFERENCES public.team_players(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, hole_number)
);
ALTER TABLE public.hole_scores ENABLE ROW LEVEL SECURITY;
CREATE INDEX hole_scores_tournament_idx ON public.hole_scores(tournament_id);

CREATE POLICY "Public can view scores of visible tournaments" ON public.hole_scores
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.tournaments t WHERE t.id = tournament_id AND (t.status IN ('active','completed') OR public.is_admin(auth.uid())))
  );
CREATE POLICY "Admins manage scores" ON public.hole_scores
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Captains insert their team scores" ON public.hole_scores
  FOR INSERT TO authenticated WITH CHECK (public.is_team_captain(team_id, auth.uid()));
CREATE POLICY "Captains update their team scores" ON public.hole_scores
  FOR UPDATE TO authenticated USING (public.is_team_captain(team_id, auth.uid())) WITH CHECK (public.is_team_captain(team_id, auth.uid()));
CREATE POLICY "Captains delete their team scores" ON public.hole_scores
  FOR DELETE TO authenticated USING (public.is_team_captain(team_id, auth.uid()));

-- updated_at trigger for hole_scores
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER hole_scores_touch BEFORE UPDATE ON public.hole_scores
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.hole_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tournaments;
