DROP POLICY IF EXISTS "Read tournament realtime topics" ON realtime.messages;

CREATE POLICY "Read tournament realtime topics"
  ON realtime.messages
  FOR SELECT
  TO anon, authenticated
  USING (
    realtime.topic() LIKE 'tournament-%'
    AND EXISTS (
      SELECT 1 FROM public.tournaments t
      WHERE t.id::text = substring(realtime.topic() from 'tournament-(.+)$')
        AND (
          t.status IN ('active', 'completed')
          OR public.is_admin(auth.uid())
        )
    )
  );