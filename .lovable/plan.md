## Problem

In `src/routes/captain/team/$teamId/index.tsx`, when the captain opens the scoring page (or returns to it after backgrounding the browser), the active hole resets to the team's `start_hole`. That's correct on a fresh round, but as the team progresses it should resume at the first uncompleted hole instead of jumping back to the start.

## Fix

Update the initial-hole logic in `TeamScoring` so that when `currentHole` is `null` and data has loaded, we pick the resume hole based on scoring progress:

1. Start from `team.start_hole`.
2. Walk forward around the course (wrapping at `tournament.num_holes`) and return the first hole that does not yet have an entry in `scoreByHole`.
3. If every hole has a score (round complete), fall back to `team.start_hole` so the captain lands on a sensible place to review.
4. If no scores exist yet, behavior is unchanged — lands on `start_hole`.

Implementation notes:
- Replace the current `useEffect` that sets `currentHole` from `team.start_hole` with one that also waits for `tournamentQ.data` and `scoresQ.data` to be loaded, then computes the resume hole using the wrap helper already used for next/prev navigation.
- Only auto-set when `currentHole === null`. Once the captain manually navigates (Next, Previous, hole picker), we keep their choice for the session — same as today.
- No schema changes, no server-function changes. Pure client logic in this one file.

## Out of scope

- Persisting the last-viewed hole across reloads (we always derive from actual saved scores, which is more reliable than localStorage).
- Any other captain-flow changes.
