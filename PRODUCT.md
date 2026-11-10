# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

A Tauri 2 desktop shell around a web UI (React, TypeScript, Vite). The design language is web; the window ships at 1280×820 and can shrink to 900×600. Releases are Windows installers; development also happens on Linux. Since 0.9.0 the same UI also ships as a web app: one Cloudflare Worker serves the build and a small API proxy, installable as a PWA.

## Users

The owner and a few friends, each running their own copy on their own PC. They are fluent with games, play-time estimates and spreadsheets; the app replaced a spreadsheet. The job: decide which singleplayer game to play next and keep the PC plan realistic against a weekly hours budget. PS5 is an ordered queue without dates; PS4 exists only as history. Copies are sometimes compared or passed around as JSON backups.

## Product Purpose

Plan the order of a singleplayer backlog, see when each game starts and ends given the hours available per week, log the hours actually played, and keep a rated history of finished games. Success is a plan the owner trusts enough to follow: the dates move the moment anything changes, and the finished list is worth looking back on.

## Positioning

Live dates from one weekly-hours budget. Start and end dates for the whole plan are projected from a single hours-per-week number and recalculated on every reorder, logged session, finish or drop. IGDB (via Twitch credentials) can fill in covers, estimated hours, genres and details, but the mechanism is the budget, not the database.

## Operating Context

- Used at a desk, between or after play sessions; one window, no multitasking surface.
- Data lives in one local SQLite file in the app's config folder; Export/Import write and read a JSON backup; automatic backups keep the last 7 days.
- IGDB search, covers and details need a Client ID and Secret from the Twitch developer console, entered in Settings; the token is cached locally and never exported.
- Steam playtime import needs a Steam Web API key and the profile to read (link or SteamID64), entered in Settings, and that profile's game details set to public; both values stay local and never exported.
- Updates: the app checks GitHub for a newer published release at start and from Settings and runs the installer.
- Web app: the same build at a workers.dev URL. Data lives in that browser's IndexedDB, never on a server; every browser and device is a separate copy, moved with Export and Import. Credentials stay in the browser; the Worker's `/api/proxy` forwards them per request to Twitch, IGDB and Steam (same-origin pages only, those three hosts only) and holds no keys. Installable as a PWA, opens offline once loaded; a deployed new version is offered as a "Reload" banner (checked at start, hourly, and when the tab becomes visible). `npm run dev` in a browser uses the same IndexedDB store.

## Capabilities and Constraints

Confirmed functionality:

- Plans per platform: PC (scheduled), PS5 (queue). Statuses: Not started, In progress, Paused, Completed, Dropped. Drag-and-drop reorder, a "Position in plan" field, filters by IGDB mode and platform.
- Schedule: weeks = remaining hours ÷ hours per week; end = start + (hours logged since the start + cumulative remaining hours) ÷ hours per week × 7 days; remaining hours = estimate − logged hours. Hours played since the start took calendar time, so logging them never pulls the current game's end into the past; hours logged before the start only shorten what is left. "Today" status: on track, days ahead or behind, days left.
- Sessions (date, hours, note), the finish flow (finish date, next game's start, rating 1–10, short review, "put the next game in progress"), drop, undo for delete and drop.
- Plan warnings: two long games (50 h+) in a row; a series played out of order.
- IGDB: search with library matches first, link/unlink, derived "design" per game, details (developer, publisher, scores, platforms, screenshots, videos, store links, similar games, series and franchise).
- Steam: import of playtime for PC games as sessions, matched through IGDB's Steam store link (an edition through its base game's) or, for games without one, an identical title, previewed per game before anything is written (games not started yet come unticked, since Steam's lifetime total likely predates the plan), undoable from the notice; hand-logged sessions are never changed. "From Steam" lists the owned games (and, in a Wishlist view, the public wishlist with release dates, reviews and Steam Deck ratings) not in the app yet for triage: each is added through the normal Add game form or hidden for good; nothing is added on its own. Finishing a PC game (or editing a finished one) offers Steam's finish date: the unlock day of the story-ending achievement, else the newest unlocked one, or any picked from the list; used only on click. Settings → Steam shows the connected account and warns about a private profile. Game details show Steam's store data for games on Steam (review summary, Steam Deck rating, release date and cover where IGDB has none). Above the PC plan, Steam suggests "Finish…" (with the ending achievement's date) for a game in progress or paused whose ending was unlocked during this playthrough, "Mark in progress" / "Resume" for games played lately and "Pause" for a current game untouched for 30 days; each can be put off with "Not now".
- Statistics: finished games and hours per month, ratings by design and by genre.
- Themes: system, light, dark.

Durable constraints (confirmed):

- Offline, a single SQLite file, no accounts, no cloud.
- English-only UI; copy can assume English.

Open, not confirmed as constraints (current behavior, not a commitment):

- Whether the schedule must keep matching the original spreadsheet's formulas exactly.
- Whether the app must remain fully usable without IGDB credentials (it is today).

Terminology to keep: "Plan", "Finished games", "Log hours", "Finish game", "Drop", "Design" (how a game's world and progression are built: Linear, Semi-open, Open world, Sandbox, Metroidvania, Roguelike), "Estimated hours", platform labels PC / PS5 / PS4, dates shown as dd.mm.yyyy.

## Brand Commitments

- Name: Game Backlog. Version shown in the top bar.
- Voice: plain, consequence-first. Destructive actions say what will happen and what to do instead; errors name the problem and the recovery.
- Identity assets: only the app icon set in `src-tauri/icons/` (the README notes it is the default and can be replaced). No logo, wordmark or color commitment has been made.

## Evidence on Hand

- The seed plan in `src/domain/seed.ts` is the owner's real backlog (27 PC games, 10 finished).
- IGDB data (covers, screenshots, scores) appears only once games are linked with credentials; a fresh browser or install has none.
- No testimonials, press, screenshots or marketing material exist. Future work must not fabricate any.

## Product Principles

1. The plan is alive: any change to order, hours or status recalculates the dates at once, visibly.
2. The owner's file is the truth: no accounts, no sync; everything can be exported and imported as one JSON.
3. Plain words: product terms stay short and literal, consequences are stated before they happen.
4. Enrichment is optional: IGDB adds covers, estimates and details, Steam adds played hours, but neither gates planning (today's behavior; see open items).
5. Honest numbers: estimates are casual play-time, drift from the plan is shown rather than hidden.

## Accessibility & Inclusion

No external standard was required. The UI is built to be fully keyboard-operable with visible focus, and text and controls meet WCAG AA contrast in both themes; these were established in the 2026-11-06 polish and are to be preserved.
