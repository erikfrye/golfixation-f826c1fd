ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS captain_survey_url text,
  ADD COLUMN IF NOT EXISTS admin_survey_url text;