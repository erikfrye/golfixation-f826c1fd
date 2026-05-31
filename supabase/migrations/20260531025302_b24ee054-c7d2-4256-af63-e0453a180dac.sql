-- Add first_saved_at column to hole_scores (set on insert, never updated)
ALTER TABLE public.hole_scores
  ADD COLUMN IF NOT EXISTS first_saved_at timestamptz NOT NULL DEFAULT now();

-- Create audit table
CREATE TABLE public.hole_score_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL,
  team_id uuid NOT NULL,
  hole_number integer NOT NULL,
  action text NOT NULL CHECK (action IN ('insert','update','delete')),
  old_strokes integer,
  new_strokes integer,
  old_tee_shot_player_id uuid,
  new_tee_shot_player_id uuid,
  old_mulligan_player_id uuid,
  new_mulligan_player_id uuid,
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hole_score_audit_tournament ON public.hole_score_audit(tournament_id, changed_at DESC);
CREATE INDEX idx_hole_score_audit_team ON public.hole_score_audit(team_id, hole_number);

GRANT SELECT ON public.hole_score_audit TO authenticated;
GRANT ALL ON public.hole_score_audit TO service_role;

ALTER TABLE public.hole_score_audit ENABLE ROW LEVEL SECURITY;

-- Only admins can read; nobody can update or delete (append-only via trigger using service-definer)
CREATE POLICY "Admins can view audit log"
ON public.hole_score_audit FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Trigger function: writes audit rows. SECURITY DEFINER so it bypasses RLS on insert.
CREATE OR REPLACE FUNCTION public.audit_hole_scores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      changed_by, changed_by_email
    ) VALUES (
      NEW.tournament_id, NEW.team_id, NEW.hole_number, 'update',
      OLD.strokes, NEW.strokes,
      OLD.tee_shot_player_id, NEW.tee_shot_player_id,
      OLD.mulligan_player_id, NEW.mulligan_player_id,
      auth.uid(), v_email
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
$$;

DROP TRIGGER IF EXISTS trg_audit_hole_scores ON public.hole_scores;
CREATE TRIGGER trg_audit_hole_scores
AFTER INSERT OR UPDATE OR DELETE ON public.hole_scores
FOR EACH ROW EXECUTE FUNCTION public.audit_hole_scores();

-- Prevent first_saved_at from being changed on update
CREATE OR REPLACE FUNCTION public.protect_hole_scores_first_saved_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.first_saved_at := OLD.first_saved_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_first_saved_at ON public.hole_scores;
CREATE TRIGGER trg_protect_first_saved_at
BEFORE UPDATE ON public.hole_scores
FOR EACH ROW EXECUTE FUNCTION public.protect_hole_scores_first_saved_at();
