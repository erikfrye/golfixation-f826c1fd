# Anti-Cheat & Score Integrity Plan

Today, captains can freely insert/update/delete `hole_scores` while the tournament is `active`. That's necessary for corrections, but it's also the cheat surface. The fix isn't to lock editing — it's to make edits **visible, attributable, and reviewable**.

Below are tiered options, lightest to heaviest. They stack; pick any combination.

## Tier 1 — Detection (audit trail)

The single highest-leverage change. Without it, nothing else matters.

- New table `hole_score_audit` (append-only): `id`, `tournament_id`, `team_id`, `hole_number`, `action` (`insert`/`update`/`delete`), `old_strokes`, `new_strokes`, `old_tee_shot_player_id`, `new_tee_shot_player_id`, `old_mulligan_player_id`, `new_mulligan_player_id`, `changed_by` (auth.uid), `changed_by_email`, `changed_at`, `client_ip` (optional, from server fn), `user_agent` (optional).
- Postgres trigger on `hole_scores` (AFTER INSERT/UPDATE/DELETE) writes to the audit table using `auth.uid()` and `auth.jwt() ->> 'email'`.
- RLS: only admins can SELECT; nobody can UPDATE/DELETE. Captains can't even read their own audit log (prevents tailoring edits).
- Admin UI: a "Score history" tab per team showing every change with timestamp, who, before → after, and a filter for "edits made >X minutes after first entry".

This alone deters most cheating because captains know edits are logged.

## Tier 2 — Friction on suspicious edits

Make late edits possible but visible to everyone.

- **Lock window**: after a hole's score is first saved, allow free edits for N minutes (e.g. 15). After that, edits still work but get flagged `was_late_edited = true`.
- **Public leaderboard badge**: a small "✎ edited" icon next to any hole that was changed after the lock window. Tap to see "Edited 2h after submission". Pure social pressure — extremely effective.
- **Edit reason required**: after the lock window, captains must enter a short reason ("miscounted on hole 4"). Stored in audit.

## Tier 3 — Cross-verification

Require a second party to confirm.

- **Opponent attestation**: each team's score on a hole is "pending" until another team in the same group taps "confirm". Adds a small workflow but mirrors how paper scorecards work (marker signs the card).
- **Admin approval for late edits**: edits outside the lock window go into a `pending_edits` queue and don't affect the leaderboard until an admin approves. Heavier but bulletproof.

## Tier 4 — Lock on completion

- Add a per-team "round submitted" action. Once submitted, captain can no longer edit — only admin can, and every admin edit is audited and flagged on the leaderboard.
- Auto-submit when all holes have a score.

## Recommendation

Start with **Tier 1 + the "edited" badge from Tier 2**. That's ~1 migration (audit table + trigger + RLS), one admin "Score history" view, and a small badge on the public leaderboard. It's low friction for honest teams, gives you full forensics, and the visible badge is the actual deterrent.

If you want stronger guarantees later, layer in the lock window / edit reason, and eventually round submission.

## Technical sketch (for the implementation phase)

- Migration: `hole_score_audit` table + `audit_hole_scores()` trigger function + admin-only RLS.
- Optional column on `hole_scores`: `first_saved_at timestamptz` (set on INSERT, never updated) so the UI can compute "edited X after submission" without joining the audit table.
- Admin route: `/admin/tournaments/$id/audit` listing changes, filterable by team/hole/late-only.
- Leaderboard: query `hole_scores.updated_at > first_saved_at + interval '15 min'` to render the badge.

---

**Which tiers do you want me to build?** My suggestion: Tier 1 audit + the "edited" badge as a first pass, then we see if anything else is needed after the next tournament.
