REVOKE SELECT ON public.teams FROM anon, authenticated;
GRANT SELECT (id, name, tournament_id, start_hole, created_at) ON public.teams TO anon, authenticated;

REVOKE SELECT ON public.tournaments FROM anon, authenticated;
GRANT SELECT (id, name, status, num_holes, format, tee_shot_minimum, about_content, mulligans_enabled, start_date, start_format, location, created_by, created_at) ON public.tournaments TO anon, authenticated;