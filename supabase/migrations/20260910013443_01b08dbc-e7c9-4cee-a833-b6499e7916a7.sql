GRANT INSERT ON public.hole_score_audit TO service_role;
GRANT INSERT ON public.override_code_redemptions TO service_role;

DROP POLICY IF EXISTS "Service role can insert audit rows" ON public.hole_score_audit;
CREATE POLICY "Service role can insert audit rows"
ON public.hole_score_audit
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role can insert redemptions" ON public.override_code_redemptions;
CREATE POLICY "Service role can insert redemptions"
ON public.override_code_redemptions
FOR INSERT
TO public
WITH CHECK (auth.role() = 'service_role');