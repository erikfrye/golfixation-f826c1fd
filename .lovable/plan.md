## What we're building

When a captain saves a score in the hole entry sheet, compare strokes to par and trigger a short full-viewport overlay animation:

| Diff vs par | Tier | Animation | Sound |
| --- | --- | --- | --- |
| Hole-in-one (strokes = 1) | `ace` | Large eagle silhouette streaks across with gold confetti + sparkle burst, "ACE!" badge | triumphant chord |
| ≤ -2 (eagle / albatross) | `eagle` | Eagle glides across, medium confetti trail | bright chirp + whoosh |
| -1 (birdie) | `birdie` | Small sparrow flutters across, light confetti puff | single chirp |
| ≥ +1 (bogey or worse) | `oof` | Tiny cartoon bird "drops" / sad-trombone wobble at bottom corner, no confetti | soft "oof" |
| Par | none | — | — |

Each animation is ~1.2–1.8s, pointer-events-none, dismissable by tap. Respects `prefers-reduced-motion` (replaces motion with a brief fade-in badge). Skipped on score *edits* where the diff hasn't changed (so editing a saved birdie's note doesn't re-trigger).

## UX details

- Overlay renders in a portal at document body so it floats above the hole sheet/modal.
- Bird is an inline SVG component (no asset pipeline, scales crisply, themeable via `currentColor`). Confetti is ~25 absolutely-positioned divs with randomized translate/rotate via CSS custom properties.
- A small mute toggle (speaker icon) lives in the captain header next to the existing sync pill. State persisted in `localStorage` under `golfixation:celebrate-muted`. Default = unmuted.
- Sounds: short royalty-free clips committed under `src/assets/sfx/` (chirp.mp3, whoosh.mp3, fanfare.mp3, oof.mp3). Played via a single shared `HTMLAudioElement` pool; muted if toggle off or if `prefers-reduced-motion`.

## Tech approach

Pure CSS keyframes + a tiny React component — no new dependencies. Fits the existing animation patterns already in `src/styles.css` (modal-in, hole-slide, row-flash, etc.).

## Files

**New**
- `src/components/captain/score-celebration.tsx` — `<ScoreCelebration tier={...} onDone={...} />` portal component. Renders the bird SVG + confetti, manages timeout, plays audio.
- `src/components/captain/bird-svg.tsx` — small/medium/large bird SVG variants.
- `src/hooks/use-celebrate-mute.ts` — localStorage-backed mute toggle hook.
- `src/lib/score-celebration.ts` — `tierForScore(strokes, par)` pure helper + unit-testable. Includes test file `src/lib/__tests__/score-celebration.test.ts`.
- `src/assets/sfx/{chirp,whoosh,fanfare,oof}.mp3` — short SFX (~15-30KB each).

**Edited**
- `src/styles.css` — add keyframes: `bird-fly-across`, `bird-fly-small`, `bird-drop`, `confetti-fall`, `sparkle-pop`, plus reduced-motion fallbacks.
- `src/routes/captain.team.$teamId.index.tsx` — in the hole-entry sheet's save handler (around the `save()` function near line 760), after a successful save: compute tier from `strokes` vs `hole.par`; if non-null and the tier differs from any previously-saved tier for that hole, set local state `celebration` that renders `<ScoreCelebration>`.
- `src/routes/captain.team.$teamId.tsx` (header) — add the mute speaker icon button next to the sync pill.

## Trigger logic (precise)

In the hole sheet's save handler:
```
const prevTier = existing ? tierForScore(existing.strokes, hole.par) : null;
const newTier  = tierForScore(strokes, hole.par);
if (newTier && newTier !== prevTier) setCelebration(newTier);
```
This ensures an upgrade (par → birdie) celebrates, a fix (eagle → birdie) celebrates with the new tier, and unrelated edits (note change, same tier) don't re-fire.

## Out of scope

- No leaderboard-side animations (only the captain entering the score sees it).
- No per-tournament toggle in admin — single global mute on the device.
- No haptics (can add later if requested).
