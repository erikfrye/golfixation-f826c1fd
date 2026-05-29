GRANT SELECT ON public.tournaments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;

GRANT SELECT ON public.teams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;

GRANT SELECT ON public.team_players TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.team_players TO authenticated;
GRANT ALL ON public.team_players TO service_role;

GRANT SELECT ON public.holes TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.holes TO authenticated;
GRANT ALL ON public.holes TO service_role;

GRANT SELECT ON public.hole_scores TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.hole_scores TO authenticated;
GRANT ALL ON public.hole_scores TO service_role;

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

GRANT SELECT ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;