
-- 1) Restrict captain UPDATE on team_players to safe columns only
REVOKE UPDATE ON public.team_players FROM authenticated;
GRANT UPDATE (name) ON public.team_players TO authenticated;

-- 2) Add tournament status guard to captain hole_scores policies
DROP POLICY IF EXISTS "Captains insert their team scores" ON public.hole_scores;
DROP POLICY IF EXISTS "Captains update their team scores" ON public.hole_scores;
DROP POLICY IF EXISTS "Captains delete their team scores" ON public.hole_scores;

CREATE POLICY "Captains insert their team scores"
ON public.hole_scores
FOR INSERT
TO authenticated
WITH CHECK (
  is_team_captain(team_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = hole_scores.tournament_id AND t.status = 'active'
  )
);

CREATE POLICY "Captains update their team scores"
ON public.hole_scores
FOR UPDATE
TO authenticated
USING (
  is_team_captain(team_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = hole_scores.tournament_id AND t.status = 'active'
  )
)
WITH CHECK (
  is_team_captain(team_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = hole_scores.tournament_id AND t.status = 'active'
  )
);

CREATE POLICY "Captains delete their team scores"
ON public.hole_scores
FOR DELETE
TO authenticated
USING (
  is_team_captain(team_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = hole_scores.tournament_id AND t.status = 'active'
  )
);
