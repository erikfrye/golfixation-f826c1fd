## Goal

Give admins a way to enter/edit scores for any team in a tournament, without building a parallel UI.

## Approach

Admins are already allowed to manage `hole_scores` and `team_players` (existing RLS: `Admins manage scores` / `Admins manage team players`). So the captain scoring screen at `/captain/team/$teamId` works for them as-is — we just need an entry point from the admin flow.

## Changes

1. **Manage Teams page (`src/routes/admin.tournaments.$id_.teams.tsx`)**
   - Add a "Score" button (with a pencil/edit icon) next to each team's "Delete team" button.
   - Links to `/captain/team/$teamId` for that team.

2. **Captain scoring screen (`src/routes/captain.team.$teamId.index.tsx` and `captain.team.$teamId.tsx`)**
   - The existing "Back" link currently returns to the captain's team list (`/captain`). When an admin arrives from Manage Teams, we want them to return to Manage Teams instead.
   - Detect admin context via a query param (e.g. `?from=admin`) on the link from Manage Teams. When present, the back link points to `/admin/tournaments/$id/teams` (using the team's `tournament_id`). Otherwise behavior is unchanged for captains.

3. **No DB / RLS changes** — admin already has full CRUD on scores and players via existing policies.

## Out of scope

- No tournament-wide matrix view.
- No changes to the leaderboard or public tournament page.
- No changes to mulligan / tee-shot logic — admin uses the same controls captains do.

## Technical notes

- Use TanStack Router `search` params for `from=admin` so it's type-safe and preserved across the scoring sub-routes.
- The Score button uses the existing Link component with `params={{ teamId: team.id }}` and `search={{ from: "admin" }}`.
