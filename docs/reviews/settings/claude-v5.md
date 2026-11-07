# Settings V5 design review: **8.9 / 10, not yet above 9**

There's no ship blocker, but one defect needs fixing first: the new service warning understates what the action does. Fixing that and the key form focus (defects 1 and 2) should put this around 9.2, and I'd count that as above 9 without another full pass.

I reviewed all 54 `v5-*` captures and the relevant source, without running the app or tests. The aggregate rerun result is yours to confirm.

## Rubric

| Area                                    | Score | Why                                                                                                                   |
| --------------------------------------- | ----: | --------------------------------------------------------------------------------------------------------------------- |
| Visual coherence (clay, light and dark) |   9.4 | All 9 sections read as one system, and phone dark holds up.                                                           |
| Navigation and search                   |   9.3 | "sounds" returns one result and lands on an outlined target; the tablet label is visible.                             |
| Copy and truthfulness                   |   8.6 | Generally precise, but held back by defect 1.                                                                         |
| State coverage                          |   9.2 | Consent on/off, connected GitHub, populated source, healthy and elsewhere service, and storage failure are all shown. |
| Validation and recovery                 |   9.3 | Missing and invalid values are separated, and the summary, inline error and footer agree.                             |
| Accessibility (from source only)        |   8.5 | Labelling is good, but held back by defect 2.                                                                         |
| Responsive and touch                    |   8.9 | Empty states are solid; populated phone states are unproven (evidence gap 1).                                         |
| Credential and approval boundaries      |   9.2 | The external config has only `command` and `args`, and read-only access is asserted and revoked afterwards.           |
| Evidence quality                        |   8.7 | Honest and broad, with the gaps listed below.                                                                         |

The unweighted average is about 9.0. I scored it at 8.9 because the two weakest product areas (copy and accessibility) are where the concrete defects sit.

## Remaining defects

**1. The service reassignment warning leaves out the immediate stop (fix before shipping).**

- **Current copy:** `ServiceState.tsx:46-47` says the other workspace "will no longer start at login; keep it open to run its routines."
- **What the code does:** on Windows, `register` stops the running service daemon when the definition changes, and force-kills it after about 10 seconds (`windows.ts:93-99`, `:127`). `index.ts:102-104` marks a move as changed, and `linux.ts:96` restarts in the same case.
- **Why it matters:** a headless workspace goes down on one click, and any work it's running is interrupted. "Keep it open" also implies it stays up.
- **Fix:** when `status.running` is true, add something like "Its running service stops now, and any work in progress is interrupted. Open that workspace again to keep running its routines." A confirmation step is worth considering, but the copy is the required part.
- **Not checked:** I didn't read the macOS path or trace how `servicePid` is derived. A separately opened daemon probably survives, so confirm the wording against that.

**2. The detector key form loses keyboard focus in both directions.**

- **Opening:** "Add key" unmounts its own button (`DetectorSettings.tsx:42-48`) and the new field has no focus handling (`DetectorKeyForm.tsx:43-51`).
- **Closing:** Cancel and Save unmount the form with nothing restoring focus (`useDetectorSettings.ts:18`).
- **Effect:** focus drops to the page body, which falls short of the focus restoration used elsewhere in Settings.
- **Fix:** focus the first field on open, and return focus to the row's button on close.

**3. The storage notice moves the page under the pointer.**

- **Evidence:** the sounds switch sits at y≈439 in `v5-fixture-search-target` and y≈500 in `v5-fixture-storage-unavailable`. The segment now under that pointer position, "Full", shows as highlighted.
- **Effect:** a quick second click could change the chat reading width instead of the switch. It only happens when storage has failed, so it's minor.
- **Fix:** reserve the space, or show the notice without pushing content down, for example inside the changed row.

**4. The same card uses two words for one thing (small).** The status says "Installed for another **folder**", while the two sentences below it say "**workspace**" (`helpers.ts:12`). Use "another workspace".

## Evidence gaps (not product defects)

1. **Populated phone states aren't covered.** The 44px assertion loop (`settings-evidence.test.ts:79-96`) only runs against the fresh workspace. I saw no phone capture or target check for connected accounts, the source row and editor, the key form or the MCP config. The source row with Watch, Edit and delete is the riskiest of these.
2. **`v5-fixture-phone-rule-error` isn't a touch capture.** It's a desktop context resized to 390px with no `hasTouch` (`:140`, `:221`), so its visible spinner is correct for a fine pointer. It doesn't prove spinners are hidden on touch; only the CSS and the unfocused `phone-dark-rules-part2` support that.
3. **The MCP config capture is incomplete.** The image stops at `--port` inside its inner scroll, so the tail is only checked by the test. It also runs under Vitest with Node and `tsx`, so it doesn't show the command a packaged app would produce.
4. **Not read or not claimed.** I didn't read the new numeric unit assertions; the helpers and the exact footer assertion (`:235`) do check out. Like you, I make no claims about screen readers, real phone keyboards, the installer or sign-in.

## Confirmed fixes

- **V4 requests:** the reassignment warning is visible before the action, though defect 1 still applies. Numeric summaries separate missing from invalid values, and the footer string is exact.
- **Watch source:** it has a visible label and keeps its labelled association, and the naming is consistent across row, editor and status.
- **Polish:** search matching is lexical, the Configure arrow is in place, and Runtime updates sits in a matching tray. The tablet search label shows, and I saw no double separators.
- **Healthy service:** the fixture shows no install action and asserts no mutation calls.

## Optional additions (not defects)

- **Save key:** explain why it stays disabled under 8 characters.
- **Share anonymous usage:** it's the only privacy row without a description.
- **Editing a source:** open the editor in place of the row rather than above the list.
- **Light mode:** off-state switches are faint, which is worth a contrast check in the design system.
- **Footer problem count:** make "1 problem to fix before saving" jump to the problem.
- **Phone "Apply to":** tighten the row gap where "Note" wraps.

## Before opening a PR

`docs/reviews/settings/images` is 23 MB across 175 PNGs and isn't gitignored. Some captures show `%USERPROFILE%\…` paths and installed CLI versions. Decide whether these belong in the repo, given the rule that user data stays out; I'd keep them out or commit only a scrubbed final set.
