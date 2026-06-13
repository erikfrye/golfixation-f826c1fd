## Goal
Establish a first test safety net covering: (1) test tooling, (2) pure-logic unit tests for `offline-queue` + `genCode`, (3) server-function contract tests with a mocked Supabase admin client.

## 1. Tooling

Install dev deps:
- `vitest`, `@vitest/coverage-v8`
- `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`
- `jsdom`, `happy-dom` (use `jsdom`)

Add to `package.json` scripts:
- `"test": "vitest run"`
- `"test:watch": "vitest"`
- `"test:coverage": "vitest run --coverage"`

Create `vitest.config.ts` with:
- `environment: "jsdom"`
- `globals: true`
- `setupFiles: ["./src/test/setup.ts"]`
- Path alias `@` → `./src` (mirroring tsconfig)
- `include: ["src/**/*.{test,spec}.{ts,tsx}"]`

Create `src/test/setup.ts`:
- imports `@testing-library/jest-dom`
- stubs `localStorage` (jsdom provides it, no-op)
- silences `navigator.onLine` toggling helper

Create `src/test/helpers.ts`:
- `mockSupabaseAdmin()` — factory returning a chainable jest-style mock for `.from().select()/.insert()/.eq()/.maybeSingle()/.order()/.ilike()/.upsert()` plus `.auth.admin.generateLink()`. Each method returns `this` until a terminal awaited call resolves with a configured `{ data, error }`.
- `mockRequireSupabaseAuthContext({ userId, email })` — used by handler invocations.

Update `tsconfig.json` `types` to include `vitest/globals` and `@testing-library/jest-dom`.

## 2. Pure-logic unit tests

### `src/lib/__tests__/offline-queue.test.ts`
Covers `TeamQueue` via `getQueueForTeam`. Mock `@/integrations/supabase/client` so `supabase.from().upsert()` and `supabase.auth.getSession()` are controllable. Use fake timers.
- enqueue: new item is created with `status=pending`, persisted to `localStorage`, listener fires.
- enqueue dedupe: re-enqueueing same `team_id:hole_number` replaces payload, resets attempts, keeps original `queuedAt`.
- removeByHole: removes matching item and persists.
- flush success: when online + session present, upsert called with payload, item removed, `lastSyncedAt` updated.
- flush failure with retry/backoff: upsert returns error → item stays, `attempts` increments, `nextAttemptAt` follows `BACKOFFS` sequence (2s, 5s, 15s, 30s, 30s).
- offline guard: `navigator.onLine=false` → no upsert attempted.
- no-session guard: `getSession` returns null → no upsert attempted.
- retryAll: resets failed/scheduled items to pending immediately.
- subscribe/snapshot: notifies on changes; cached snapshot identity changes only after mutation.

### `src/lib/__tests__/gen-code.test.ts`
`genCode` isn't exported. Re-export it from `admin.functions.ts` as `export function genCode` so tests can import it without invoking server-fn machinery.
- default length 6.
- only uses allowed alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no I/O/0/1).
- 10k samples have reasonable distribution (no duplicates > expected).

## 3. Server-function contract tests

Server functions built with `createServerFn` aren't trivially invokable in unit tests (they wrap handlers with middleware). Strategy: extract each handler body into a plain async function (e.g. `cloneTournamentHandler({ admin, userId, data })`) and have the `createServerFn` `.handler()` call that function. This lets tests exercise pure handler logic with a mocked admin client and synthesized context.

Refactor `src/lib/admin.functions.ts` and `src/lib/captain.functions.ts`:
- Pull each handler body into an exported async function.
- Keep `assertAdmin` exported.
- Keep `getAdminClient` as the default client provider; pass a client into handlers (dependency injection) for testability.

### `src/lib/__tests__/admin.functions.test.ts`
Using `mockSupabaseAdmin()`:
- `assertAdmin`: throws "Forbidden" when no row; passes when row exists.
- `adminListTournaments`: throws if not admin; returns rows on success; surfaces query error.
- `adminGetTournament`: validates `id` is uuid (zod); returns row.
- `adminListTeams`: admin gate; returns ordered rows.
- `listMyCaptainTeams`: returns `[]` when no email claim; uses `ilike` with lowercased email; bubbles error.
- `adminGetScoreAudit`: admin gate; returns `{ entries, teams, players }`; rejects on any sub-query error.
- `adminCloneTournament`:
  - throws when source missing.
  - clones settings: new row has `status="draft"`, `created_by=userId`, fresh `override_code` (6 chars from alphabet).
  - copies all holes 1:1 to new tournament_id.
  - skips hole insert when source has zero holes.
  - propagates insert error.

### `src/lib/__tests__/captain.functions.test.ts`
- `redeemOverrideCode`:
  - zod rejects bad email / short code.
  - normalizes code (uppercase) and email (lowercase) before lookup.
  - "Invalid override code" when tournament missing.
  - "Email is not registered…" when team missing.
  - success returns `{ tokenHash, email, tournamentName, teamName }`.
  - `generateLink` error surfaces.

## Out of scope (deferred to a later PR)

- Component tests (`UserMenu`, `ThemeSwitcher`, login page)
- Route smoke tests
- Playwright e2e
- pgTAP/RLS tests

## Files to add

- `vitest.config.ts`
- `src/test/setup.ts`
- `src/test/helpers.ts`
- `src/lib/__tests__/offline-queue.test.ts`
- `src/lib/__tests__/gen-code.test.ts`
- `src/lib/__tests__/admin.functions.test.ts`
- `src/lib/__tests__/captain.functions.test.ts`

## Files to modify

- `package.json` — scripts + devDeps
- `tsconfig.json` — `types` additions; include `src/test` and test files
- `src/lib/admin.functions.ts` — export `genCode`, extract handler bodies into testable functions
- `src/lib/captain.functions.ts` — extract handler body into testable function

## Verification

- `bun run test` passes all suites.
- `bun run build` still succeeds (no behavior changes; refactors keep server-fn exports intact).
