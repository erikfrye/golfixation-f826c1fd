## Goal

Let captains keep scoring on flaky/no signal. Saves go to a local queue first, sync in the background when online, and the UI clearly shows what's pending.

## Behavior

**Saving a hole**
- "Save & next" always succeeds locally — write to an IndexedDB queue *and* optimistically update the React Query cache so the hole shows as scored immediately and the app advances to the next hole.
- If online, attempt a Supabase upsert right away. On success, remove from queue. On failure (network error / offline), leave it queued and show pending state.
- If offline, skip the network call entirely and queue.

**Sync engine**
- A small singleton (`src/lib/offline-queue.ts`) using IndexedDB (via `idb-keyval` — already lightweight, or a hand-rolled IndexedDB wrapper to avoid a new dep).
- Each queued item: `{ id, teamId, payload, attempts, lastError, queuedAt }`. `id = teamId:holeNumber` so re-edits of the same hole collapse to one pending write (latest wins).
- Auto-flush triggers: `online` event, app focus/visibility regained, app load, every ~20s while items remain, and immediately after enqueue when navigator is online.
- Per-item retry with backoff (e.g. 2s, 5s, 15s, 30s cap). Failures keep the item queued; only a Supabase response error that is clearly non-retryable (e.g. constraint violation) marks the item as `failed` for manual attention.
- Auth: queued writes use the existing `supabase` client which already holds the session; if the session is missing on flush, leave items queued.

**Late-edit reason flow**
- The reason dialog still triggers based on the *currently known* `first_saved_at`. If the original insert is itself still pending sync, no reason is required (treat as first save). Once synced, future lowering edits past the 15‑min window will prompt as today.

**UI indicators (captain screens only)**

1. **Global pill** in the team scoring header: `Online · all synced` / `Offline · N pending` / `Syncing N…` / `N failed — tap to retry`. Tap opens a small sheet listing pending holes with their strokes and last error; includes a "Retry now" button.
2. **Per-hole badge** on the hole picker grid and on the active hole card: a small dot/icon indicating `pending` (amber) or `failed` (red) for that hole. Synced holes look as they do today.
3. **Toast** on transition online → flushed (`All scores synced`) and offline (`You're offline — scores will sync when you reconnect`).

**Optimistic data**
- The `captain-scores` query merges server scores with queued items so totals, tee-shot counts, mulligan counts, "through N", and next-unplayed-hole logic all reflect pending writes. Pending items get a synthetic `id` and `first_saved_at = queuedAt` so the late-edit math stays consistent locally.
- Realtime/refetch from Supabase still wins for synced rows; pending items overlay until removed from the queue.

**Scope**
- Frontend only. No schema changes, no server function changes. RLS, audit trigger, and `last_edit_reason` plumbing all keep working unchanged — the queue simply replays the same `upsert` call the page makes today.
- Only the captain scoring route uses the queue. Admin and leaderboard views are unchanged.

## Files

- New `src/lib/offline-queue.ts` — IndexedDB-backed queue, singleton sync loop, subscribe API for React.
- New `src/hooks/use-offline-queue.ts` — React hook exposing `{ status, pendingByHole, failedByHole, retryAll }`.
- New `src/components/captain/sync-status-pill.tsx` — the header pill + details sheet.
- Edit `src/routes/captain.team.$teamId.index.tsx` — replace direct upsert in `persist()` with `queue.enqueue(...)`, merge pending items into `scores`, render the pill, add per-hole indicators on the picker + hole card.
- Edit `src/routes/captain.team.$teamId.tsx` (parent layout, if it has chrome) — only if needed to host the pill globally; otherwise keep the pill on the index route.

## Technical notes

- Use the browser `online`/`offline` events plus `document.visibilitychange` for flush triggers; treat `navigator.onLine === false` as a hint, not truth — always attempt and let failure re-queue.
- Storage key per team to avoid cross-team bleed if a captain manages multiple teams: `golfixation:queue:{teamId}`.
- Queue records store just the upsert payload (already serializable). No PII beyond what's already in the row.
- Guard SSR: only touch IndexedDB/`window` inside `useEffect` / lazy init.
- Keep the queue tiny — single file, no new deps; if IndexedDB feels heavy, fall back to `localStorage` keyed by team. IndexedDB is preferred for durability under iOS Safari memory pressure.

## Out of scope (call out, do not build)

- Offline reads of tournament/hole/player metadata. If the captain has never loaded the team while online, the page still needs network for first load.
- Conflict resolution when two devices edit the same hole — last write wins, same as today.
- Persistent queue across browser profile / device switches.