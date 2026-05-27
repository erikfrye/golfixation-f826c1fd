## Goal
When a tournament's "Allow mulligans" toggle is off, remove all mulligan-related UI from the public leaderboard and the admin Manage teams page.

## Changes

### 1. Admin Manage teams page (`src/routes/admin.tournaments.$id_.teams.tsx`)
- Read `mulligans_enabled` from the tournament query (already returned by `adminGetTournament`).
- Hide the "Mulligans" label + input next to each player when mulligans are disabled.
- When adding a new player, set `mulligans_total` to `0` instead of `2` when mulligans are disabled.

### 2. Public Leaderboard (`src/routes/tournament.$id.tsx`)
- Add `mulligans_enabled` to the tournament query select so it is available on the client.
- Hide the amber mulligan indicator dot on score cells in the expanded team row.
- Hide the mulligan legend text below the score table.
- Pass `mulligansEnabled` into `HoleDetailModal` and hide the "Mulligan" detail row when disabled.