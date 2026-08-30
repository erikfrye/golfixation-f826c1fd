# Tournament-day sizing + disk cleanup

Good news first: almost none of your disk usage is real app data. I checked the database and found the actual cause.

## What's actually filling the disk

| Item | Size |
| --- | --- |
| Background-job run history (`cron.job_run_details`) | ~1,254 MB |
| All of your tournament data combined (scores, teams, players, audit, contests) | under 1 MB |

The email queue runs a background job every 5 seconds, and the database has been keeping a permanent log row for every single run since it was set up. That log — not your tournaments — is ~99.9% of the used space. Your real data is 9 tournaments, 19 teams, 271 hole scores, 217 audit rows.

## Step 1 — Purge and cap the job history

- Delete job-run history older than 2 days.
- Add a small scheduled maintenance job that trims that history daily, so it can never balloon again.

Expected result: data-disk usage drops from ~79% to a low single-digit percentage. No disk resize should be needed after this.

## Step 2 — Cascade cleanup when a tournament is deleted

I verified the foreign keys: deleting a tournament **already** cascades and removes its teams, players, holes, hole scores, proximity contests, proximity entries and override-code redemptions. Two gaps remain:

- `hole_score_audit` has no foreign key, so audit rows for deleted tournaments are orphaned forever. Add a cascade so the audit trail is cleaned up with the tournament.
- There's no delete button in the admin UI today. Add "Delete tournament" to the admin tournament list, guarded by a confirmation dialog that makes the user type the tournament name, and blocked for tournaments with status `active` (you can only delete drafts and completed events).

## Step 3 — Clear out the test data

Once delete exists, you delete the test tournaments yourself from the admin list — that is the safe path, since only you know which of the 9 are real. If you'd rather I remove specific ones, tell me which and I'll do it directly.

Also included: trim `email_send_log` rows older than 90 days on the same daily maintenance job.

## Step 4 — Instance size for the event

For 16 captains scoring live and ~64 spectators on the leaderboard, the pressure is on memory and realtime connections, and Tiny is at 63% memory while idle. Recommendation: resize compute to **Small** before tournament day. Skip the disk resize — Step 1 makes it unnecessary.

## Technical notes

- Migration: `DELETE FROM cron.job_run_details WHERE end_time < now() - interval '2 days'`, plus a `cron.schedule` nightly maintenance job that repeats that trim and prunes `email_send_log`.
- Migration: add `hole_score_audit.tournament_id` FK to `tournaments(id) ON DELETE CASCADE` after clearing any existing orphan rows.
- New server function `adminDeleteTournament` in `src/lib/admin.functions.ts` (admin-gated via `assertAdmin`, rejects `status = 'active'`), with unit tests in `src/lib/__tests__/admin.functions.test.ts`.
- UI: delete action + typed-name confirmation dialog in `src/routes/admin.index.tsx`.
- Compute resize is a separate approval card in Lovable Cloud; I'll open it when you're ready.
