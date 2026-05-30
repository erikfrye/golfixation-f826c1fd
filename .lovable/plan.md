## Goal
When the live leaderboard updates (via the existing realtime subscription), give viewers a brief visual cue for what changed:
- A row flashes when its **position** changes (moved up or down).
- An expanded score cell flashes when its **strokes** change (new score, edited score).

## What changes

### 1. Track previous values
In `TournamentPage`, alongside `leaderboard`, keep a ref of the previous rank-per-team and previous strokes-per-(team, hole). On each recompute, diff against the previous snapshot to produce two ephemeral sets:
- `changedRanks: Map<teamId, "up" | "down">`
- `changedScores: Set<"teamId:holeNumber">`

These get cleared after the highlight animation finishes (~1.5s) via `setTimeout`. The very first computation (initial load) seeds the snapshot but produces no highlights — we only flash on actual deltas.

### 2. Pass highlights into rows
`ScoreRow` gets two new optional props:
- `rankChange?: "up" | "down"` — drives a row-level flash.
- `changedHoles?: Set<number>` — drives per-cell flashes inside the expanded table.

### 3. Animation styles (theme-aligned)
Add two short keyframes to `src/styles.css` (matching the existing modal/sheet animation block):
- `row-flash-up` — background fades from `color-mix(in oklab, var(--primary) 18%, transparent)` to transparent over ~1.4s.
- `row-flash-down` — same, using `--accent` (warm sand) so a drop reads differently from a climb without leaning on red.
- `cell-flash` — score cell briefly pulses with a soft `--primary` ring + background tint, then fades, ~1.2s.

All three use `ease-out` and `forwards` so they settle cleanly. Colors come from existing semantic tokens — no new palette entries.

### 4. Behavior notes
- Highlight only triggers from realtime/refetch deltas, not from expand/collapse or initial render.
- If a row both changes rank and has a changed cell while expanded, both animations play independently.
- Ties (`T3`) are compared on the numeric rank only; gaining/losing the `T` prefix without a rank number change does not flash.
- New teams appearing or teams with their first score sort in without a flash (no prior rank to compare).

## Open questions
1. **Color for rank-down**: use accent (sand/amber) as proposed, or keep it neutral (muted) so it reads as "just changed" without implying negative? Up = primary green either way.
2. **Cell flash scope**: only flash cells visible in the currently expanded row, or queue the flash and play it when the user expands that row within a short window? Simpler is "only if expanded right now".
3. **Duration**: 1.4s for rows / 1.2s for cells feels tasteful given the existing 200ms modal timings. OK, or do you want it snappier (~700ms) or longer (~2s)?

## Files touched
- `src/routes/tournament.$id.tsx` — diff tracking, prop wiring, conditional classes on the row `<button>` and on each `<td>` score cell.
- `src/styles.css` — three new keyframes + utility classes (`animate-row-flash-up`, `animate-row-flash-down`, `animate-cell-flash`).

No DB, RLS, or server-function changes.
