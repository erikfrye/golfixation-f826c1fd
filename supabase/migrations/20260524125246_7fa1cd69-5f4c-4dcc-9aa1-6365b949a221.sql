
REVOKE SELECT (captain_email) ON public.teams FROM anon, authenticated;
REVOKE SELECT (override_code) ON public.tournaments FROM anon, authenticated;

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read tournament realtime topics" ON realtime.messages;
CREATE POLICY "Read tournament realtime topics"
  ON realtime.messages
  FOR SELECT
  TO anon, authenticated
  USING (realtime.topic() LIKE 'tournament-%');
