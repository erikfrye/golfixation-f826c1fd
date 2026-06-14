## Goal

When a captain saves a score (or taps Prev/Next/picker) on the captain scoring view, the current hole card should slide out to the left while the next hole card slides in from the right. This gives clear visual feedback that the score landed and the app moved on.

## Where it lives

Only one screen needs to change: `src/routes/captain.team.$teamId.index.tsx`, around the `<HoleCard key={activeHole.hole_number} ... />` block (~line 340–367). No business logic, server-function, or query changes.

## Approach

Keep the existing `currentHole` state as the source of truth. Add a thin presentation wrapper that owns the transition:

1. Add two CSS keyframes in `src/styles.css` next to the existing modal/sheet animations:
   - `hole-slide-in-right` — translateX(24px) + opacity 0 → translateX(0) + opacity 1
   - `hole-slide-out-left` — translateX(0) + opacity 1 → translateX(-24px) + opacity 0
   - Plus `.animate-hole-in` / `.animate-hole-out` utility classes (~220ms / ~180ms, same easing curve as the existing `modal-in`).
   - Also add a `hole-slide-in-left` / `hole-slide-out-right` pair so going backward (Prev) slides the opposite direction. Small polish, same pattern.

2. Introduce a small `AnimatedHole` component inside the same route file (kept local — it is pure presentation). It:
   - Takes `holeNumber` plus the rendered `<HoleCard>` as `children`.
   - Tracks `displayedHole` and a `direction` ("forward" | "back").
   - When `holeNumber` prop changes, sets a `leaving` flag, waits for the out animation (~180ms via `setTimeout`), then swaps `displayedHole` to the new value and clears `leaving` so the new card mounts with the in animation.
   - Picks direction by comparing new vs previous hole_number (wrap-aware: use the same `wrap()` helper already in the file so 18 → 1 still counts as "forward").
   - Renders a single child at a time inside a `relative overflow-hidden` wrapper so the sliding element does not cause horizontal page scroll on mobile.

3. Replace the current `<HoleCard ... />` usage with `<AnimatedHole holeNumber={activeHole.hole_number} direction={...}> <HoleCard ... /> </AnimatedHole>`. Keep `key={activeHole.hole_number}` on the inner `HoleCard` so its internal form state still resets per hole.

4. Respect `prefers-reduced-motion`: in the keyframes section, wrap the slide animations in `@media (prefers-reduced-motion: reduce)` to collapse to a simple opacity fade (or no animation). This matches accessibility expectations and avoids motion sickness for users who opt out.

## Why this over alternatives

- **Pure CSS + a tiny stateful wrapper** matches the patterns already in this project (`useExitAnimation`, `animate-modal-in/out`, `animate-sheet-in/out` in `styles.css`). No new dependency.
- **Framer Motion / `motion` package** would also work and gives `AnimatePresence` for free, but it is a ~50KB add for one transition on one screen — not worth it given existing CSS-animation conventions.
- Keeping the wrapper local to the captain route avoids growing the shared component surface for a single use site. If a second screen ever needs the same effect we can promote it to `src/components/`.

## Out of scope

- No changes to score-save logic, queue, realtime subscription, or `HoleCard` internals.
- No changes to the bottom nav bar styling, the hole picker sheet, or the leaderboard view.
- No new tests — this is presentational. Existing tests are unaffected.

## Files touched

- `src/routes/captain.team.$teamId.index.tsx` — add `AnimatedHole` component, wrap `HoleCard`, track previous hole for direction.
- `src/styles.css` — add 4 keyframes + 4 utility classes + reduced-motion override.
