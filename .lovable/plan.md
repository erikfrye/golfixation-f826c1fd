
# Proximity Contests

Add per-tournament "proximity contests" (longest drive, closest to pin, longest putt, etc.). Admins define them, captains enter winners on the assigned hole, leaderboard shows current leader + history.

## Data model

Two new tables in `public`.

### `proximity_contests`
Admin-defined contest tied to a tournament and a specific hole.

- `id` uuid pk
- `tournament_id` uuid fk → tournaments (cascade)
- `hole_number` int (1–18, validated against tournament's `num_holes`)
- `name` text — e.g. "Longest Drive", "Closest to the Pin"
- `kind` text — preset enum: `longest_drive` | `closest_to_pin` | `longest_putt` | `other` (drives default icon/label, not behavior)
- `eligibility` text — `everyone` | `men` | `women`
- `sponsor` text nullable
- `sort_order` int (for stable ordering within a hole)
- `created_at`, `updated_at`

Unique: `(tournament_id, hole_number, name)`.

### `proximity_entries`
Append-only log of every entry; "current leader" = most recent entry.

- `id` uuid pk
- `contest_id` uuid fk → proximity_contests (cascade)
- `tournament_id` uuid (denormalized for RLS + realtime filtering)
- `team_id` uuid fk → teams (cascade)
- `player_id` uuid fk → team_players nullable (cascade set null) — single player per entry
- `player_name_snapshot` text — captured at entry time so history survives roster changes
- `team_name_snapshot` text
- `entered_at` timestamptz default now()
- `entered_by` uuid (auth.uid()) nullable
- `note` text nullable (optional measurement, e.g. "287 yds", "4 ft 2 in" — free text, not required)

Indexes: `(contest_id, entered_at desc)`, `(tournament_id)`.

### RLS

- `proximity_contests`: admins manage; public SELECT when parent tournament is active/completed (mirror `holes` policy).
- `proximity_entries`: admins manage; public SELECT under same visibility rule; captains INSERT when `is_team_captain(team_id, auth.uid())` AND the contest's tournament matches the team's tournament. No UPDATE for captains — entries are append-only; admins can DELETE to correct mistakes (writes a row to `hole_score_audit`-style log? — out of scope; rely on admin delete + re-enter for v1).
- Add both tables to `supabase_realtime` publication.
- GRANTs: `SELECT` to anon+authenticated, `INSERT/UPDATE/DELETE` to authenticated, ALL to service_role.

## Server functions

New file `src/lib/proximity.functions.ts`:

- `adminListProximityContests({ tournamentId })` — admin only
- `adminUpsertProximityContest({ id?, tournamentId, holeNumber, name, kind, eligibility, sponsor, sortOrder })`
- `adminDeleteProximityContest({ id })`
- `adminDeleteProximityEntry({ id })`
- `captainAddProximityEntry({ contestId, teamId, playerId, note? })` — uses `requireSupabaseAuth`; server reads team_players + teams to snapshot names; verifies captain via existing pattern.
- `listProximityContests({ tournamentId })` — public read (RLS-scoped); returns contests + current leader (latest entry per contest) joined.
- `listProximityHistory({ contestId })` — public read; returns full entry log ordered `entered_at desc`.

Public reads can stay on the browser supabase client too, but a server fn keeps the leader join consistent.

## Admin UI

In `src/routes/admin.tournaments.$id.tsx`, add a new "Proximity Contests" section (collapsible):

- List existing contests grouped by hole.
- "Add proximity" button → dialog with: hole picker (1..num_holes), name, kind (select), eligibility (radio: everyone/men/women), optional sponsor, optional sort_order.
- Each row: edit + delete.
- Optionally a separate page `admin.tournaments.$id_.proximity.tsx` if the section gets large — start inline.

## Captain UI

In `src/routes/captain.team.$teamId.index.tsx`, inside `HoleCard` for the active hole:

- Query proximity contests for the tournament filtered to `hole_number === activeHole.hole_number`.
- For each contest card show: name + sponsor chip + eligibility badge.
- "Current leader" row (player name + team + relative time) — pulled from latest entry.
- "Add entry" button → small sheet/dialog: select player from the team's `team_players` (filter by eligibility when men/women — requires a `gender` field on `team_players`; see Open question below), optional note, submit → calls `captainAddProximityEntry`.
- Below leader, collapsible "Recent entries" list (most recent on top).
- Realtime: subscribe to `proximity_entries` filtered by tournament_id; on insert, invalidate the contest query so the leader/log refreshes.

## Leaderboard UI

In `src/routes/tournament.$id.tsx`, add a new "Proximity Contests" panel between the leaderboard table and the about section:

- One row per contest: hole number, name, sponsor (if any), eligibility badge, current leader (player + team + relative time).
- Click row → expands inline (or opens a dialog) with full history list: every entry in `entered_at desc` order with player, team, time, optional note.
- Realtime: same subscription as captain view to keep leader live.

## Eligibility for men/women

`team_players` has no gender field today. Two options:

1. Add `gender` text column to `team_players` (`male | female | unspecified`); captain edits it on the team page. Filter player picker by contest eligibility. **Recommended.**
2. Skip filtering — eligibility is informational only; captain self-polices. Faster to ship.

Default to option 1 — without gender filtering the men/women contests are unenforceable. Migration adds the column nullable with no default; captain UI exposes a simple select on each player.

## File changes

- New migration: `proximity_contests`, `proximity_entries`, RLS, GRANTs, realtime publication, `team_players.gender` column.
- New: `src/lib/proximity.functions.ts`
- Edited: `src/routes/admin.tournaments.$id.tsx` (proximity section)
- Edited: `src/routes/captain.team.$teamId.index.tsx` (per-hole proximity cards + player gender select on roster)
- Edited: `src/routes/tournament.$id.tsx` (leaderboard panel + history view)
- New small components: `src/components/proximity/contest-card.tsx`, `src/components/proximity/history-list.tsx`, `src/components/proximity/add-entry-dialog.tsx`.

## Out of scope (v1)

- Numeric measurement comparison ("longest" computed from yardage) — `note` is free text only; "most recent entry = current leader" matches the requested behavior.
- Multi-winner contests, ties.
- Photo proof attachments.
- Editing past entries (admins can delete + re-enter).
