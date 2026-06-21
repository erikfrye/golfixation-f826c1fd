# Remove `.env` from the repo

## Important context first

On Lovable Cloud, `.env` is auto-managed. Even if we delete it and gitignore it, the next build on Lovable will **recreate it** with the same values. So this step only has lasting effect once you actually move the project off Lovable's managed build (e.g. the Netlify cutover we discussed). Doing it now is fine as prep, but expect to see `.env` reappear on Lovable until then.

Also worth repeating: the values currently in `.env` (project URL, project ID, publishable/anon key) are **not secrets** — they're designed to ship in the client bundle. Removing them from git is hygiene, not a security fix.

## File changes

### 1. `.gitignore` — add an `# Environment` section
Append:
```
# Environment
.env
.env.local
.env.*.local
```
Keep `.env.example` trackable (we'll add one in step 3).

### 2. `.env` — remove from the repo
Delete the file with `rm .env` (Lovable will regenerate it locally on next build; the deletion from git history is what matters).

### 3. `.env.example` — add a tracked template
New file at repo root, no real values:
```
# Supabase (publishable values — safe to commit, shown here for setup reference)
SUPABASE_URL="https://<your-project-ref>.supabase.co"
SUPABASE_PROJECT_ID="<your-project-ref>"
SUPABASE_PUBLISHABLE_KEY="<your-anon-key>"
VITE_SUPABASE_URL="https://<your-project-ref>.supabase.co"
VITE_SUPABASE_PROJECT_ID="<your-project-ref>"
VITE_SUPABASE_PUBLISHABLE_KEY="<your-anon-key>"
```

### 4. `README.md` — short setup note
Add a "Local development" section pointing devs to copy `.env.example` → `.env` and fill in the values from their Lovable Cloud project (or self-hosted Supabase, post-cutover).

## What I am NOT changing

- `src/integrations/supabase/client.ts` — already reads from `import.meta.env.VITE_*`, no change needed.
- `src/integrations/supabase/client.server.ts` — already reads from `process.env.*`, no change needed.
- No key rotation (you picked option 2, not option 3). The anon key in git history stays valid; that's fine because it's a publishable key.

## Git history caveat

`git rm` only removes the file from the current commit. The old `.env` is still reachable in prior commits on GitHub. Because the values are publishable, that's not a security problem. If you still want them scrubbed from history, that's a separate operation (BFG / `git filter-repo`) that has to run on your local clone — Lovable can't rewrite the remote's history for you. Tell me if you want instructions for that as a follow-up.

## After approval, in one batch

- `rm .env`
- patch `.gitignore` (add Environment section)
- create `.env.example`
- patch `README.md` (Local development note)
