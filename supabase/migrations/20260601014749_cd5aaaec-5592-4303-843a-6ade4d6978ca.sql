-- Add edit reason capture for score edits
ALTER TABLE public.hole_scores
  ADD COLUMN IF NOT EXISTS last_edit_reason text;

ALTER TABLE public.hole_score_audit
  ADD COLUMN IF NOT EXISTS edit_reason text;

-- Update trigger to capture the edit reason on updates
CREATE OR REPLACE FUNCTION public.audit_hole_scores()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
BEGIN
  BEGIN
    v_email := (auth.jwt() ->> 'email');
  EXCEPTION WHEN OTHERS THEN
    v_email := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.hole_score_audit(
      tournament_id, team_id, hole_number, action,
      new_strokes, new_tee_shot_player_id, new_mulligan_player_id,
      changed_by, changed_by_email
    ) VALUES (
      NEW.tournament_id, NEW.team_id, NEW.hole_number, 'insert',
      NEW.strokes, NEW.tee_shot_player_id, NEW.mulligan_player_id,
      auth.uid(), v_email
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.hole_score_audit(
      tournament_id, team_id, hole_number, action,
      old_strokes, new_strokes,
      old_tee_shot_player_id, new_tee_shot_player_id,
      old_mulligan_player_id, new_mulligan_player_id,
      changed_by, changed_by_email, edit_reason
    ) VALUES (
      NEW.tournament_id, NEW.team_id, NEW.hole_number, 'update',
      OLD.strokes, NEW.strokes,
      OLD.tee_shot_player_id, NEW.tee_shot_player_id,
      OLD.mulligan_player_id, NEW.mulligan_player_id,
      auth.uid(), v_email, NEW.last_edit_reason
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.hole_score_audit(
      tournament_id, team_id, hole_number, action,
      old_strokes, old_tee_shot_player_id, old_mulligan_player_id,
      changed_by, changed_by_email
    ) VALUES (
      OLD.tournament_id, OLD.team_id, OLD.hole_number, 'delete',
      OLD.strokes, OLD.tee_shot_player_id, OLD.mulligan_player_id,
      auth.uid(), v_email
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;