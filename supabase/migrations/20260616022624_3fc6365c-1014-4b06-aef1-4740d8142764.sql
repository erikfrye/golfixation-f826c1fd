
ALTER TABLE public.proximity_entries
  ADD COLUMN IF NOT EXISTS round_position integer;

UPDATE public.proximity_entries pe
SET round_position = ((pc.hole_number - t.start_hole + tour.num_holes) % tour.num_holes) + 1
FROM public.proximity_contests pc, public.teams t, public.tournaments tour
WHERE pe.contest_id = pc.id
  AND pe.team_id = t.id
  AND pe.tournament_id = tour.id
  AND pe.round_position IS NULL;

ALTER TABLE public.proximity_entries
  ALTER COLUMN round_position SET NOT NULL;

ALTER TABLE public.proximity_entries
  ADD CONSTRAINT proximity_entries_round_position_check
  CHECK (round_position >= 1 AND round_position <= 18);

CREATE INDEX IF NOT EXISTS proximity_entries_contest_order_idx
  ON public.proximity_entries (contest_id, round_position DESC, entered_at DESC);
