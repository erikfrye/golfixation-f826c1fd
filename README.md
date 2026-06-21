# Golfixation

> Real-time leaderboards and team scoring for golf tournaments.

Golfixation is a full-stack web application built for golf tournament organizers and team captains. It replaces paper scorecards with a live, collaborative scoring experience. Admins create and manage tournaments, while captains enter hole-by-hole scores from their phones—even offline. Spectators follow along with auto-updating leaderboards.

---

## What Problem It Solves

- **No more paper scorecards** — captains enter scores hole-by-hole on their phone.
- **Live leaderboard** — scores sync in real time so everyone can follow the action.
- **Works offline** — spotty signal on the course? Scores queue locally and sync when connectivity returns.
- **Admin oversight** — tournament organizers can audit scores, manage teams, and control access.

## Who It's For

- **Tournament organizers / admins** — create tournaments, assign teams, and monitor progress.
- **Team captains** — enter scores for their team as they play.
- **Spectators / players** — view live leaderboards and tournament standings.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19 + Vite + SSR) |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Backend / Auth | [Lovable Cloud](https://lovable.dev) (Supabase: Postgres + Auth + Realtime) |
| Hosting | Cloudflare Workers (via Wrangler) |
| Testing | Vitest + jsdom + Testing Library |

---

## Prerequisites

- **Node.js** ≥ 20 (or [Bun](https://bun.sh) — recommended, used in this project)
- **Bun** ≥ 1.1 (lockfile is `bun.lock`)
- A [Lovable Cloud](https://lovable.dev) account (Supabase backend with auth configured)
- (Optional) [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) for Cloudflare deploys

---

## Installation

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd golfixation

# 2. Install dependencies
bun install

# 3. Environment variables
# The project uses VITE_ prefixed variables for the Supabase client.
# In Lovable Cloud these are injected automatically. For local dev,
# copy .env (already present in Lovable projects):
cp .env .env.local   # edit if you need custom values
```

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (client-side) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (client-side) |
| `SUPABASE_URL` | Supabase project URL (server-side) |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side admin functions) |

> **Note:** In Lovable Cloud, `SUPABASE_SERVICE_ROLE_KEY` and the database password are managed by the platform and are not exposed to you directly.

---

## Quickstart

```bash
# Start the dev server
bun dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

1. **Log in** via the Login page (email + OTP or Google OAuth).
2. **As an admin** — navigate to `/admin` to create a new tournament.
3. **As a captain** — go to `/captain` and enter your team code to start scoring.
4. **View leaderboard** — visit the home page `/` to see live tournament standings.

---

## Usage

### Common Commands

```bash
# Development
bun dev                 # Start Vite dev server with SSR

# Building
bun run build           # Production build (Cloudflare Workers)
bun run build:dev       # Development build

# Preview
bun run preview         # Preview the production build locally

# Code quality
bun run lint            # ESLint
bun run format          # Prettier (write)

# Testing
bun run test            # Run all tests once
bun run test:watch      # Run tests in watch mode
bun run test:coverage   # Run tests with coverage report
```

---

## Project Structure

```
├── public/                       # Static assets (icons, manifest)
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # shadcn/ui primitives (Button, Card, Dialog, etc.)
│   │   ├── about-dialog.tsx      # Tournament / app about modal
│   │   ├── captain/
│   │   │   └── sync-status-pill.tsx
│   │   ├── install-prompt.tsx
│   │   ├── live-indicator.tsx
│   │   ├── theme-switcher.tsx
│   │   └── user-menu.tsx
│   ├── hooks/                    # Custom React hooks
│   │   ├── use-exit-animation.ts
│   │   ├── use-mobile.tsx
│   │   ├── use-offline-queue.ts
│   │   └── use-relative-time.ts
│   ├── integrations/
│   │   ├── lovable/              # Lovable platform integration
│   │   └── supabase/             # Supabase clients, auth middleware, types
│   ├── lib/                      # Business logic & server functions
│   │   ├── admin.functions.ts    # Admin CRUD server functions
│   │   ├── captain.functions.ts  # Captain scoring server functions
│   │   ├── offline-queue.ts      # Offline score queue logic
│   │   ├── error-capture.ts
│   │   ├── error-page.ts
│   │   └── utils.ts
│   ├── routes/                   # TanStack Start file-based routes
│   │   ├── __root.tsx            # Root layout (shell, meta, providers)
│   │   ├── index.tsx             # Home / tournament list
│   │   ├── login.tsx             # Authentication
│   │   ├── tournament.$id.tsx    # Public leaderboard
│   │   ├── tournaments.past.tsx  # Past tournaments archive
│   │   ├── admin.tsx             # Admin layout (protected)
│   │   ├── admin.index.tsx
│   │   ├── admin.tournaments.new.tsx
│   │   ├── admin.tournaments.$id.tsx
│   │   ├── admin.tournaments.$id_.teams.tsx
│   │   ├── admin.tournaments.$id_.audit.tsx
│   │   ├── captain.tsx           # Captain layout (protected)
│   │   ├── captain.index.tsx
│   │   ├── captain.team.$teamId.tsx
│   │   └── captain.team.$teamId.index.tsx   # Hole-by-hole scoring UI
│   ├── test/                     # Test utilities
│   │   ├── setup.ts              # Vitest setup (jsdom, mocks)
│   │   └── helpers.ts            # Test helpers & mock factories
│   ├── router.tsx                # TanStack Router bootstrap
│   ├── server.ts                 # Cloudflare Worker SSR entry point
│   ├── start.ts                  # TanStack Start config (middleware)
│   ├── styles.css                # Tailwind theme + custom keyframes
│   └── routeTree.gen.ts          # Auto-generated (do not edit)
├── supabase/
│   └── migrations/               # Database migrations (managed by Lovable Cloud)
├── .env                        # Environment variables
├── bun.lock                    # Bun lockfile
├── components.json             # shadcn/ui configuration
├── package.json
├── tsconfig.json
├── vite.config.ts              # Vite + TanStack Start config
├── vitest.config.ts            # Test configuration
└── wrangler.jsonc              # Cloudflare Workers deployment config
```

---

## Key Architecture Decisions

### File-Based Routing
Routes live in `src/routes/` and are auto-registered by TanStack Router. The file name maps directly to the URL path:
- `src/routes/index.tsx` → `/`
- `src/routes/admin.tournaments.$id.tsx` → `/admin/tournaments/:id`
- `src/routes/captain.team.$teamId.index.tsx` → `/captain/team/:teamId`

### Server Functions
App-internal backend logic uses `createServerFn` from `@tanstack/react-start`. These are typed RPC calls, not REST endpoints. Examples:
- `src/lib/admin.functions.ts` — tournament CRUD, team management, role checks
- `src/lib/captain.functions.ts` — score submission, team lookup

### Authentication & Authorization
- **Auth** — Supabase Auth with email OTP and Google OAuth.
- **Roles** — stored in a separate `user_roles` table (not on the user profile).
- **Row Level Security (RLS)** — all tables have RLS enabled with policies scoped to `auth.uid()`.
- **Admin guard** — server functions verify admin status via a `has_role` security-definer function.

### Offline-First Scoring
Captains can enter scores without connectivity. The `useOfflineQueue` hook stores pending scores in `localStorage` and retries them in the background. A sync status pill shows the queue state.

### Realtime Leaderboard
Active tournaments broadcast score changes over Supabase Realtime. The home page leaderboard subscribes to these updates automatically.

---

## Testing

Tests are co-located next to the code they verify:

```
src/lib/__tests__/
├── admin.functions.test.ts
├── captain.functions.test.ts
├── gen-code.test.ts
└── offline-queue.test.ts
```

Run the suite:

```bash
bun run test
```

Tests use **Vitest** + **jsdom** + **@testing-library/react**. Server function handlers are tested in isolation with mocked Supabase clients—no real database calls during unit tests.

---

## Deployment

This project deploys to **Cloudflare Workers** via Lovable's built-in publish flow.

- **Preview URL**: `https://id-preview--<your-id>.lovable.app`
- **Production URL**: `https://golfixation.lovable.app` (or your custom domain)

The `wrangler.jsonc` configures the Worker entry point at `src/server.ts` with `nodejs_compat` enabled for SSR compatibility.

---

## License

[MIT](LICENSE) — or replace with your preferred license.

---

.

<p align="center">
  Built with <a href="https://lovable.dev">Lovable</a> · Powered by <a href="https://tanstack.com/start">TanStack Start</a> + <a href="https://supabase.com">Supabase</a>
</p>
