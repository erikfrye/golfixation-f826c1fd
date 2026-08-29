# Quick Start Guide Outline

Create a printable, essentials-only Markdown quick-start guide for first-time **captains** and **basic users/spectators**.

## Deliverable

A new file `docs/quick-start-guide.md` with a clean one-page outline structure that can be printed or exported to PDF.

## Content structure

1. **Header / title block**
   - App name (Golfixation)
   - Guide title: "Quick Start Guide"
   - One-sentence purpose: enter scores and follow live leaderboards.

2. **For Captains — Essentials**
   - Sign in
     - Email code option
     - Override code option (if admin provided one)
   - Find your team on the Captain home screen
   - Enter scores
     - Tap current hole
     - Enter each player's strokes
     - Submit and advance to next hole
   - Offline mode note
     - Scores queue automatically; syncs when signal returns
   - Need help?
     - Contact tournament admin

3. **For Spectators / Basic Users — Essentials**
   - Open the app home page
   - Select the active tournament
   - View the live leaderboard
   - Refresh / auto-update note

4. **Quick tips / troubleshooting**
   - Magic link not opening in PWA? Use the email code instead.
   - Can't see your team? Confirm email with admin.
   - Scores not updating? Check connection and wait for sync.

## Formatting

- Use Markdown headings and bullet lists for easy scanning.
- Keep each section short (one-page printable feel).
- Avoid technical details (RLS, migrations, OAuth internals).
- No emojis; use plain text for print compatibility.

## Out of scope

- Admin setup workflows (creating tournaments, teams, proximity contests, live ops).
- Deep troubleshooting or feature explanations.
- Custom styling / PDF generation at this stage.
