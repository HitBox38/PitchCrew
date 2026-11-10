# External agents settings: independent design/UX review (Claude, v3)

Date: 2026-11-10 · Scope: uncommitted v3 changes on `t3/external-agent-ux-review`, covering Settings > Accounts > External agents and the shared labelled copy button. This is a fresh, read-only review: I read v1/v2 for context and applied no fixes.

**Score: 9.1 / 10** (for the external-agent Settings flow only)

Both material gaps from v2 are fixed, and I verified each fix in the live UI, not only in source. Nothing I found blocks the flow. The remaining items are polish that v2 already listed and v3 did not take up. The score is not rounded up to reach a target. It sits just above 9 because the few rough edges (a truncated title on phones, a nested config scroller, heading order) are real but don't get in the way of the task.

## How it was checked

- **Source:** the `SourceBlock` and `CodeBlockCopyButton` diffs, plus `ExternalMcpSettings/index.tsx`.
  - `copyLabel` now sets `aria-label={copyLabel ?? \`Copy ${label}\`}`.
  - The button renders the label in a `<span>` beside the copy/check icon.
  - `key={value}` resets the copied state when the configuration format changes.
  - The `saved` `<output>` now renders inside the "Choose access" `<li>`, directly after `<ExternalAccess>`.
  - I didn't rerun lint, tests or the desktop smoke selectors; the root agent owns those.
- **Live:** my own new tab on `http://127.0.0.1:14581/settings?section=accounts` (the isolated `pitchcrew-external-review-20261110` workspace, production mode, no Demo).
  - Checked at 1280×800 light and 390×844 dark.
  - I confirmed v3 was rendering before judging: both buttons' accessible names were exactly the visible text.
  - I closed the tab afterwards and didn't start or rebuild anything.
- **Flow I ran:**
  1. Initial state: "This workspace · Read-only". Evidence showed "Waiting for your app's first request", as expected after v2's token rotation.
  2. **Copy names.** `button[aria-label="Copy configuration"]` had text "Copy configuration" and measured 160×32 on desktop and 160×44 on mobile. `button[aria-label="Copy prompt"]` had text "Copy prompt" and measured 124×32 / 124×44. The accessibility tree reports `button "Copy configuration"` and `button "Copy prompt"`.
  3. **Copy feedback.** A real click on Copy configuration kept focus on the button, and the adjacent polite live region read "Copied". The visible label stays "Copy configuration", which keeps it stable for voice control. The icon swaps to a check for 2 s; the source sets a 2 s timeout, and by my next read it had already reverted to `lucide-copy`, which is consistent with that.
  4. **Save placement.** I turned on **Allow changes and crew messages**:
     - Desktop: switch at y=276–300, `<output>` "Access saved: job changes and crew messages. Reconnect your apps." at y=328–348, 28px below the switch. In v2 they were about 260px apart.
     - Mobile: switch bottom 233, status 271–311, directly under the switch tray.
     - The scope fact changed to "Job changes + crew".
     - The next step moves down 20px when the line appears. That shift is below the control the user just touched, so it's acceptable.
  5. I turned it back off: "Access saved: read-only. Reconnect your apps." and "This workspace · Read-only". The final access level matches what I found; the fixture token rotated twice.
  6. Mobile dark: no horizontal scroll (`scrollWidth` 390). Switch tray, status, select and code block are all legible, and the switches keep their 44px row targets.
- **Not repeated:** bridge success, read-only rejection auto-update and token-rotation evidence reset. v2 verified these, and v3 doesn't touch that path.
- **Not tested:** no real external app (Claude Desktop/Code, Codex, Cursor) connected and no stdio `mcp serve` process ran in this review. I made no bridge calls and no paid runs. Clipboard contents weren't read back: the click reached the success path ("Copied"), but I didn't verify the system clipboard. Electron/native smoke selectors are taken from the root's report, not rerun.

## Resolved since v2 (verified)

| v2 finding                                        | v3 evidence                                                                                                                                                                                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Copy accessible name ≠ visible label (WCAG 2.5.3) | Names are exactly "Copy configuration" and "Copy prompt", matching the visible text. Copy success is announced through the polite live region ("Copied") and shown by the check icon, without renaming the button. Icon-only `SourceBlock` callers keep `Copy ${label}`. |
| "Access saved" far from switches                  | The `<output>` sits in the Choose access step, 28px under the changed switch on desktop and directly under the tray on mobile. It follows the "confirmation follows the changed control" rule in AGENTS.md. It remains an `<output>` (role status).                      |

## Remaining findings (none blocking)

- **Mobile config title truncates.** At 390px, "Pitchcrew MCP configur…" is cut to 132px by the 160px button. Fix with a shorter title ("MCP configuration") or let the header wrap. This was noted in v2 and is unchanged.
- **Nested config scroller.** The 160px raw JSON scroll area inside the page scroll is mostly path noise on phones. Optional: put the raw text behind a "Show configuration" accordion and keep Copy as the primary control.
- **Heading order.** "No request received?" is exposed as `heading level=3` under step `h4`s, which comes from Base UI's default accordion header. This is a shared-primitive fix.
- **Source-launch paths aren't called out.** This run's `command` is a bun in `%TEMP%` plus a worktree checkout. The generic "moving or deleting… breaks the connection" warning is true, but it doesn't flag that a temp path may disappear without any user action. This only affects source launches.
- **Same-text re-save is quiet.** If the user toggles the same switch twice, the `<output>` text can repeat a string it showed earlier. Screen readers may not re-announce an unchanged string. This is minor because the scope fact also changes.
- **Earlier success hidden by a later failure, and polling never stops once a request arrives.** Both are unchanged from v2 and both are acceptable trade-offs.

## Score rationale

v2's 8.5 was held down by one accessibility defect on the step's primary action and one break of a written Settings rule. v3 fixes both with small, contained changes. The shared-button change keeps icon-only callers intact, and the save line now sits next to the control in both layouts. I watched both fixes work live in light and dark, at desktop and phone widths. What keeps this from scoring higher is polish rather than broken behavior: mobile title truncation, the nested scroller, heading level and temp-path honesty. I also haven't seen a real external app go through the stdio path end to end. The score covers only this Settings flow.
