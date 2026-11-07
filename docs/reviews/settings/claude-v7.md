**Final score: 9.3/10. Ship once the Evidence 3 rerun passes.** Both changes are correct, with no blockers and one new cosmetic screen-reader issue. I read the source, tests and the five kept images, but ran nothing, so I'm relying on your reported results (31 browser, 211 unit/adapter, typecheck, lint, build).

## Change 1: detector focus (`useDetectorSettings.ts:17-23`) – correct

| Scenario                                      | Result                                                                                                                         |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Remove Sapling while GPTZero's editor is open | Focus moves to Sapling's Add key, and the GPTZero draft survives because `editing` isn't touched.                              |
| Opening another editor later                  | Can't steal focus: `setEditing` isn't an effect dependency, and `restored` blocks a repeat when `working` toggles later.       |
| Other actions running                         | Focus waits, then lands once the trigger is enabled again.                                                                     |
| Save fails                                    | The editor and draft stay, because `close` is never reached.                                                                   |
| Remove fails                                  | No focus move.                                                                                                                 |
| Trigger missing                               | Not reachable: a provider's Remove button only exists while its trigger does, and `close` clears `editing` in the same update. |

- **Test coverage:** `settings-evidence.test.ts:219-225` asserts the draft, focus right after Remove, and the later Cancel focus, which closes my old minor 1.
- **Small remaining risk:** the GPTZero fields stay editable while the remove is in flight. Clicking into one during that local DELETE and reload would pull focus to Sapling's trigger, though the draft is safe. Removing the guard makes this possible, but the window is short and I wouldn't change it.

## Change 2: saved announcement (`saved-stamps.ts:70-72`) – correct, with one leftover

A later successful save now announces `Saved` and no longer fires the failure toast, which closes my old minor 2. The new test covers that path, and the existing failure tests still hold.

**New minor issue: `Saved` can stay in the screen-reader status.**

- **Cause:** after failure A then success B, `saved-stamps.ts:78` skips the clear because `failures` isn't empty, so `Saved` stays in the hidden status output after the stamp disappears.
- **Impact:** someone browsing with a screen reader could find a stale `Saved`. A later identical announcement may not be read again, though I haven't tested that. Nobody sighted sees it, and it needs a storage failure followed by a success, so it doesn't block shipping.
- **Why the rationale no longer holds:** the failure tracking doesn't protect the warning in production. `useSavedStamps.ts:15-16` blanks the status on failure and shows the warning as a toast, which `announce('')` never touches. The tracking only protects the warning in the unit test's fake `announce`, which keeps it in the status element.
- **Optional fix:** remove `failures`, clear on `!timers.size`, and change the "survives other timers" test to check that a failure leaves no stamp. A failure already blanks the status, and the toast is unaffected.

**Also accepted:** A's toast can stay up for its 10 seconds while B shows its stamp. It isn't repeated and it was true when shown, so this is fine.

## Images

I checked all five `final-*` images and found no host paths, emails or other personal details. General, Privacy, search and the phone rule error all look good. Only these five and `claude-v2.md` to `claude-v6.md` are currently untracked under `docs/reviews/settings/`, and the `.gitignore` rule covers any future `v*-*.png` captures. The archive cleanup condition is met.

## Before shipping

- **Required:** the Evidence 3 rerun passes.
- **Optional follow-ups:**
  - Remove the failure tracking as above.
  - Add a confirmation before moving the service.

## Limitations

These aren't defects:

- No real installer run or service move has been tested, and I only source-checked the Windows stop path.
- There's been no human screen-reader pass; announcements were only checked through DOM and live-region text.
- The live runs used your installed Codex and Claude runtimes, not every adapter.
- From V6, the Copyleaks email-first focus is checked from source only, and draft retention after a failed save has no test. I confirmed that retention from source here.
- The phone key form and stopped-service warning haven't been shown in a capture I reviewed.

I didn't repeat the broad audit, so this score builds on V6 and rises slightly for two closed minors, minus the new cosmetic one.
