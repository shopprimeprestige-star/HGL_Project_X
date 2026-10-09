CREATE OR REPLACE FUNCTION public.get_meta_sync_cron_history()
RETURNS TABLE (
  jobid bigint,
  runid bigint,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT d.jobid, d.runid, d.status, d.return_message, d.start_time, d.end_time
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname = 'meta-spend-sync-daily'
  ORDER BY d.start_time DESC
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.get_meta_sync_cron_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_sync_cron_history() TO service_role;