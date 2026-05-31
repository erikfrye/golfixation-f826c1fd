REVOKE SELECT (captain_email) ON public.teams FROM anon, authenticated;
REVOKE SELECT (override_code) ON public.tournaments FROM anon, authenticated;