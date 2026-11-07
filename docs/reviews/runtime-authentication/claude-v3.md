# Runtime authentication — independent design and functionality review (Claude, v3)

Date: 2026-11-07
Scope: the current runtime authentication and credential revision, rechecked against [claude-v1.md](claude-v1.md) (6/10), [claude-v2.md](claude-v2.md) (7.5/10) and [codex-v4.md](codex-v4.md) (9.3, approve).

What I read:

- `AGENTS.md` and `docs/runtime-authentication.md`.
- Current source: `ConnectionField.tsx`, `useRuntimeConnection.ts`, `RuntimeConnectionSettings/helpers.ts`, `AuthOpenLink.tsx`, `WaitingSignIn.tsx`, `AuthLogout.tsx`, `AuthTerminal.tsx`, `AuthInteraction.tsx`, `TerminalActions.tsx`, `useAuthTerminalSurface.ts`, `useAuthTerminalQueue.ts` and `terminal-buffer.ts`.

Images: I opened all 23 PNGs in `%TEMP%/pitchcrew-runtime-auth-review-20261107/final-v3/` and no others. Before reviewing, I recomputed their SHA-256 hashes; all 23 match `manifest.json`. The two consent images now have different hashes (`DEAF7A…` before, `7D3A63…` after).

I changed nothing except this file. I did not run the app, tests or a browser preview.

## Score: 8.8/10. Approve, with low-severity polish remaining

Both the source and a coherent screenshot set now confirm every v2 must-fix and should-fix item. The evidence problem that held v2 at 7.5 is resolved: the unreadable/recovered states, the post-fix terminal and the post-consent state are all shown in their current form.

I am not matching Codex's 9.3 for two reasons:

- A few visible layout and hierarchy problems remain in the states that were just fixed.
- The real Electron opening path and every live provider remain unobserved.

## v2 findings: status

| v2                                         | Source                                                                                                                                                                                                                                                                                                                | Screenshot                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1: blanking a non-secret field snaps back | Fixed. `useRuntimeConnection.ts` `typeValue`: an empty non-secret value records `''` and is marked `incomplete`. `save()` refuses while `incomplete` has entries. `ConnectionField.tsx:47,54-55` keeps the field blank and shows "Enter a value, undo this change, or choose Disable…". Secrets still undo the draft. | Not captured; covered by source only                                                                                                                                                                                                                                                                                                                                                                                                    |
| S1: inherited invalid endpoint leaked      | Fixed. `field.invalidValue` blanks the value (`ConnectionField.tsx:47`) and appends a fixed message. The option label adds "Needs correction".                                                                                                                                                                        | Not captured                                                                                                                                                                                                                                                                                                                                                                                                                            |
| S2: no feedback after desktop consent      | Fixed. `AuthOpenLink.tsx:333-352` shows "Sign-in page requested…" and the link becomes an outline **Open sign-in page again**. `key={interaction.id ?? auth.id}` (`WaitingSignIn.tsx:28`) prevents the accepted state carrying over to a later interaction.                                                           | `native-signin-browser-consent-desktop.png` → `-acknowledged.png` visibly differ. The layout regression is described in P1.                                                                                                                                                                                                                                                                                                             |
| S3: copied text was the raw stream         | Fixed. `terminal-buffer.ts` reads `buffer.active` with `translateToString(true)` and joins `isWrapped` rows. Text refreshes in the `write` callback and `onResize`, guarded by `surface.current === terminal`.                                                                                                        | `native-signin-terminal-redraw-desktop*` shows the settled redraw (Current provider / LIVE-1234 / URL) with a single **Open auth.openai.com sign-in** and **Copy code LIVE-1234**. `native-signin-terminal-phone-dark-part2` shows the URL soft-wrapped as `…fixture=p` / `hone` and still offered as an open action, so wrapped lines are joined. `https://example.invalid/untrusted` is correctly not offered on the desktop capture. |
| S4: busy errors hidden                     | Fixed. `helpers.ts:33-42` allowlists the fixed busy messages and the "Wait for this runtime to become idle." prefix.                                                                                                                                                                                                  | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| S5: installation probe environment         | Docs now accurate (`runtime-authentication.md:99`): the version-only check uses the inherited daemon environment and does not read or adopt damaged overrides.                                                                                                                                                        | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| S6: model refresh scope                    | I accept the caller-wrapping explanation (`runtimeMaintenance.metadata(id, …)`) and the stale `configurationError` clearing, as reported in codex-v4. I did not re-trace the server chain in this pass.                                                                                                               | n/a                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| L1: macOS Cmd+C wording                    | Fixed: "Ctrl/Cmd+C copies a selection; Ctrl+C without a selection interrupts the CLI."                                                                                                                                                                                                                                | Desktop and phone terminal captures                                                                                                                                                                                                                                                                                                                                                                                                     |
| L2: late corruption did not expand         | Fixed according to the source summary and codex-v4 (controlled Accordion).                                                                                                                                                                                                                                            | `authentication-settings-unreadable.png` opens with the credentials section expanded                                                                                                                                                                                                                                                                                                                                                    |
| L3: Disable shown for unset fields         | Fixed: `ConnectionField.tsx:69`.                                                                                                                                                                                                                                                                                      | —                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| L4: fixed input ID                         | Fixed: `useId` with `describedBy` passed to `ConnectionValue`, choices included.                                                                                                                                                                                                                                      | —                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| L5: double hairline on phone               | Fixed.                                                                                                                                                                                                                                                                                                                | `credentials-phone-dark-draft-part3.png` shows one rule above "Changes to save"                                                                                                                                                                                                                                                                                                                                                         |
| L6: see-through sign-out dialog            | The dialog is now opaque in both captures. The remaining issue is P3.                                                                                                                                                                                                                                                 | `native-signout-*-confirmation-desktop.png`                                                                                                                                                                                                                                                                                                                                                                                             |

Unreadable and recovered states, verified visually (the main gap in v2):

- **Unreadable** (`authentication-settings-unreadable.png`):
  - Installation shows **Ready**; Sign-in and Models both show **Recover settings**.
  - There is one alert, which explains that work is blocked.
  - The runtime row action reads **Recover authentication settings**.
  - There is no "Install first" text and no duplicate alert.
- **Recovered** (`authentication-settings-recovered*.png`):
  - A notice names the backup file and says "Daemon environment values apply again. Recheck sign-in…".
  - The field shows Inherited and offers no **Use daemon value** button.
  - Recheck sign-in is available.

## Remaining findings

No must-fix findings. Nothing below is a security, data-loss or approval problem.

**P1. Low-medium — After consent, the action row collapses into a confusing wrap.**
In `WaitingSignIn.tsx:25-42`, `AuthOpenLink` returns the `<output>` status as a sibling inside `.settings-row-actions`. The flex row therefore holds the status sentence, **Open sign-in page again** and **Cancel sign-in**.

In `native-signin-browser-consent-acknowledged.png`:

- The sentence and the reopen button share the first line.
- **Cancel sign-in** wraps alone to a left-aligned second line.
- Before consent, the same actions were a right-aligned pair (`-desktop.png`).

The layout jumps exactly when the user returns from the browser, and the action alignment no longer matches every other row in the dialog.

Fix: render the status `<output>` above the actions row, either by returning a fragment that `WaitingSignIn` places outside the row or by lifting `accepted` up to `WaitingSignIn`.

**P2. Low — The recovery surface has no primary (glaze) action.**
In `authentication-settings-unreadable.png`, **Recover authentication settings** is the only way forward from a blocked state, but it uses the outline/raised style. The footer offers only **Close**. Under the "one glaze action per surface" rule, recovery should be the glaze action here.

The recovered screen then correctly gives the primary to the native sign-in method, with Recheck as secondary.

**P3. Low — The nested sign-out confirmation reads as a popover rather than a modal.**
`AuthLogout.tsx:402-440` and both `native-signout-*` captures:

- The confirmation sits over the setup dialog with no visible scrim on the parent.
- It partially covers the "Credentials…" and "Account details…" row labels.
- The `DialogTitle` and `DialogDescription` have almost no gap, so the title crowds the body.
- **Sign out** (destructive) and **Keep account** have nearly equal visual weight. That is acceptable for a destructive action, but the missing scrim makes the setup controls behind it look still active.

Fix: use the nested-dialog backdrop the shared Dialog already supports, or an `AlertDialog`, and add the standard header gap.

**P4. Low — The "Copied." notice never clears.**
`AuthTerminal.tsx:20-25,46-50` sets "Copied. Sign-in is still waiting." and never clears it. Later output, redraws or a different copy target leave the notice in place, as seen in both terminal part2 captures. Clear it on the next interaction output or after a short timeout. The `aria-live` region still announces a repeat copy only if the text changes.

**P5. Low — The phone terminal hint describes keyboard shortcuts.**
`native-signin-terminal-phone-dark.png` shows four lines of Ctrl/Cmd+C/Tab guidance on a touch device, pushing the terminal below the fold. On coarse pointers, shorten the hint to the waiting/closing sentence; the copy buttons cover the touch case.

**P6. Low, cosmetic — The terminal area is mostly empty.**
At 14 rows on desktop, the real-PTY and device captures show 3–4 used lines and about 200px of empty recessed area, which pushes the actions and the closing note toward the footer. Consider fitting rows to content up to the current maximum. This is optional.

## Verification limits

- These test results were reported to me and not rerun: 45/45 browser (21 auth + 24 setup/model), 9/9 private API, 30/30 focused unit, the earlier 452 passed + 2 skipped broad suite, 31 other settings browser tests, lint for 1107 TSX files, root and landing types, and UI and Electron builds.
- **The real Electron `window.open` after an asynchronous consent POST has not been exercised live.** It happens outside the click's user activation, so it relies on the established `setWindowOpenHandler` path and on Electron not blocking popups. The desktop UI test mocks `window.pitchcrewBrowser`. If Electron does block it, the user sees "Sign-in page requested" with nothing opened. The secondary **Open sign-in page again** link is the only fallback, and it is a real anchor activated by a user click, so recovery is possible.
- No real OAuth, login or logout, account mutation, provider inference or Demo runtime was used. All terminal output is fixture text. Real Copilot, Grok and OpenCode output formats and their link hosts are not confirmed against the extraction patterns.
- I did not rerun anything, use a browser preview or verify with a screen reader or a physical phone.
- The M1 incomplete-blank state and the S1 invalid inherited value have no screenshot; source reading is my only evidence for them.
- I trusted codex-v4 for the server-side S6 call chain.
