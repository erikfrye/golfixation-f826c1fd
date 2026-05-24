ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS mulligans_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS start_date timestamptz,
  ADD COLUMN IF NOT EXISTS start_format text NOT NULL DEFAULT 'tee_time';

ALTER TABLE public.tournaments
  DROP CONSTRAINT IF EXISTS tournaments_start_format_check;
ALTER TABLE public.tournaments
  ADD CONSTRAINT tournaments_start_format_check CHECK (start_format IN ('tee_time','shotgun'));

ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS start_hole integer NOT NULL DEFAULT 1;