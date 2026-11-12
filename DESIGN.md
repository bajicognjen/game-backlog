---
name: Game Backlog
description: Plan the order of a singleplayer backlog and see live start and end dates from one weekly-hours budget.
colors:
  plan-blue: "#2b62d9"
  plan-blue-deep: "#244fb3"
  plan-blue-ink: "#1d4ed8"
  plan-blue-wash: "#e4ecfd"
  current-row-wash: "#eef3ff"
  on-plan-blue: "#ffffff"
  finish-green: "#1f7a45"
  finish-green-deep: "#196639"
  finish-green-wash: "#e9f7ee"
  on-finish-green: "#ffffff"
  drop-red: "#c0392b"
  drop-red-deep: "#a33124"
  drop-red-wash: "#fdecea"
  on-drop-red: "#ffffff"
  caution-amber: "#b7791f"
  caution-amber-wash: "#fff6d6"
  caution-amber-line: "#f0b429"
  caution-amber-ink: "#8a5a12"
  design-linear-ink-dark: "#bfdbfe"
  design-open-world-ink-dark: "#bbf7d0"
  design-roguelike-ink-dark: "#fecaca"
  design-sandbox-ink-dark: "#99f6e4"
  design-semi-open-ink-dark: "#fde68a"
  design-metroidvania-ink-dark: "#ddd6fe"
  scrim: "rgba(10, 12, 16, 0.45)"
  scrim-dark: "rgba(0, 0, 0, 0.6)"
  media-scrim: "rgba(0, 0, 0, 0.65)"
  video-black: "#000000"
  desk: "#f4f5f7"
  paper: "#ffffff"
  field: "#ffffff"
  paper-shade: "#f0f2f5"
  paper-hover: "#f7f8fa"
  rule: "#dde1e6"
  rule-strong: "#c5cbd3"
  ink: "#1b1f24"
  ink-muted: "#626b76"
  design-linear-bg: "#dbe7ff"
  design-linear-fg: "#1d4ed8"
  design-open-world-bg: "#dcfce7"
  design-open-world-fg: "#166534"
  design-roguelike-bg: "#fee2e2"
  design-roguelike-fg: "#b91c1c"
  design-sandbox-bg: "#ccfbf1"
  design-sandbox-fg: "#0f766e"
  design-semi-open-bg: "#fef3c7"
  design-semi-open-fg: "#a2480a"
  design-metroidvania-bg: "#ede9fe"
  design-metroidvania-fg: "#6d28d9"
typography:
  display:
    fontFamily: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  title:
    fontFamily: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "16px"
    fontWeight: 650
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0em"
  body-small:
    fontFamily: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0em"
  caption:
    fontFamily: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0em"
  label:
    fontFamily: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.45
    letterSpacing: "0.05em"
rounded:
  bar: "2px"
  cover: "3px"
  thumb: "4px"
  sm: "6px"
  md: "8px"
  panel: "10px"
  lg: "12px"
  xl: "14px"
  pill: "999px"
spacing:
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "10": "10px"
  "12": "12px"
  "14": "14px"
  "16": "16px"
  "20": "20px"
  "24": "24px"
  "32": "32px"
  "40": "40px"
components:
  button:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-hover:
    backgroundColor: "{colors.paper-shade}"
  button-primary:
    backgroundColor: "{colors.plan-blue}"
    textColor: "{colors.on-plan-blue}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-primary-hover:
    backgroundColor: "{colors.plan-blue-deep}"
  button-success:
    backgroundColor: "{colors.finish-green}"
    textColor: "{colors.on-finish-green}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-success-hover:
    backgroundColor: "{colors.finish-green-deep}"
  button-danger:
    backgroundColor: "{colors.drop-red}"
    textColor: "{colors.on-drop-red}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-danger-hover:
    backgroundColor: "{colors.drop-red-deep}"
  button-ghost:
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.paper-shade}"
  button-active:
    backgroundColor: "{colors.plan-blue-wash}"
    textColor: "{colors.plan-blue-ink}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-small:
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: "3px 8px"
  button-icon-sm:
    rounded: "{rounded.sm}"
    padding: "0"
    width: "28px"
    height: "28px"
  button-icon-touch:
    rounded: "{rounded.sm}"
    padding: "0"
    width: "40px"
    height: "40px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  field-label:
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
  table-header:
    backgroundColor: "{colors.paper-shade}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    padding: "7px 10px"
  table-cell:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    padding: "7px 10px"
  table-row-hover:
    backgroundColor: "{colors.paper-hover}"
  table-row-current:
    backgroundColor: "{colors.current-row-wash}"
  chip:
    backgroundColor: "{colors.paper-shade}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-toggle:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  chip-toggle-on:
    backgroundColor: "{colors.plan-blue-wash}"
    textColor: "{colors.plan-blue-ink}"
  tabs:
    backgroundColor: "{colors.paper-shade}"
    rounded: "{rounded.panel}"
    padding: "3px"
  tab:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "5px 14px"
  tab-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
  stat:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "8px 14px 9px"
  now-playing:
    rounded: "{rounded.lg}"
    padding: "20px 24px"
  now-playing-title:
    typography: "{typography.display}"
  menu:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "4px"
  menu-item:
    typography: "{typography.body-small}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  menu-item-hover:
    backgroundColor: "{colors.paper-shade}"
  modal:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "20px 24px 22px"
    width: "min(560px, calc(100vw - 32px))"
  empty-state:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.lg}"
    padding: "28px 24px"
  banner-info:
    backgroundColor: "{colors.plan-blue-wash}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "10px 14px"
  banner-error:
    backgroundColor: "{colors.drop-red-wash}"
    textColor: "{colors.drop-red}"
    rounded: "{rounded.panel}"
    padding: "10px 14px"
  warnings:
    backgroundColor: "{colors.caution-amber-wash}"
    typography: "{typography.body-small}"
    rounded: "{rounded.panel}"
    padding: "10px 14px"
  status-dropped:
    backgroundColor: "{colors.drop-red-wash}"
    textColor: "{colors.drop-red}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "1px 7px"
  version-tag:
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "1px 7px"
---

# Design System: Game Backlog

## Overview

**Creative North Star: "The Planner's Desk"**

Game Backlog is a calm desk where the plan sits. The surfaces are quiet paper on a cool grey desk, the lines between them are thin rules, and the numbers line up like a ledger: tabular figures, right-aligned hours, dates as dd.mm.yyyy. One blue says what is current and what moves the plan; everything else stays in ink and grey. The product replaced a spreadsheet, and the system keeps that honesty: density serves scanning, and nothing animates for show.

The mood is calm, precise, unhurried. This is a restrained Operate-mode product UI: a sticky top bar, a Now playing card at the peak of the page, then tables that hold the whole plan in view at 1280×820 and still work at 900×600. Below 900px, the web app on a phone, the same page folds into one column: the tables become stacked rows and every control grows to a fingertip's size, with no second visual language. The accent is rare, hover is a tint rather than a lift, and depth is ambient (a soft shadow under cards, a popover shadow for things that float) rather than structural. Light and dark themes share one grammar; in dark the washes deepen and the accents lighten so dark ink can sit on them.

The confirmed anti-reference is "a generic admin table": grey chrome with no point of view. The build answers it with the Now playing hero (an accent wash, the cover at full weight, the title at full strength), the six Design chips, the dotted status words and the ledger numbers; these are what make the system read as this product rather than any dashboard.

**Key Characteristics:**
- One accent, Plan Blue, reserved for action, selection and the current game.
- Paper surfaces on a cool grey desk with 1px rules; no colored stripes or side borders.
- One family (system-ui), six fixed pixel steps, tabular numerals everywhere a number is compared.
- Ambient elevation: a soft shadow at rest on cards and the Now playing card, a popover shadow only for things that float, flat tables.
- Nested radii: 12px containers, 8px controls, 6px small controls, 14px dialogs, pills for chips and counts.
- The only entrance animation is the Now playing handover, and it never runs on first paint.
- One page at every width: columns leave as the window narrows, below 900px the tables fold into stacked rows, and nothing ever scrolls sideways.

## Colors

A cool, low-saturation neutral set with one blue accent and three semantic roles (finish, drop, caution), each shipped as fill, hover, wash and "on" text.

### Primary
- **Plan Blue** (`plan-blue`): the single accent. Fills primary buttons ("Start", "Save", "Add game"), the chosen rating square, the progress bar, the stats bars, the focus ring (`2px solid`, `2px` offset) and the 8px "In progress" status dot. `html { accent-color }` makes native checkboxes and ranges match.
- **Plan Blue Deep** (`plan-blue-deep`): the hover state of a Plan Blue fill; the only darker step.
- **Plan Blue Ink** (`plan-blue-ink`): blue text on paper or on the wash: the active Settings button, the "on" filter chip, the active tab's count pill, the "Today" marker, the own-rating pill and accent links.
- **Plan Blue Wash** (`plan-blue-wash`): the soft tint behind selected states and info banners; mixed at 45% into paper it becomes the Now playing card's background, and at 14% the track of its progress bar.
- **Current Row Wash** (`current-row-wash`): the row of the game in progress; it keeps this tint under hover.

### Secondary
- **Finish Green** (`finish-green`, deep `finish-green-deep`, wash `finish-green-wash`): the "Finish game" button, the "Completed" status word, "on track" drift, and the 1600ms settle tint of a row that just joined the finished list.
- **Drop Red** (`drop-red`, deep `drop-red-deep`, wash `drop-red-wash`): the "Drop" and "Delete" buttons, invalid field borders, error banners, danger menu items, the "Dropped" pill and "behind" drift.
- **Caution Amber** (`caution-amber`, wash `caution-amber-wash`, line `caution-amber-line`, ink `caution-amber-ink`): plan warnings (two long games in a row, a series out of order) and field notes; small caution text uses the ink (#8a5a12 light, #f0c060 dark) so it clears 4.5:1; it has no filled button.

### Neutral
- **Desk** (`desk`): the page background behind everything.
- **Paper** (`paper`): cards, tables, buttons, inputs, the top bar, menus and dialogs.
- **Paper Shade** (`paper-shade`): sticky table headers, the tabs track, count pills, path chips, genre chips, and the hover tint of buttons and menu items.
- **Paper Hover** (`paper-hover`): the lighter hover tint of table rows.
- **Rule** (`rule`): passive 1px lines: card and table borders, dividers, the top bar's bottom edge.
- **Rule Strong** (`rule-strong`): interactive 1px lines: default buttons, inputs, selects, the dashed empty state, the scrollbar thumb.
- **Ink** (`ink`): all primary text.
- **Ink Muted** (`ink-muted`): headers, hints, notes, meta lines, placeholder text, paused titles, idle row actions.

### Design chips
Six fixed pairs name how a game's world is built: Linear (`design-linear-*`), Semi-open (`design-semi-open-*`), Open world (`design-open-world-*`), Sandbox (`design-sandbox-*`), Metroidvania (`design-metroidvania-*`), Roguelike (`design-roguelike-*`). Each is a pastel fill with a deep text of the same hue; the term "Design" is product vocabulary and is not renamed.

### Dark theme
Dark is a full second set under `prefers-color-scheme: dark` and `[data-theme="dark"]`: Desk `#0f1216`, Paper `#171b21`, Paper Shade `#1f242c`, Rule `#2a303a`, Ink `#e6e9ee`, Ink Muted `#9aa3af`; the accent lifts to `#6d9cff` (hover `#88b0ff`, ink `#8fb3ff`, wash `#1c2a47`, current row `#182238`), Finish to `#6fd49a`, Drop to `#ff7b6b`, Caution to `#e0a526`. Design chips keep a light foreground and derive their fill as `color-mix(in srgb, <fg> 16%, var(--surface))`.

### Named Rules
**The One Blue Rule.** Plan Blue marks exactly three things: an action that moves the plan, a selected control, and the current game. Headings, chrome, icons and dividers stay in ink and grey; if a screen shows blue anywhere else, it is wrong.

**The Dark Ink Rule.** Every filled color carries its own `--on-*` text token. In light theme that text is white; in dark theme the fills lighten and the text flips to dark ink (`#0f1216`). Never hard-code white on a fill.

**The Soft Pair Rule.** A semantic color appears either as a fill with `--on-*` text, or as its wash carrying the same role's colored text (error banner, dropped pill, danger-ghost hover). It is never used as a border stripe or an outline on its own.

## Typography

**Display Font:** system-ui (with Segoe UI, Roboto, Helvetica Neue, sans-serif)
**Body Font:** the same stack; one family for everything
**Label/Mono Font:** none; numerals use `font-variant-numeric: tabular-nums` instead of a monospace face

**Character:** The platform's own face, set in fixed pixel steps with slightly tightened headings. It reads as a tool, not a publication: weight and tabular figures do the hierarchy, not size jumps.

### Hierarchy
- **Display** (700, 22px, 1.25, -0.02em): the Now playing title only; the release year beside it drops to 450. When nothing is in progress the card's title falls back to Headline.
- **Headline** (650, 18px, 1.25, -0.01em): section headings ("Plan", "Finished games"), dialog titles, and the big figure in a stat card (tabular).
- **Title** (650, 16px, 1.25, -0.01em): the app name in the top bar; settings group and details sub-headings use 13px/600 instead.
- **Body** (400, 14px, 1.45): table cells, buttons, inputs, dialog text. Table titles sit at 550. Long text (details, descriptions) is capped at 75ch and set at 13px/1.5.
- **Body-small** (400, 13px): meta lines, hints, filter bars, menu items, warnings, checkbox labels.
- **Caption** (600, 12px, sentence case): field labels, chips, status words, count pills and small buttons. Notes and hints use the same size at 400–500.
- **Label** (600, 11px, 0.05em, UPPERCASE): sticky table headers and search-dropdown section names only. The "Today" marker and the version tag reuse the size.

### Named Rules
**The One Family Rule.** system-ui is the only face. No webfont, no display face, no monospace; alignment comes from tabular numerals and right-aligned cells.

**The Ledger Rule.** Any number that will be compared down a column (hours, dates, counts, ratings, stat values) is set with `tabular-nums`; in tables it is right-aligned and never wraps.

**The Fixed Steps Rule.** Six pixel sizes (11/12/13/14/18/22), no fluid or clamp sizes. Under 1400px only numbers and dates step down to 13px and chip padding tightens; chips and status words keep the 12px caption size, and 11px stays reserved for uppercase labels.

## Layout

One window, no page container. `main` spans the full width at `20px 28px 56px` padding (`16px 16px 48px` under 1400px, `12px 12px 40px` below 900px); the sticky top bar is 52px tall with 24px side padding, and sticky table headers lock in beneath it. The page sets `overflow-anchor: none` so panels opening above the plan do not scroll the reader away.

The reading order is fixed: top bar, optional Settings card (24px below), banners and warnings, the Now playing card (16px below), plan tabs with the section tools, filter bar (10px above the table), then the plan table; 40px separates the Plan and Finished games sections, 14px separates a section head from its content.

Rhythm comes from a small set of gaps rather than a grid: 2–4px inside controls, 6px between sibling actions, 8px between chips, stats and dialog buttons, 10–12px inside bars and forms, 14–16px between fields and groups, 20–24px of card padding, 32px between the settings label column (240px) and its body, 40px between sections. Form rows are 1-, 2- or 3-column grids with 12px gaps; the Settings card is a two-column grid that collapses to one under 1000px.

Density: table cells are `7px 10px` (`6px 8px` under 1400px), rows carry a 40×24 cover thumbnail, and the Now playing cover is 96×128. The window ships at 1280×820 and can shrink to 900×600. Responsive changes remove rather than reflow: under 1400px titles wrap at 200–300px and the running-total header takes two lines; under 1240px the running-total column leaves; under 1184px the genre and note columns leave too (both remain in the details view); under 1100px the stats grid goes single-column, and under 1000px the Settings card's two columns become one. The two column breakpoints sit where the owner's full plan (27 games, notes, the Today marker) stops fitting, so the page never scrolls sideways.

Below 900px (the web app on a phone, or a narrow browser window) the page is one column. The top bar keeps the app name and turns its controls icon-only; the version tag, divider and theme switch leave (the theme is set in Settings there). Where the controls leave the name too little room for one line (under about 350px) it takes two, "Game" over "Backlog", inside the 52px bar, rather than being cut. Section heads and the two headline tiles wrap, the tiles sharing a row; the Now playing card stacks, with a 56×75 cover and wrapping actions; forms take one field per line; dialogs run the viewport's width less 16px; a banner's buttons drop under its message when they no longer fit beside it. The tables fold as The Folded Ledger Rule describes, and touch screens get The Fingertip Rule.

### Named Rules
**The One Window Rule.** There is no max-width container and no sidebar; the plan table is the page at every width. Narrowing drops columns (at 1240px and 1184px) instead of wrapping cells, below 900px the tables fold into stacked rows, and at no width does the page scroll sideways.

**The Folded Ledger Rule.** Below 900px each game is one stacked row: line one holds the drag handle, number, title and actions; line two the Design chip, status word and hours (with "h"); line three the date range (on a finished game, its review). From 600px up (a narrow window, a tablet) a planned row's dates join line two, 16px after the hours, so the row is two lines; under 340px the row's actions take their own last line, at its right edge, so the title gets the width instead of breaking mid-word. The handle's cell is the handle and the number sits in a fixed 14px slot, so the title and the lines under it share one left edge; the row's own left padding holds that indent and the handle and number reach back into it, so a line that wraps (a finished game with its Together tag and rating) starts at the title too. What a narrow window hides stays hidden. The header row is hidden from view only, and the tables carry explicit table, row, header and cell roles, so a screen reader still hears each cell's column.

**The Fingertip Rule.** On a touch phone (below 900px with a coarse pointer) every control is at least 40px tall: icon buttons are 40px square with 6px between a row's actions, small buttons become full buttons, the drag handle and the theme options are 32×40, and a link inside a line of text (a title, Rate, the plan's two values) answers 10px above and below instead of making the line taller; where two such lines sit 6px apart (Now playing's Next line over the plan's two values) their touch areas meet halfway rather than overlap, and a finished game's rating answers a 42px touch; on a folded finished row the title's touch reaches up and the rating's down, meeting in the 4px gap between their lines. Fields are set at 16px, or iOS Safari zooms the page when one takes focus. A narrow window with a mouse keeps desktop density.

**The Short Window Rule.** Under 700px of window height (a window 900px or wider: a phone is short by nature and keeps its card whole) the Now playing card gives rows back: `12px 16px` padding, a 56×75 cover, a Headline title, and no meta line or explanation note; nothing else changes.

**The Sticky Ledger Rule.** The top bar (52px) and the table headers stay fixed while rows scroll; nothing else is sticky. (Below 900px the header row is out of view, so only the top bar stays.)

**The One Stop Rule.** A composite control is one Tab stop. A table row lands on its title and the theme switch on its chosen option; Left/Right (and Home/End) move inside, and a row remembers the control it left. The skip links sit before the top bar, so the first Tab on the page reaches the finished games or the stats.

## Elevation & Depth

Depth is ambient, not structural. Resting surfaces (cards, tables, stat cards, the Now playing card, the active tab) carry a 1px rule and a faint two-layer shadow; it suggests paper on the desk rather than a lifted object. Things that genuinely float (the row menu, the search dropdown, a row being dragged, the Now playing cover) get a deeper popover shadow, and the native dialog gets a single deep shadow over a 45% (dark: 60%) scrim. Tables sit flat inside their rounded wrapper; the stats tables drop the shadow entirely. Hover never lifts: it tints the surface one step.

### Shadow Vocabulary
- **Ambient** (`box-shadow: 0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.1)`; dark `0 1px 2px rgba(0, 0, 0, 0.4)`): cards, table wrappers, stat cards, the Now playing card, the details cover, the active tab.
- **Popover** (`box-shadow: 0 10px 28px rgba(16, 24, 40, 0.18), 0 1px 3px rgba(16, 24, 40, 0.08)`; dark `0 12px 32px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.4)`): the row menu, the search dropdown, the dragged row's cells, the Now playing cover.
- **Dialog** (`box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3)` over a `rgba(10, 12, 16, 0.45)` backdrop; dark backdrop `rgba(0, 0, 0, 0.6)`): the native `<dialog>` only.

### Named Rules
**The Ambient Rule.** Shadows describe where a surface sits, never where attention should go. Resting surfaces get Ambient, floating surfaces get Popover, dialogs get Dialog; no element gets a hard or colored shadow, and nothing gains a shadow on hover.

**The Tint-Not-Lift Rule.** Every hover is a background tint (Paper Shade for controls, Paper Hover for rows, the role's wash for ghost danger and success icons) with a 120ms ease; no transform, no shadow change.

## Shapes

Gently rounded, thin-lined, nested. Containers (cards, table wrappers, the Now playing card, the empty state) use 12px corners; controls inside them (buttons, inputs, selects, tabs, menus, stat cards, covers) use 8px; small controls (small buttons, icon buttons, menu items, path chips) use 6px; the dialog uses 14px. Bars, banners, warnings, the tabs track and the search dropdown use a 10px panel radius. Chips, counts, status pills, the version tag and the "Today" marker are full pills (999px). Progress tracks are 4px tall in tables and 8px in the Now playing card, fully rounded.

Borders are always 1px: Rule for passive edges, Rule Strong for anything interactive (buttons, inputs, platform chips, toggle chips), a dashed Rule Strong for the empty state, and a semi-transparent mix of the role color (22–55%) for the Now playing card, banners and warnings. Covers are clipped to the control radius with `object-fit: cover`; thumbnails in rows and search are 4px. Status dots are 8px circles, filled for "In progress" and a 2px hollow ring for "Paused".

### Named Rules
**The Nested Radius Rule.** A control inside a container is one step tighter than the container: 12px wrapper, 8px control, 6px inner control. Dialogs sit one step looser at 14px.

**The Thin Line Rule.** Every border is 1px and grey; a role color may tint a border only through `color-mix` with the grey or the transparent base, never as a solid colored edge or side stripe.

## Components

### Buttons
Refined and restrained: paper tiles with a thin strong rule, text at 500, an optional 16px icon leading at a 6px gap.
- **Shape:** gently curved (8px); small buttons 6px at `3px 8px` and 12px type; icon buttons 28×28 at 6px.
- **Default:** Paper fill, Rule Strong border, Ink text, `6px 12px`; hover tints to Paper Shade.
- **Primary:** Plan Blue fill and border, on-accent text; hover to Plan Blue Deep. One per surface: Start, Save, Add.
- **Success / Danger:** Finish Green / Drop Red fills with the same hover step; "Finish game" and "Drop"/"Delete" only.
- **Ghost:** transparent border and fill, Ink text; used in the top bar and dialog close. Danger ghost is Drop Red text with a Drop Red Wash hover.
- **Active:** Plan Blue border on Plan Blue Wash with Plan Blue Ink text (the open Settings button).
- **Icon (`button-icon-sm`):** 28×28 transparent, inherits the row's muted color, Paper Shade on hover; row actions brighten from Ink Muted to Ink when the row is hovered or focused. Success icon variant keeps Finish Green text with its wash on hover.
- **Hover / Focus:** background, border and color transition 120ms ease (disabled under reduced motion); focus-visible is a 2px Plan Blue outline offset 2px. Disabled is 55% opacity.
- **Touch:** on a touch phone every button is at least 40px tall, icon buttons grow to 40px square (`button-icon-touch`) and small buttons take the full size (The Fingertip Rule).

### Inputs / Fields
- **Style:** Field fill (`field`: Paper in light, Paper Shade one step above the dialog surface in dark, so a border is never the only cue), 1px Rule Strong, 8px corners, `6px 10px`, body size, 160px minimum width for text/number/date/password; the search field is `8px 12px`. Textareas resize vertically from 56px.
- **Label:** 12px/600 Ink in sentence case, 4px above the control; hints and errors are 12px below (Ink Muted / Drop Red; amber notes for cautions).
- **Focus:** the global 2px Plan Blue outline.
- **Error:** `aria-invalid` turns the border Drop Red.
- **Date field (`DateField`):** every date is a 128px text input typed as dd.mm.yyyy (numeric keyboard, `dd.mm.yyyy` placeholder, tabular figures) with a 28×28 Ink Muted calendar icon button at a 4px gap that opens the native picker; a picked date lands in the field at once, a typed one commits on blur or Enter. The compact form on the Now playing card is 104px with a 24px button.

**The Typed Date Rule.** A date is read and written the same way everywhere: dd.mm.yyyy text with the picker one click away. No surface shows a bare native date input or a month-first order.

### Navigation
- **Skip links:** two links before the top bar, "Skip to finished games" and "Skip to stats", hidden until focused; the focused one slides in under the top bar's left edge as an 8px Plan Blue tile with on-accent 600 text at `6px 12px`, and Enter lands focus on the section's heading.
- **Top bar:** 52px Paper strip with a Rule bottom edge; the app name at Title size with a pill version tag, ghost buttons for Export/Import on the right, a 1px 20px divider, the theme switch (the platform-tab segmented control one size smaller: System / Light / Dark with their icons, the chosen one lit; a radio group that is a single Tab stop, where Left/Right move and select), in the web app a ghost Sync button (a cloud with sync's 8px state dot at its shoulder, the same tones as Settings → Sync: Finish Green synced, amber waiting, Drop Red stopped or in a conflict, a hollow ring while syncing, no dot while sync is off; ringed in Paper so it reads against the icon; named "Sync: Synced" and so on, with the time since in its tooltip) that brings Settings → Sync into view with focus on its heading, and the Settings button that turns Active while open. Below 900px the bar keeps the app name and four controls (Export, Import, Sync, Settings) and turns every control icon-only; the theme switch moves into Settings, as a Theme group under Sync, so the bar's room goes to sync's health; the words stay in the page, hidden from view only, as each button's name.
- **Plan tabs:** PC, PS5 and Together (games played with others; a list that mixes platforms, so its table adds a Platform column). A segmented control on a Paper Shade track (10px, 3px padding, 2px gaps); tabs are 8px, `5px 14px`, 600 weight in Ink Muted. The active tab lifts to Paper with the Ambient shadow and Ink text, and its count pill turns Plan Blue Wash / Plan Blue Ink. The pill is seen, not read: a screen reader hears "PC, 26 games". Arrow keys move between tabs.
- **Row menu:** a 28px "more" icon button opens a fixed-position Paper popover (8px, 4px padding, Popover shadow, 150px minimum); items are 13px at `6px 10px` with 6px corners, Paper Shade on hover and focus (outline inset 2px), danger items in Drop Red. The popover follows its button when the page scrolls or the window resizes rather than closing.

### Chips
- **Design chips:** pills at `2px 10px`, 12px/600, one of the six fixed pastel/deep pairs.
- **Genre chip:** Paper Shade with Ink Muted text at 500.
- **Platform chip:** transparent with a Rule Strong border, Ink Muted, 0.02em tracking.
- **Together chip:** Paper Shade with Ink Muted text at 500, like the genre chip, beside the platform chip of a finished game played with others.
- **Filter toggle:** Paper with a Rule Strong border and Ink Muted text; on: Plan Blue border, wash and ink. Exposed as `aria-pressed`.
- **Kind chip:** 11px Plan Blue Wash / Ink mini-pill after a search result title.
- Under 1400px every chip drops to `1px 7px` and 11px.

### Status words
A word, not a pill: 12px Ink Muted. "In progress" is Ink at 650 with a filled 8px Plan Blue dot; "Paused" has a hollow 2px Ink Muted ring; "Completed" is Finish Green text; "Dropped" alone is a Drop Red Wash pill at 11px.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Paper on the Desk.
- **Shadow Strategy:** Ambient at rest (see Elevation & Depth).
- **Border:** 1px Rule.
- **Internal Padding:** Settings `16px 22px 4px`, stats cards `14px 18px 12px`, empty state `28px 24px` with a dashed Rule Strong border and centered Ink Muted text (title in Ink at 600, hint capped at 48ch, actions 14px below).
- **Stat cards:** 8px corners, `8px 14px 9px`, 118px minimum; an 11px Ink Muted label over an 18px/650 tabular figure with an optional 11px detail.
- **Banners / warnings:** 10px panels at `10px 14px` on the role's wash with a 30–55% role-mixed border; warnings carry a 16px alert icon in Caution Amber. The finished notice adds a ghost "Show in finished games" link that scrolls to the row and focuses its title, and an Undo offer that shows its own clock: a 3px Plan Blue track under the notice drains over 20 seconds while an Ink Muted tabular `N s` count sits beside the button; the clock waits while the pointer is over the notice, while keyboard focus is anywhere in it (the box itself too, where it lands when it appears) and while a dialog is open over the page, but not for focus a mouse click left there, or a mouse user's clock would never run; the count stays on one line; a screen reader hears the limit once, with the notice ("You can undo for 20 seconds; the time waits while you're on this notice."), since the ticking count is hidden from it; and when it runs out focus returns to the card. The web app's reload and sync banners have live regions that are always on the page and hold only the message's words, so a screen reader reads a banner as it appears without its button labels; notices work the same way: one that takes focus (an Undo offer, anything shown in Sync) is read out by that, any other from a hidden status holding only its words. A choice in the sync conflict gets the same Undo offer. A notice for something done in Settings → Sync (joining, the conflict choice, Turn off, Delete server copy) shows at the top of the Sync group instead, full width, where the user is, and takes focus; it stays while Sync is open, since it may hold the next step and a notice vanishing under the user would drop their focus and move every control below; if Settings closes it moves to the top of the page and clears itself 8 seconds later. A routine confirmation anywhere else clears itself after 8 seconds, its clock stopped while the pointer or focus is on it. Whenever a notice goes while focus is on it, focus moves on: to the Sync group's first control, or to the current game. Turn off carries the same 20-second Undo, which syncs again with the same key, quietly (Syncing, never a passing Waiting that would be read out). Sync that has stopped (a conflict, the server copy is gone, the server keeps failing, the plan is too big to sync) gets a caution banner wherever the user is: the warnings' Caution Amber wash and border with their 16px alert icon, one plain sentence that opens with the state in Sync's own words ("Different plans", "Server copy deleted", "Sync failed", "Not syncing") and ends with where the changes are, and a small "Open Sync" that brings Settings → Sync into view; waiting for the connection is normal and stays in Settings, and while Sync is open in Settings the banner steps aside (its status already says it). "Open Sync" brings the group into view with focus on its heading, never on an action. A focused notice stops below the sticky top bar. A banner's buttons are all small buttons: primary small for an action on the plan (a conflict choice, Undo), a default small one for news about the app (Reload, Download and install: The One Blue Rule), ghost small for Later and Dismiss; full size on a touch phone; a banner that asks for a decision about the plan sits above news about the app.
- **Settings groups:** a connection that is set up folds to its state and a ghost small "Change" (IGDB, Steam, Sync). Sync's state is a word with an 8px dot, like the Now playing drift: "Synced" in Finish Green with the time since in Ink Muted ("5 min ago", then dd.mm.yyyy, HH:mm after a day), "Waiting" in Caution Amber ink with an amber dot, "Last synced" the same way when the last check didn't get through and nothing waits to go up (with the time it last did, never a green "Synced just now"), "Sync failed", "Not syncing", "Different plans" and "Server copy deleted" in Drop Red, and a hollow Ink Muted ring while it is turning on or syncing; a 12px Ink Muted sentence under it says what the state means. Its one action sits beside it (Check now, "Choose which to keep" in a conflict, "Export this plan" with a download icon when the plan is too big to sync, since checking again can't help); after Check now, a 12px Ink Muted line under the state always says what it found, with the time it tried as a time of day, which stays true as the minutes pass ("Checked at 15:12: this device has the latest plan", "…this device's changes went up, and it's in step", "Tried at 15:12: the sync server couldn't be reached", "…had a problem again"); it is read out only when the state's word didn't change, since otherwise the announcer reads the new state. Failure states (Waiting, Sync failed, Not syncing) keep "last synced 5 min ago" beside their word, so it's clear how far behind the server may be. Once the server copy is gone, Change steps aside and two equal default buttons sit under the state, one under the other, each with its hint, as when sync is off: "Start again from this device" (its plan goes up under a new key, so the deleted key and every link and QR code made from it stay dead, as the delete warning says) and "Stop syncing here" (no Undo, since there is nothing to go back to; a notice says the plan stays and points to joining a plan another device started again). If the server then wants an invite code, the form asks for it as a question: the hint says so, nothing is red until a code is actually refused, and its way out reads "Stop syncing here", not Cancel. Change opens Turn off and Delete server copy (danger ghost) directly under the state, each with its hint under it and 20px clear of what follows. Under them, "Add another device" (a field label) leads with one way and keeps the rest behind a ghost small "Other ways" with a chevron: a touch screen leads with "Share join link" (the system share sheet; closing it does nothing, a refusal copies instead) or, without a share sheet, Copy join link, and keeps Copy join link and Show QR code behind Other ways, because the phone in hand is rarely the screen another camera reads; with a mouse Copy join link and Show QR code lead (a 168px tile, Paper with Ink modules in both themes, because cameras read dark on light). One hint under the row, worded for what leads (send the link with the share sheet, copy it, or open it or scan the QR code with the other device's camera), says what to do with it and that whoever has it can change the plan; nothing points at a code the screen isn't showing. The key waits behind Other ways in every layout, shown in full there (opening it is the deliberate step) with Copy key and its own hint; on a narrow phone it wraps at a dash, between groups. When the clipboard refuses, the link or key is shown as text that one tap selects, with a line saying to copy it by hand. Sharing is hidden in a conflict and once the server copy is gone, where a link would lead into the same choice or nowhere. Change and Other ways keep their names while open (aria-expanded carries the state) and are lit like the Settings button. The state is not a live region, since its time since ticks every minute; a hidden announcer reads out a move into trouble and back to "Synced" once, never an ordinary push, and clears itself after a few seconds. Off, Sync asks first: "Start syncing here" ("For your first device. If you were given an invite code, you'll enter it next.") or "Join a plan from another device" ("Already syncing on another device? Use its join link, QR code or sync key."), two equal default buttons one under the other, each with what it is for right under it: an empty copy may be a first device or a second, so the person picks by what they hold, and the app does not guess; each opens its own small form (invite code, or key or join link) with a ghost Cancel back to the question. The invite code is typed as given: the field turns off a phone's capital first letter and autocorrect, and the server ignores capitals, so "Review-invite" from a phone keyboard is accepted. Joining a copy that has its own, different plan opens the conflict dialog at once; a copy that holds the same plan (a device rejoining its own key after Turn off) joins without asking, with the same "Joined" notice. Same means the same games, sessions and plan settings; when each copy was written, the id counters, the credentials and the theme don't count. Two copies that both changed the same way settle the same way, quietly. In the web app a connection that is not set up folds too, to "Not set up" and a small "Set up", so a phone reaches Sync without scrolling past two forms; the empty PC plan of an empty web copy keeps its hours-per-week sentence, with the current value and where to change it, and offers "Set up sync", which brings Sync's two choices into view; once the copy syncs, the empty plan says so instead ("This plan syncs: games added here or on your other devices appear in it"), so an empty synced phone is not mistaken for one that was never set up.

**The Second Chance Rule.** An undo offer lasts 20 seconds and says so. The clock is a draining track and a count, not a toast that vanishes; it waits while the pointer or focus is on the notice, and the notice takes focus when it appears so the offer is the next thing a keyboard reaches.

### Tables
Flat inside a 12px Paper wrapper with the Ambient shadow. Headers are sticky under the top bar on Paper Shade, 11px/600 uppercase tracked Ink Muted; cells are `7px 10px` with a Rule bottom edge, the last row rounding into the wrapper. Rows tint to Paper Hover on hover; the current game's row holds Current Row Wash even under hover; paused titles go muted; a dragged row's cells take Paper Shade and the Popover shadow. Numbers and dates are tabular and right-aligned; titles are 550 with a 40×24 cover; notes are Ink Muted, clamped to two lines, 160–340px wide. A 22×24 grip handle in Ink Muted starts each reorderable row. Each row is one Tab stop that lands on the title; Left/Right (Home/End) move across the row's cover link and action buttons, and the row remembers the control it left.

### Dialogs
Native `<dialog>` at 14px with a 1px Rule, Paper fill, the Dialog shadow and scrim, widths `min(560px, 100vw − 32px)` (lg 680, xl 880). Content padding `20px 24px 22px`; the Headline title keeps 36px clear for the ghost icon close button at `14px 14px`; actions are right-aligned with 8px gaps, 12px below the form. Focus moves to the first control (and stays in view when content arriving after the dialog opens makes it taller) and returns to the opener on close; the action row is a plain container, not a footer landmark. Details opens at md for a game with no IGDB link and at xl once covers and screenshots exist; the unlinked footer states what IGDB adds, offers "Set up in Settings" while no credentials are saved, and makes Edit game the primary action (Close is primary once linked). On a phone (a touch screen in the folded layout, or under 600px) every size runs the viewport's width less 16px (the browser's own dialog max-width is lifted, or it would win), and choices too long to share a row stack full width in the order they are written, the way out last, pinned at the dialog's foot while the evidence above scrolls (their 12px top gap is a fade, so what scrolls under them melts away and nothing at rest is covered; a control focused in the scrolling part stops above them); a narrow window with a mouse keeps each dialog's own width and its actions in a row.

A choice between two copies of the plan (the sync conflict) is made from evidence, not on trust: a small ledger in the dialog compares games in the plan, finished games, hours logged and when each copy last changed (13px Ink Muted row labels, tabular right-aligned values, differing counts and the newer time at 650; on a phone the labels wrap and cells sit 10px apart, and under 380px a time stacks under its date; two changes in the same minute show their seconds). Under the ledger, because totals can match while the games differ, 13px lines name the titles each copy has that the other lacks: "Only on this device:" and "Only on the server:" at 600, then up to three titles and an Ink Muted "(+N more)"; when both hold the same titles one muted line says the difference is in their details (hours, order, dates or what is finished) or the plan's settings; plans that match entirely never reach the dialog. A ghost small "Export this device's plan first" with a download icon sits under them, its words aligned with the text, so the safety net is named where the choice is made. Two sentences say what a choice does (nothing is merged; the kept plan replaces the other everywhere; Undo brings the other back for 20 seconds; nothing syncs until a choice), neither choice takes the primary style, and the dialog's text is its accessible description. It opens with focus on its question, scrolled to the top, so the ledger is read before any button and a short phone isn't scrolled past it; its buttons are written in the order they are seen (Keep this device's plan, Take the server's plan, then Decide later), so Tab follows the eye, and Escape decides later. Deleting the server copy asks in a small dialog whose confirm button says what it deletes ("Delete server copy", danger) and whose warning says what happens elsewhere: other devices keep their plan and are told the copy is gone, shared join links and QR codes stop working, this device keeps its plan.

### Now playing (signature)
The screen's peak. A 12px card washed with Plan Blue Wash at 45% into Paper, a 22%-accent border and the Ambient shadow; `20px 24px` padding, a 22px gap between the 96×128 cover (8px, Popover shadow) and the body. The title is Display with a 450-weight year; a 13px Ink Muted meta line holds the status word, Design chip, genre chip and start date; actions (Log hours, Pause, Finish game) sit to the right. An 8px Plan Blue progress bar on a 14%-accent track (520px max) is followed by 13px/600 tabular hours text; a status line carries an 8px drift dot (Finish Green "on track" or "ahead", Drop Red "behind"), days left and end date, and the next game. With nothing in progress the card goes quiet: Paper fill, Rule border, Headline title "Nothing in progress", and one primary Start button for the next game, named with that game; in the one-column layout its content keeps the left edge rather than floating in the middle. On a phone (a touch screen in the folded layout, or under 600px) the actions are a block, Log hours and Pause side by side and Finish game the full width under them; a narrow window with a mouse keeps them in a row. Below 900px the progress bar takes the card's width with its hours line under it.

The status line ends with the plan's two inputs, `started dd.mm.yyyy · N h/week` ("plan starts" when the game in progress is not first), separated by a 6px gap around a middle dot. Each is a link-style control with a dotted Rule Strong underline (solid Plan Blue on hover or focus) and a 12px pencil at 60% that lifts to full on hover or focus; activated, it becomes a field in place (13px, 6px corners, `1px 6px` padding): a 72px number field followed by "h/week", or the compact DateField. It saves on Enter or blur, cancels on Escape, and shows the Settings error copy beneath itself when the value is invalid (hours run from 0.5 to 168); afterwards the control returns to text and keeps focus. A 12px Ink Muted note under the line explains the mechanism and ends "Click or tap a value to change it." The idle card carries the same line.

**The Edit Where You Read Rule.** A number that moves the plan is edited where its effect is read. Settings keeps the same field, but the card owns the moment, and saving there recalculates every date at once.

**The Handover Rule.** When the current game changes after mount (not when a plan tab switches the card to another list), the cover and body enter with `now-enter`: 400ms `cubic-bezier(0.16, 1, 0.3, 1)`, opacity 0→1 and an 8px rise. The first paint never animates. Under `prefers-reduced-motion` the entrance is a 200ms fade; the finished-row settle shortens from 1600ms to 800ms and control transitions are removed.

**The Dot Not Pill Rule.** Status is a word with a dot. Only "Dropped" and the "Today" marker are pills, and no status gets a colored border.

## Do's and Don'ts

### Do:
- **Do** draw every icon with the `Icon` component: a 24-unit grid, 2px round-capped strokes in `currentColor`, 16px by default, `aria-hidden`, with the surrounding control carrying the accessible name.
- **Do** keep Plan Blue for action, selection and the current game (The One Blue Rule) and give every fill its `--on-*` text token so dark theme flips to dark ink.
- **Do** set compared numbers in `tabular-nums`, right-aligned in tables, and dates as dd.mm.yyyy.
- **Do** write labels in sentence case at 12px/600; reserve uppercase 11px tracking for table headers and search section names.
- **Do** make hover a one-step tint with a 120ms ease, only where the device can hover (a tapped button on a touch screen keeps no tint), and focus a 2px Plan Blue outline offset 2px (inset 2px inside menus).
- **Do** set a caution in running text (the browser may clear its data) in Caution Amber ink; Drop Red is for what failed.
- **Do** nest radii: 12px container, 8px control, 6px small control, 14px dialog, pills for chips and counts.
- **Do** give floating surfaces the Popover shadow and resting surfaces the Ambient shadow; keep tables flat inside their wrapper.
- **Do** keep the current game's row on Current Row Wash under hover, and let row actions brighten from Ink Muted to Ink on hover or focus-within.
- **Do** name the empty state's fact and its next step in a dashed 12px panel with one button (only an empty state the user's own filtering caused is read out as it appears), and only a button the section head doesn't already offer (the plan and finished games leave adding to their heads).
- **Do** make a row and a segmented control one Tab stop, with Left/Right moving inside, and keep the skip links before the top bar.
- **Do** take every date as dd.mm.yyyy text through `DateField`, with the native picker behind its calendar button.
- **Do** show an undo offer's clock (a draining track and a count) and pause it while the notice is hovered or focused.
- **Do** give every control on a touch phone at least 40px, or a 10px taller hit area for a link inside a line of text (The Fingertip Rule); keep desktop density for a mouse.
- **Do** keep a restyled table a table for screen readers: a header row hidden from view only, and explicit table, row, header and cell roles.

### Don't:
- **Don't** use Unicode glyphs or emoji as icons; every icon is an inline SVG from the set.
- **Don't** add colored side borders, left stripes or solid colored edges to rows, cards, banners or chips; role color enters a border only through `color-mix`.
- **Don't** add eyebrow or kicker labels above headings; a section is a Headline, optionally with a count pill.
- **Don't** animate on page load, stagger entrances or add page-load choreography; the only entrance is the Now playing handover after a change.
- **Don't** load a webfont, a display face or a monospace face; system-ui is the one family.
- **Don't** use hard offset shadows, colored shadows or hover lifts; depth is ambient and hover is a tint.
- **Don't** hard-code white text on an accent or semantic fill; use the `--on-*` token.
- **Don't** render status as a colored pill or badge (except "Dropped"); it is a word with a dot.
- **Don't** rename the "Design" chips or their six fixed color pairs.
- **Don't** add a max-width container or a sidebar, and never let the page scroll sideways: columns drop at 1240px and 1184px, and below 900px the tables fold into stacked rows.
- **Don't** show a bare native date input or let a date read month-first; `DateField` wraps the picker.
- **Don't** make every row action its own Tab stop; the row is the stop and arrows move inside it.
