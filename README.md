# Game Backlog

Personal desktop app for planning and tracking a singleplayer video game
backlog. Single user, offline, local SQLite database. UI and code in English.

Stack: Tauri 2, React, TypeScript, Vite, tauri-plugin-sql (SQLite).

## Development

Prerequisites: Node 20+, Rust (rustup), and on Linux the Tauri system
libraries (webkit2gtk 4.1 and friends).

```bash
npm install
npm test            # unit tests for the date and schedule calculations
npm run typecheck   # TypeScript
npm run tauri dev   # run the desktop app
```

The database is created on first start in the app's config folder
(`%APPDATA%\com.ognjen.gamebacklog\backlog.db` on Windows,
`~/.config/com.ognjen.gamebacklog/backlog.db` on Linux) and filled with the
seed plan.

## Browser preview

`npm run dev` serves the UI at http://localhost:1420 in a normal browser.
There the data lives in the browser's IndexedDB (database `game-backlog`),
so it survives reloads; the same store backs the web version of the app. A
browser starts with an empty plan (the seed plan is the desktop app's first
run only); import a backup or add games. Clear the site data to start over. The
IGDB search and the Steam import work there only while the Worker runs
(`npm run dev:worker`, see "Web version"): neither API sends CORS headers,
so without the proxy the browser blocks the requests.

## Web version

The same UI runs as a web app, served by one Cloudflare Worker
(`wrangler.jsonc`, `worker/`): the Worker hands out the Vite build as static
files and answers `/api/proxy`, through which the browser reaches Twitch,
IGDB and Steam, since none of them sends CORS headers. The proxy forwards
each user's own credentials from Settings exactly as the desktop app sends
them, holds no keys of its own, serves only pages of its own origin and
reaches only those three hosts (`src/platform/proxy.ts` lists them). Data
lives in the browser's IndexedDB (see "Browser preview"); Export and Import
move it between the web and desktop apps. The free Workers plan covers a
few users many times over. The web build is also an installable PWA
(`vite-plugin-pwa` in `vite.config.ts`, switched off for Tauri builds): the
browser's "Install app" puts it on the desktop or home screen, and once
loaded it opens without a connection. When a new version is deployed the
app offers a Reload in a banner; it looks for one at start, every hour,
and whenever the tab becomes visible again.

Local check:

```bash
npm run dev:worker   # builds the UI and serves app + proxy at http://localhost:8787
```

For hot reload keep `npm run dev:worker` running and use `npm run dev` in a
second terminal: the Vite dev server forwards `/api` to the Worker.

Deploy, once a free Cloudflare account exists:

```bash
npx wrangler login
npm run deploy:web   # prints the workers.dev URL
```

Without an account yet, `npx wrangler deploy --temporary` deploys to a
temporary account and prints a claim link (valid for an hour) that turns it
into a real one, keeping the URL.

`.github/workflows/deploy-web.yml` does the same on every `v*` tag (and by
hand from the Actions tab) when the repository has the secrets
`CLOUDFLARE_API_TOKEN` (an API token made from the "Edit Cloudflare Workers"
template) and `CLOUDFLARE_ACCOUNT_ID` (shown on the Workers overview page).

## Steam playtime

Settings → Steam takes a Steam Web API key (steamcommunity.com/dev/apikey)
and the profile link or SteamID64 to read; the profile's *Game details* must
be public, because the key identifies the caller, not the account. "Import
playtime from Steam" fetches the owned games, matches PC games by the Steam
store link cached from IGDB, and shows a preview: one session per game for
the hours Steam has beyond what is logged, dated when Steam last saw the game
played. An edition IGDB lists without a Steam app of its own (a Definitive
or Reloaded Edition) matches through its base game's; for editions linked
before that was cached, the import asks IGDB once, when IGDB is set up. Only
games with no Steam link at all fall back to an identical title, so a remake
linked to its own Steam app never picks up the original's hours. DLC and
episodes stay unmatched, since Steam counts them under their main game.
Steam's total is lifetime, so games not started yet with nothing logged come
unticked: their hours are likely from earlier play and would shrink the
game's slot in the plan. Logged sessions are never changed or removed, and
the notice after an import offers to undo it. The pure matching and delta
logic lives in `src/domain/steam.ts`; the client in `src/platform/steam.ts`.
Like IGDB, the key and account stay out of backups.

With Steam set up, "From Steam" next to "Add game" lists the owned games
that are not in the app yet (never played first, then played, all, hidden),
matched on the same terms as the import. It is a triage list, not a sync:
"Add to plan" opens the normal Add game form with the Steam name in the IGDB
search, and "Hide" sets a game aside for good, so only undecided games stay
listed. The hidden list stays on this computer and out of backups. Its
Wishlist view lists the account's public wishlist the same way (ranked
games first), with each game's release date, review summary and Steam Deck
rating from Steam's store.

Game details show Steam's own store data for a game on Steam, with no key
needed for games linked through IGDB: the review summary, the Steam Deck
rating, the Steam release date when IGDB has none, a Steam store button
when IGDB gave no link, and Steam's portrait cover when there is no IGDB
cover (`src/domain/steamStore.ts`).

The Finish dialog, and a finished game's edit form, offer Steam's finish
date for PC games on Steam: the unlock day of the achievement for beating
the story ("Finish the main story", "Watched the ending credits"; harder
variants such as New Game+ or a difficulty are skipped), or, when none is
recognised (story achievements are often hidden, and Steam blanks their
descriptions), the newest unlocked one, labelled as such. "Choose from your
Steam achievements" lists every unlocked one. Nothing changes until "Use
this date". The rules live in `src/domain/achievements.ts`.

Settings → Steam shows who the saved key and account read as (name, avatar,
a link to the profile) and warns when the profile is not public. Above the
PC plan, "From your Steam play" suggests status changes: a game in progress
or paused whose ending achievement was unlocked during this playthrough
("Finish…", which opens the Finish dialog with that date; an ending from an
earlier run or just the newest unlock does not count), a game not started
or paused but played at least half an hour on Steam in the last two weeks
("Mark in progress" / "Resume"), and a game in progress with no play on
Steam or in the log for 30 days, counted from when it became current
("Pause"). "Not now" hides a hint until the game is played again; those
choices stay on this computer and out of backups. The rules live in
`src/domain/steamHints.ts`.

## Backup

Export / Import in the top bar write and read a JSON file with all settings
and games (`src/domain/backup.ts` documents the format). Import validates the
file and replaces everything in one transaction.

## Windows installer

Releases are built by GitHub Actions on a Windows runner
(`.github/workflows/release.yml`), because Tauri cannot cross-build Windows
installers from Linux.

1. Bump `version` in `package.json` (`npm version 0.5.0 --no-git-tag-version`),
   `src-tauri/tauri.conf.json` and `src-tauri/Cargo.toml`. A unit test fails
   when the three disagree.
2. Commit on `main`, then tag and push:

   ```bash
   git tag v0.5.0 && git push origin main --tags
   ```

3. The workflow runs tests, builds the NSIS installer and creates a **draft**
   GitHub release with `Game Backlog_0.5.0_x64-setup.exe` attached. Publish
   the draft when you are happy with it. The same `.exe` is also kept as a
   workflow artifact.

## Updates

At every start, and from Settings → Check for updates, the app asks GitHub
for the latest **published** release (`src/platform/updates.ts`). When its tag
is newer than the installed version it offers to download that release's
`-setup.exe` and runs it; the installer replaces the program and keeps the
data folder. Drafts and pre-releases are never offered. Version 0.3.0 and
older have no update check, so going from those to 0.4.0 is a manual install.

The installer is unsigned, so Windows SmartScreen shows a warning on first
run ("More info" → "Run anyway"). It installs per user, no admin rights
needed, and the data lives in `%APPDATA%\com.ognjen.gamebacklog\backlog.db`.

To build on a Windows PC instead: install Rust (rustup), Visual Studio Build
Tools with the "Desktop development with C++" workload, and Node 22, then

```bash
npm ci && npm run tauri build -- --bundles nsis
```

The installer lands in `src-tauri/target/release/bundle/nsis/`.

To replace the default icon, put a 1024×1024 PNG somewhere and run
`npm run tauri icon path/to/icon.png`; it regenerates every file in
`src-tauri/icons/`.

## Layout

- `src/domain` — pure TypeScript: types, date maths, schedule calculation,
  seed data. No Tauri imports; this is what the unit tests cover.
- `src/db` — storage: SQLite through tauri-plugin-sql in the app, an
  in-memory repository in the browser preview. `sql.test.ts` runs the
  generated SQL against real SQLite (Node's built-in driver).
- `src/state` — zustand store and theme handling.
- `src/components` — React UI.
- `src/platform` — file dialogs (Tauri plugins, with a browser fallback).
- `src/i18n/en.ts` — every UI string.
- `src-tauri` — Rust side: plugin registration, capabilities and SQL migrations.
- `.github/workflows` — CI on every push, Windows installer on tags.
