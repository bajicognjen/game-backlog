---
version: 1
slug: "src-components-nowplaying-tsx"
primary_target: "src/components/NowPlaying.tsx"
related_targets: ["src/App.tsx"]
---

# Surface brief: Now playing card, plan inputs

Scope: the Now playing card on the PC plan (`src/components/NowPlaying.tsx`). Visitor mode: Operate.

- Job: the owner reads the card to know where the plan stands; the two numbers every date follows from (plan start date, hours per week) are edited where their effect is read. Settings keeps both fields; the finish dialog's "Next game starts" is unchanged.
- Interaction: the status line ends with "started dd.mm.yyyy · N h/week" ("plan starts" when the game in progress is not first). Each value is a quiet link-style control with a pencil hint on hover/focus; click or Enter turns it into the matching native field in place; Enter or blur saves, Escape cancels; an invalid value shows the Settings error copy under the control and does not save; after saving the control returns to text and keeps focus; every date recalculates as from Settings.
- Explanation: one muted line under the status line explains the mechanism (hours left ÷ hours per week gives the weeks).
- States: the idle card shows the same editable line; the PS5 queue has no inputs; an empty plan hides the card.
- Boundaries: no new tokens; the card's wash, hierarchy and the three actions unchanged; the status line stays one row at 1280 and wraps at 900; controls carry accessible names.

Decided with the user on 2026-11-06 via `shape`.
