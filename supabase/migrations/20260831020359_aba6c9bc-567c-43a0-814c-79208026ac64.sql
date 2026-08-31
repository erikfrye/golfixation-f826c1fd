-- 1) Reclaim disk immediately: clear cron run history
TRUNCATE cron.job_run_details;

-- 2) Maintenance routine
CREATE OR REPLACE FUNCTION public.maintenance_prune_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM cron.job_run_details WHERE start_time < now() - interval '2 days';
  DELETE FROM public.email_send_log WHERE created_at < now() - interval '90 days';
END;
$$;

REVOKE ALL ON FUNCTION public.maintenance_prune_logs() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('prune-logs-nightly', '17 4 * * *', $cron$ SELECT public.maintenance_prune_logs(); $cron$);

-- 3) Cascade score audit rows with their tournament
ALTER TABLE public.hole_score_audit
  ADD CONSTRAINT hole_score_audit_tournament_id_fkey
  FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;