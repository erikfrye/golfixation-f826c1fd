# Tournament score exports

Give admins a way to take a finished (or in-progress) tournament out of the app: a spreadsheet file and a printable/downloadable scorecard modeled on a classic paper score sheet, branded Golfixation.

## Where it lives

A new "Export" button on the tournament edit page (next to Score history / Manage teams / Live ops) opens a new admin page: `/admin/tournaments/{id}/export`.

That page shows the branded scorecard on screen, with three buttons:
- Download spreadsheet (CSV, opens directly in Excel/Numbers/Sheets)
- Download image (PNG of the scorecard)
- Print / Save as PDF (uses the browser's print dialog with a clean print layout)

## The scorecard

Layout follows the attached paper sheet:
- Header band with the Golfixation logo and name, tournament name, course/location and date.
- Column headers: hole numbers 1-9, OUT, 10-18, IN, GROSS (handicap/net columns omitted — the app tracks gross only).
- One row per team, team name on the left, strokes per hole, sub-totals and gross total.
- A par row so the sheet reads like a real card.
- Teams sorted by gross score; unplayed holes left blank.
- For 9-hole tournaments only the front nine and total are shown.
- A second block below lists proximity contest winners (hole, contest name, winning player and team).

Styling uses the app's existing colors and fonts so it looks like Golfixation, not a generic table.

## The spreadsheet (CSV)

One file per tournament containing:
1. Tournament header rows (name, location, date, format).
2. The same scorecard grid: team, per-hole strokes, OUT/IN, gross.
3. A team roster section listing each team's players.
4. A proximity contest winners section.

Filename: `golfixation-{tournament-name}-{date}.csv`.

## Technical notes

- New server function `adminExportTournament` in `src/lib/admin.functions.ts`: admin-verified, returns tournament + holes (pars) + teams + players + hole scores + proximity contests and their winning entries in one payload. Reuses the existing `assertAdmin` pattern and the proximity ordering rules (round_position desc, entered_at desc) already used on the leaderboard.
- New `src/lib/export-scorecard.ts` with pure helpers: build the grid rows (per-hole strokes, OUT/IN/GROSS), pick proximity winners, and serialise to CSV. Unit tested with Vitest alongside existing `src/lib/__tests__` files.
- New route `src/routes/admin.tournaments.$id_.export.tsx` rendering `ScorecardSheet` plus the three action buttons.
- New `src/components/export/scorecard-sheet.tsx` — the visual card, also used for PNG and print.
- PNG: add the `html-to-image` package and capture the scorecard node at 2x scale.
- Print: a print stylesheet block that hides app chrome and prints the sheet landscape on one page.
- Link added on `src/routes/admin.tournaments.$id.tsx`.

## Out of scope

- Handicap / net scoring (no handicap data exists per team today).
- True .xlsx files — CSV opens in Excel and avoids a heavyweight dependency.
- Server-side PDF generation; the print dialog produces the PDF.
- Exports for captains or public viewers; admin only.
