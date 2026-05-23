ALTER TABLE public.tournaments ADD COLUMN tee_shot_minimum integer NOT NULL DEFAULT 1;
UPDATE public.tournaments t SET tee_shot_minimum = COALESCE((SELECT MAX(tee_shot_minimum) FROM public.teams WHERE tournament_id = t.id), 1);
ALTER TABLE public.teams DROP COLUMN tee_shot_minimum;