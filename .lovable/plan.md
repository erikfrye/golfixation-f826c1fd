# Golfixation — Build Plan

The spec is large (3 user roles, 6+ tables, realtime, OTP + Google auth, PWA). Building it all in one shot would be unreliable. I'll build it in phases so we can verify each before moving on.

## Stack adjustments vs. spec

The spec assumes Vite + React Router + Supabase + Netlify. This template is **TanStack Start on Lovable Cloud** (which is Supabase under the hood). Functionally equivalent — same Postgres, Auth, Realtime, Storage — but:

- Routing: TanStack Router file-based routes (not React Router)
- Hosting: Lovable Cloud / Cloudflare Workers (not Netlify) — still free, still deploys from this project
- Email: Lovable Email (built-in) instead of manually wiring Resend SMTP
- Auth: Google OAuth + Email OTP both supported natively

PWA install support via `vite-plugin-pwa` will be added.

## Phase 1 — Foundation (this turn)
1. Enable Lovable Cloud
2. Design system: golf-inspired tokens (fairway green, sand, navy) in `src/styles.css`
3. Database schema + RLS: `admins`, `tournaments`, `holes`, `teams`, `team_players`, `hole_scores` with all policies
4. Public landing page listing active/completed tournaments
5. Public leaderboard route (read-only, realtime) — `/tournament/:id`

## Phase 2 — Captain flow
1. `/login` — email OTP entry + override-code fallback
2. `/captain/tournament/:id` — hole-by-hole score entry with stepper
3. Texas Scramble tee-shot eligibility logic
4. Mulligan tracking per player

## Phase 3 — Admin flow
1. Google OAuth login, admins-table gate
2. `/admin` dashboard
3. `/admin/tournament/new` + edit (holes, par, override code generation)
4. `/admin/tournament/:id/teams` — team/player/mulligan management

## Phase 4 — Polish
1. PWA manifest + service worker (home-screen install)
2. Drill-down scorecard + hole detail view
3. Pull-to-refresh + "last updated" timestamp
4. Mobile UX pass (44px targets, dark mode)

## Technical notes
- All tables UUID PK, RLS enabled from creation
- `hole_scores` Realtime publication enabled
- Captain session = 24h (Supabase JWT setting)
- OTP expiry = 5 min
- Admin seed: `golfixation.info@gmail.com` inserted into `admins` after first Google login

## What I need from you
1. **Confirm the stack swap** (TanStack/Lovable Cloud instead of Vite-React-Router/Netlify/Resend) — same capabilities, just the platform's native versions
2. **Confirm I should start with Phase 1** and we iterate from there

Want me to proceed?
