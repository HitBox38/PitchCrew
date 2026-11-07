## Pitchcrew settings v4 review: 8.9/10

This doesn't clear 9 yet, but it's close. Both v3 blockers are fixed and I found no ship-blocking defect. What's left is one unstated consequence, one wrong label, one overstated test claim and some small polish.

I reviewed the v4 captures (29 of 54 viewed directly) and the relevant source, and made no edits. I didn't re-run any tests.

### Rubric

| Area                                  | Score | Basis                                                                                                 |
| ------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| Structure and navigation              | 9.3   | Rail, phone picker and URL sections are clear, and the search target lands with a visible focus ring. |
| Visual hierarchy and clay consistency | 9.0   | Trays, dividers and checkbox groups now match. Small misses are listed below.                         |
| Copy clarity                          | 8.8   | Much cleaner, but it still has mixed terms and a wrong "needs a value" label.                         |
| State and error handling              | 9.0   | The v3 blocker is fixed: inline message, `aria-invalid`, settled footer, no `null`.                   |
| Trust and consequences                | 8.5   | Privacy and external-agent copy is strong; the service switch is the exception.                       |
| Phone and tablet                      | 8.8   | No overflow, but sticky chrome is heavy and the on-screen keyboard wasn't tested.                     |
| Accessibility                         | 8.5   | Semantics are automated only. No screen-reader pass is claimed, which limits this score.              |
| Evidence quality                      | 8.7   | Coverage is broad, with the gaps listed below.                                                        |

### V3 blockers: both fixed

- **Numeric validation:** bounds in `numeric.ts` match the core schema exactly (word limit 1–100,000, bullets and matches 0–1,000). The server's message for that field is suppressed in favour of the local one, so nothing raw shows.
- **Settled evidence:** `v4-fixture-phone-rule-error-part2` shows the field ring, the inline message and "1 problem to fix before saving".

### Correction to the brief

The tests don't assert the exact footer text. `settings-evidence.test.ts:228` and `settings-workflows.test.ts:76` only check that the footer contains `'problem'`. That still proves it settled, because "Checking…" doesn't match, and the image shows the right words. It is weaker than described, though.

### Remaining defects, in priority order

1. **Service switch doesn't state its consequence (medium).**
   - "Use for this workspace" (`ServiceState.tsx:46`) runs immediately, with no confirmation or warning.
   - There is only one per-user service, so this takes it away from the other workspace, whose routines stop running at login.
   - The note only describes the current state. One sentence or a confirmation would fix it.
2. **"Needs a value" is wrong for out-of-range values (low to medium).**
   - `helpers.ts:21,55` uses `numericProblem`, which also fails on 0, 12.5 or 200,000.
   - The picker then says "word limit needs a value" and Checks says "Set a word limit" while the field holds a number. The inline message is correct, so only these two labels contradict it.
3. **One setting has four names (low).** `source.enabled` appears as "Watch" (the switch's accessible name), "Include in scans", "1 of 1 watched" and "Paused". The row switch also has no visible label.
4. **Noisy search results (low).** Searching "sounds" ranks the right result first, then lists Background service, Connected accounts, Automatic runtime update checks and others. This looks like `cmdk`'s fuzzy matching, though I didn't confirm that in the code.
5. **Small visual polish (low):**
   - "Configure" uses the external-link arrow for an in-app route (`AccountAgentAccess.tsx:34`), while Updates uses `→`.
   - The "Runtime updates" row sits outside any tray, so its arrow is 16px out of line with the rows above.
   - "Check for updates" and "Check now" name similar actions differently.
   - The tablet and phone section description sits between two dividers.
   - Tablet search is icon-only despite having room for a label at 1000px.
   - Native number spinners show on touch.
   - The Match system thumbnail has a pale sliver on its right edge in dark mode.

The phone chrome is also heavy: about 108px on top plus a 115px two-row Save footer, roughly 26% of an 844px screen. That is acceptable as captured, but it hasn't been checked with the keyboard open.

### Not defects

- Missing new capabilities, such as a jump-to-problem link from the footer, are optional and didn't affect the score.
- "Sign-in not checked" is honest, because evidence runs leave authentication unknown.
- The toasts in the fixture shots are capture artefacts, although they partly cover the Writing footnote and a sign-in command.

### Evidence gaps

- **States with no capture:**
  - External agents switched on, including the copyable config block
  - Background service healthy for this workspace
  - App update available or downloading
  - Failed job source scan
  - Detector with a saved key
  - Rules with several problems at once
- **Not tested:** a manual screen reader, a real phone or on-screen keyboard, real installers, sign-ins or Google connection. The runtime error and update states are mocked.
- **Fixture limit:** the rich account fixture shows GitHub only.

### What would clear 9

Fixes 1 and 2, tightening the test to the exact footer string, and capturing the External agents on state and a healthy service should be enough. Item 3 is a one-word cleanup worth doing at the same time. None of this needs redesign.
