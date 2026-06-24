# Fix: Site not loading (preview + published)

## Root cause

The browser is throwing:

> Missing Supabase environment variable(s): SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY. Connect Supabase in Lovable Cloud.

There is **no `.env` file** in the project (only `.env.example`). The Supabase client reads `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, which Vite inlines at build time. With no `.env` present, those values are `undefined` in both the preview bundle and the published bundle, so the first component that touches `supabase` (`AuthSync` in `__root.tsx`) throws — bubbling to the root error boundary and showing "This page didn't load". The Lovable Cloud backend itself is healthy; this is a missing managed env-file problem, not a code bug.

The earlier React Email / `entities` work is unrelated to this current failure.

## Plan

1. **Reconnect Lovable Cloud** so the managed `.env` is regenerated with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. You'll do this in the UI (Cloud panel → reconnect/refresh). I'll guide you.
2. **Restart the dev sandbox** so Vite picks up the new `.env`, then verify the preview `/` loads with no console error.
3. **Re-publish** so the production bundle is rebuilt with the env values inlined. The current live bundle was built without them and will stay broken until a new publish.
4. **Verify**: load preview + published URL, confirm no "Missing Supabase environment variable" error, confirm OTP email send still works end-to-end.

## Out of scope (leave alone)

- Email templates, `entities` aliasing, `vite.config.ts` aliases, server.ts wrapper — all unrelated to the current failure. Touching them risks regressions.

## If reconnecting doesn't regenerate `.env`

Fallback: ask support to refresh the Cloud integration, or re-link the project to its Cloud backend from project settings. Do **not** hand-write `.env` with guessed values.
