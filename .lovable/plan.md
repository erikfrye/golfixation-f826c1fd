## Live Ops Dashboard

A single screen per active tournament that surfaces four real-time health signals so admins can spot stalled rounds, edit storms, and code abuse without digging through pages.

### Where it lives

New route: `src/routes/admin.tournaments.$id_.liveops.tsx` (sibling to the existing `_.audit` and `_.teams` admin sub-pages). A new "Live ops" button on the admin tournament edit page links to it, alongside Score history and Manage teams.

### The four panels

1. **Teams not yet scoring** — teams in the tournament with zero rows in `hole_scores`. Shows team name + captain email + assigned start hole (shotgun) so admins can chase them down.
2. **Stalled holes (no submission in 30+ min)** — for every `(team_id, hole_number)` pair the team is "currently on" (their next un-scored hole given their start_hole), compute time since the team's most recent `hole_scores.updated_at`. Flag any team whose last activity was 30+ minutes ago, or who started 30+ min ago and has no scores at all. Listed as team → hole-they're-stuck-on → minutes idle.
3. **Late-edit count (today)** — count of `hole_score_audit` rows where `action='update'` AND `changed_at::date = today (tournament local)`. Show the count plus the 10 most recent edits (team, hole, old→new strokes, who, when, reason).
4. **Override-code redemptions today** — count of redemptions recorded today for this tournament's code. Requires a new `override_code_redemptions` table since redemptions aren't logged anywhere today.

### Data model change

New table for #4:

```
override_code_redemptions
- id uuid pk
- tournament_id uuid fk → tournaments (cascade)
- captain_email text (lowercased)
- team_id uuid fk → teams (set null) — resolved at redeem time when matchable
- success boolean — true on issued magic link, false on bad-email/bad-code
- failure_reason text nullable
- redeemed_at timestamptz default now()
- ip text nullable, user_agent text nullable
```

Indexes: `(tournament_id, redeemed_at desc)`. RLS: admins SELECT, service_role ALL; no anon/authenticated access. Insert happens inside the existing service-role `redeemOverrideCodeHandler` after looking up the tournament — we log both success and known failure cases (invalid code → no tournament_id so the row is skipped; wrong-email-for-valid-code → logged against that tournament).

### Server functions

New `src/lib/liveops.functions.ts`, all admin-only (verify `is_admin(auth.uid())` inside each handler, same pattern as other admin functions):

- `adminLiveOpsSummary({ tournamentId })` → returns `{ teamsNotScoring: TeamMini[], stalledTeams: StalledTeam[], lateEditCountToday, recentLateEdits: AuditRow[], redemptionsToday, recentRedemptions: RedemptionRow[] }`. One round-trip; all four panels render off it.

The "currently on" hole for a team is computed as: starting from `start_hole`, walk forward through hole numbers (wrapping at `num_holes`) and return the first hole the team has no `hole_scores` row for. If all 18 are scored, the team is done and excluded from #2.

`captain.functions.ts.redeemOverrideCodeHandler` gets an insert into `override_code_redemptions` at the end (success path) and in the two `throw new Error` branches (failure paths) — failure path needs to look up the tournament by code first (already does), and skip logging when code itself is invalid (we don't know which tournament to attribute to).

### UI

`admin.tournaments.$id_.liveops.tsx`:
- Page header: tournament name + "Live" pulse + back link to the edit page.
- 4-card responsive grid (1 col mobile, 2 col tablet, 4 col desktop) showing big-number counts.
- Below: two columns of detail panels — left "Teams to chase" (combines #1 + #2 list), right "Activity" (late edits + redemptions stacked).
- Auto-refresh: `useQuery` with `refetchInterval: 30_000` on the summary fn. Plus a Supabase Realtime subscription to `hole_scores` and `hole_score_audit` filtered by `tournament_id` that triggers `queryClient.invalidateQueries` so big changes show up immediately.
- Empty states for each panel ("All teams are scoring", "No stalled holes", "No edits today", "No redemptions today").

Link from `admin.tournaments.$id.tsx` header: new "Live ops" button next to Score history and Manage teams, visible only when `status === 'active'` (and faded/disabled for draft/completed tournaments).

### Out of scope (v1)

- Push notifications / SMS to captains who are stalled.
- Editable threshold for "stalled" (hard-coded 30 min for v1).
- Per-hole heatmap of activity (could come later — for now the team-level list is enough to act on).
- Backfill of historical redemptions (the log starts empty).
