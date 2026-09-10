# Survey integration plan

Add configurable survey links for captains and admins, then surface them in the About box and the profile menu.

## What we will build

1. Configurable survey URLs in app settings
   - Add `captain_survey_url` and `admin_survey_url` text columns to `public.app_settings` (or reuse `about_content` metadata if simpler).
   - Expose the values in the Admin dashboard so organizers can paste/change the Google Forms links without redeploying.
   - Default to the provided captain form URL for `captain_survey_url`.

2. About box survey prompt
   - Update `src/components/about-dialog.tsx` to read the configured survey URL.
   - When a survey URL exists, render a short paragraph above the Lovable credit:
     *"Help us improve Golfixation — this 2-minute survey shapes what we build next."*
   - Use an external link that opens the form in the system browser (important for PWA/homescreen users).

3. Profile menu feedback link
   - Update `src/components/user-menu.tsx` to add a "Give feedback" menu item.
   - Show it for captains (using `captain_survey_url`) and admins (using `admin_survey_url`).
   - Open the configured URL in a new tab.

4. Admin settings UI
   - In `src/routes/admin.index.tsx`, add two input fields under "App About":
     - Captain survey URL
     - Admin/organizer survey URL
   - Save both alongside `about_content` in the existing `app_settings` upsert.

## Out of scope

- Tournament-specific surveys (the provided URL is generic for all captains).
- Pre-filling the Google Form with the user's email or team name.
- In-app survey rendering or embedded Google Forms iframe.

## Files to change

- `src/integrations/supabase/types.ts` — add `captain_survey_url` and `admin_survey_url` to the `app_settings` type.
- `src/components/about-dialog.tsx` — fetch and render survey link.
- `src/components/user-menu.tsx` — add "Give feedback" item for captains/admins.
- `src/routes/admin.index.tsx` — add survey URL inputs and persist them.
- `docs/quick-start-guide.md` — optional note telling captains where to find the feedback link.
