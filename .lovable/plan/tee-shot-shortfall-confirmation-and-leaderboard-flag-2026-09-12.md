# Tee-shot shortfall confirmation and leaderboard flag

When a team has as many required tee shots left as holes remaining, every remaining hole must use a player who still owes tee shots. Today the app warns but still lets the captain save with anyone. This adds a confirmation step and a visible flag.

## Behaviour

1. Captain saves a hole while the tee-shot restriction is active and the selected tee-shot player is NOT one of the players who still need tee shots.
2. A confirmation dialog appears:
   - Title: "Tee-shot minimum at risk"
   - Body: names who still need tee shots, and states that saving this way means the team can no longer meet the minimum, so their score will be flagged on the leaderboard.
   - "Cancel, let me fix it" returns to the card so the captain can pick the right player.
   - "Save anyway" saves the hole and records the acknowledgement.
3. Once acknowledged, the team shows a flag on the leaderboard (small warning badge next to the team name) with a tooltip/label such as "Tee-shot minimum not met". The flag does not change the team's score or position.
4. Admins see the same flag on the team list and Live Ops, so they can resolve it manually if the captain corrects the tee shots later.
5. If the captain later edits earlier holes so the minimum can be met again, the flag clears automatically.

## Technical approach

- New nullable column `tee_shot_override` (boolean, default false) on `public.hole_scores`, set to true only on the hole where the captain confirmed. Migration is additive with grants unchanged.
- `HoleScorePayload` in `src/lib/offline-queue.ts` gains `tee_shot_override`, so the confirmation survives offline queueing and retries.
- `HoleCard` in `src/routes/captain.team.$teamId.index.tsx`:
  - compute `teeShotViolation = teeShotRestrictionActive && teeShotPlayerId && !playersNeedingTeeShots.some(p => p.id === teeShotPlayerId)`
  - in `save()`, run the new confirmation before the existing "unusual score" check, reusing the existing `SheetDialog` pattern.
  - pass `tee_shot_override: true` through `persist()` when confirmed.
- Leaderboard `src/routes/tournament.$id.tsx` already loads `team_players` and each hole's `tee_shot_player_id`. Team is flagged when any of its saved holes has `tee_shot_override = true` AND the current tee-shot counts still leave a player under `tee_shot_minimum` with fewer holes remaining than shortfall — this makes the flag self-clearing when corrected.
- Same derived helper is reused on the admin teams view so the rule lives in one place, with unit tests for: no violation, violation acknowledged, and violation later corrected.
- Regenerate Supabase types after the migration.

## Out of scope

- Automatic disqualification or score adjustment; the flag is informational only.
- Admin ability to override/clear the flag manually (it clears when the underlying data is corrected).
