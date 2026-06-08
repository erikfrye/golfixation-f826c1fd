# Setup bug fixes

## Bug 1 — Mulligans field not saving (admin Teams page)

File: `src/routes/admin.tournaments.$id_.teams.tsx`

The mulligans `onBlur` calls `updatePlayer(p.id, { mulligans_total: n })`, but the function swallows any Supabase error silently, so RLS rejections / value coercion issues vanish without a trace.

- Make `updatePlayer` (and the other admin mutations on this page) check `error` from Supabase and `alert(error.message)` on failure, matching the style used elsewhere in the file.
- Coerce the input safely: use `Number.isFinite(parsed) ? Math.max(0, parsed) : 0` so an empty/garbled blur can't smuggle in `NaN` or a string.
- Switch the mulligans input from uncontrolled `defaultValue` + closure-captured `p.mulligans_total` to a `key={p.mulligans_total}` + `defaultValue` pattern so a successful save visibly refreshes the value, confirming the round-trip.

This both fixes silent failures (so we see why Erik's row isn't updating) and makes a successful update visually reflect on the row.

## Bug 2 — Auto-select mulligans value on focus

File: `src/routes/admin.tournaments.$id_.teams.tsx`

Add `onFocus={(e) => e.target.select()}` to the mulligans `<input>` (same pattern already used on the start_hole input and the par editor). Typing a number now overwrites the existing value.

## Bug 3 — Advance focus to next hole in par editor

File: `src/routes/admin.tournaments.$id.tsx` (Hole pars grid, ~line 252)

After a par value is committed for hole N, move keyboard focus to hole N+1's input so the admin can tab/type straight through the course.

- Convert the par inputs to use `ref`s stored in an array keyed by hole index.
- On `Enter` or `blur` (whichever finishes editing), focus the next input via `refs[idx + 1]?.focus()` and let the existing `onFocus` `select()` handler pre-select its value.
- Wrap behavior: stop at the last hole (no wrap to hole 1) to avoid surprising loops.

## Out of scope

- No DB / RLS changes — current admin policies on `team_players` already allow the update; we're only surfacing the error if one happens.
- No changes to the captain scorecard flow.
