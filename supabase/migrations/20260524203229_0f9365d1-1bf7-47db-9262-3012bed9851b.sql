-- Restrict access to sensitive columns: tournaments.override_code and teams.captain_email
-- These columns must not be visible to public (anon) or regular authenticated users via the API.
-- Admin server functions use the service role key, which bypasses these grants.

REVOKE SELECT ON public.tournaments FROM anon, authenticated;
GRANT SELECT (id, name, status, num_holes, format, tee_shot_minimum, about_content, mulligans_enabled, start_date, start_format, created_at, created_by) ON public.tournaments TO anon, authenticated;

REVOKE SELECT ON public.teams FROM anon, authenticated;
GRANT SELECT (id, name, tournament_id, start_hole, created_at) ON public.teams TO anon, authenticated;