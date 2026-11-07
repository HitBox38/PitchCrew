**V6 score: 9.2/10. Ship once the final 31-browser run passes and the machine-path captures are out of the repo.** All four V5 defects and the latest remove-key fix hold up. I found no blocking product defect, and the three items left are minor. This covers only those fixes, plus General at rest in the captures, not a repeat of the broad audit. I ran no tests, so the score rests on source and captures.

## V5 fixes

| Item                                                   | Result             | Evidence                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service move warning                                   | Fixed and accurate | `ServiceState.tsx:44-50` has separate running and stopped wording. On Windows, `windows.ts:125-128` stops the running daemon as soon as the definition changes, and `index.ts:100-101` removes the old task file, which supports "stops now" and "no longer starts at login". It's readable on desktop and phone (`v6-desktop-data`, `v6-phone-dark-data`). |
| Detector focus on open                                 | Fixed              | The first required field gets focus, including Copyleaks' email field (`DetectorKeyForm.tsx:23-25, 36, 49`).                                                                                                                                                                                                                                                |
| Detector focus on cancel, save and remove              | Fixed              | The effect waits for the editor to close and work to finish, then focuses the trigger once (`useDetectorSettings.ts:17-23`). The browser test asserts all three.                                                                                                                                                                                            |
| Storage error                                          | Fixed              | The notice is now a toast with a 10-second timeout, and the status output is screen-reader only (`useSavedStamps.ts`, `SettingsPage/index.tsx:79`). The test asserts the switch doesn't move.                                                                                                                                                               |
| Workspace wording                                      | Fixed              | Consistent in the service and detector copy and in the captures I viewed.                                                                                                                                                                                                                                                                                   |
| Removing another provider's key (latest Codex finding) | Fixed              | `remove` no longer clears `editing`, so the open form and its draft survive. A stale return target can't take focus later, because closing the editor replaces it.                                                                                                                                                                                          |

## Remaining product defects (all minor, none block shipping)

1. **Focus is lost in one remove case:** removing Sapling's key while GPTZero's editor is open unmounts the focused Remove button, and the effect exits early because `editing` is set (`useDetectorSettings.ts:18`). Focus should fall to the document body, though Chromium's Tab starting point probably limits the harm. The new test checks the draft and the later Cancel focus, but not focus right after Remove.
2. **The error notice repeats after a later successful save:** once one control fails to persist, a later control that does save gets the row's Saved stamp and the "may not survive a restart" error toast (`saved-stamps.ts:70-72`). The earlier failure is real, but the toast reads as if this change failed too.
3. **One click can interrupt another workspace's work:** "Use for this workspace" has only the inline warning, with no confirmation step. That meets the V5 request, but a confirmation is a sensible follow-up because interrupted work can't be recovered.

## Evidence gaps (not product defects)

- **Final run:** I haven't seen the 31-browser result. The captures I checked (05:25:21 and 05:25:34) are newer than the last hook and test edits (05:24:56 and 05:25:07), but they may come from that unfinished run.
- **Move behaviour:** no real service move was performed, by design. I read only the Windows driver's stop path, so the macOS and Linux claim isn't source-checked here.
- **Warning copy:** no test asserts either warning string, and the stopped-service variant isn't in the captures I viewed.
- **Detector flows with no test:**
  - Copyleaks' email-first focus is verified from source only.
  - I found no test for draft retention after a failed save.
  - I found no phone capture of the open key form.
- **Dim toast in `v6-fixture-storage-unavailable`:** the rose text peaks at `#8f5f68`, against a dark-theme token of `#e6939f`. This is probably a capture mid-fade, since the token itself has about 6:1 contrast, so I'm not counting it as a defect. Recapture it after the fade if this image is kept, though it isn't on the planned keep list.

## Before merge

`docs/reviews/settings/` is still untracked, and at least the Local data captures show `%USERPROFILE%\...`. Keep only the vetted General, rules, search and privacy images, as planned, and check those for paths too. The second and third items are fine as follow-ups, and the first is a one-line fix plus an assertion if you want one more pass.
