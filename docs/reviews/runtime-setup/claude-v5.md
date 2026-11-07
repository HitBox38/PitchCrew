# Claude Opus 5.5 runtime setup review 5

Read-only independent review, 2026-11-07. This final review recommends shipping with a score above 9. Verification and remaining limits are recorded in the [review record](../runtime-setup-review.md).

## Review V5 (read-only): runtime setup, current worktree

**Score: 9.1/10. I recommend shipping it. Nothing must be fixed first.**

I checked each claimed fix in the source, then looked at 7 of the final screenshots: installation failed, Claude expired, models unreadable, models conflict, the phone dark custom editor, phone dark sign-in, and the v5 agent screenshot. I made no edits, ran no tests or servers, and started no subagents.

### V4 polish, checked against the source

| V4 item                                                        | Status                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recovery message pointed to Settings while already in Settings | **Fixed.** The dialog writes its own message and no longer shows the server's text (`RuntimeModelsFeedback.tsx`): "Recover them to restore custom definitions…" plus "Saved agent and conversation selections are kept." Agent settings still show the Settings > Runtimes pointer, which is right there (v5 screenshot).                                                                                                          |
| Failed install: message after the buttons, buttons stacked     | **Fixed.** The failure message and installer output now come before **Retry installation** (primary), with **Recheck** beside it (`RuntimeInstallation.tsx`, `v2-installation-failed.png`). Expired sign-in shows the message, then Retry sign-in and Recheck on one row; the phone sign-in buttons are also inline.                                                                                                               |
| Phone custom editor fields didn't line up                      | **Fixed.** The two fields stack into one column on phones and touch screens (`runtime-setup.css:120`). The phone screenshot shows clean alignment.                                                                                                                                                                                                                                                                                 |
| Window focus could start a CLI model-list process              | **Fixed.** The preferences GET (`runtime-model-preferences.ts`) now only reads the last known catalog from `service.runtimes` plus custom definitions, and never calls `runtimeModels`. `useRuntimeModels` makes one discovery request when it opens, then loads with GET; focus and visibility changes only use GET. The regression test at `runtime-models.test.ts:496` covers this, including after the 5-minute cache expires. |
| Model step count                                               | **Fixed.** `RuntimeModelsPanel` reports catalog changes back through a callback, and `sections.ts` counts models without the `custom` flag, which matches how `preferredRuntimeModels` tags custom entries. The 3→4 assertion is at line 538.                                                                                                                                                                                      |
| Lost custom selector, before choosing another model            | **Confirmed visible.** The v5 screenshot shows `fixture-lost-custom` in the Model field with an accurate warning. The reasoning field is below the crop, so I didn't see "unsupported" myself; the test covers it.                                                                                                                                                                                                                 |
| V3 handling of an unreadable preferences file                  | **Still holds.** The typed read error stays separate from native discovery. Saving rejects with a stale revision, controls are disabled, there is one Recover button, and the conflict draft is kept (`desktop-models-conflict-draft.png`).                                                                                                                                                                                        |

### Must-fix

None.

### Polish (low, none blocks shipping)

1. **Focus can swap a native catalog for the built-in list.** Focus reads now take their catalog from `service.runtimes`. `detect()` (`crew/models.ts:6`) refills that with `suggestedModels` once the 5-minute model cache expires. It runs on Recheck installations, runtime recommendations and lifecycle checks.
   - **Effect:** an agent model picker or Models step that stays open past expiry and then gets a recheck will replace its native list with the built-in suggestions on the next focus. The step label changes from "N native" to "Built-in list".
   - **Bounds:** this is cosmetic and temporary, saved selections are kept, and it starts no process.
   - **Possible fix:** on focus, take preferences only and keep the current catalog unless the GET returns a runtime catalog. Alternatively, have `detect()` keep the last runtime catalog after expiry.
2. **Stacking also applies on touch desktops.** The `(pointer: coarse)` rule stacks the editor fields on touch-screen laptops too. That's harmless, and probably intended.
3. **Fixture text.** The fixture strings ("Fictional installation is unavailable") remain, so real detail strings are still unverified.

### Limits

- **Not done:**
  - real OAuth, managed install, inference or account changes
  - screen reader or physical device testing
- **Not viewed:**
  - the remaining screenshots (configured, recovered, custom-editor parts, waiting and verifying)
  - the 44px touch-target measurements
- **Taken from your report, not rerun:** the test results and the final build after the catalog callback.
- **Out of scope:** the T3 comparison of remote, multi-instance and ACP registry setups.

**Shipping confidence: high.** Every V4 item is fixed in the source, not just in the screenshots. The one new issue is a minor display inconsistency introduced by the GET change, which fixed the CLI-launch concern.
