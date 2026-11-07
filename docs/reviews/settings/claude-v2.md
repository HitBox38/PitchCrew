**Review finished; nothing was edited or run, and the score stays below your target of 9.**

## Score: 7.6/10

General is close to target at about 8.8. Most of the gap is in Updates, Privacy and the runtime edge states, and those issues are concentrated enough to fix in one more iteration.

| Rubric area                   | Score | Main reason                                                                                         |
| ----------------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| Hierarchy and typography      | 7.0   | Heading sizes are inverted on Updates and flat on Privacy                                           |
| Consistency across sections   | 6.5   | Three sections bypass `SettingsSection`, and rows are treated differently                           |
| Clay and app rule conformance | 8.0   | Materials are good, but several row lists sit outside trays and multiple glaze buttons are possible |
| Copy and scope wording        | 7.5   | "Device" still contradicts "machine" on Accounts                                                    |
| Runtime edge states           | 7.0   | Attention is weakly signalled, and the wrong action gets the emphasis                               |
| Phone                         | 7.8   | Solid targets and no sideways scroll, but the section name appears twice and Rules is awkward       |
| Accessibility and interaction | 8.0   | Region roles and slash search look right in source, but heading levels are wrong                    |

| Section                         | Score |     | Section      | Score |
| ------------------------------- | ----- | --- | ------------ | ----- |
| General                         | 8.8   |     | Packet rules | 7.3   |
| Job sources (empty state only)  | 8.3   |     | Updates      | 6.5   |
| Local data (loading state only) | 7.8   |     | Privacy      | 7.0   |
| Accounts                        | 7.2   |     | Runtimes     | 7.3   |
| Writing                         | 7.5   |     |              |       |

## Blockers, most important first

1. **Updates and Privacy use hand-built section headers.**
   - **Heading size:** `.settings-content h3` makes their headings 14px (`settings.css:258`). "Updates to review" is 16px, so it outranks its parent "Agent and skill updates". "Usage analytics" matches its own row titles.
   - **Floating scope label:** `justify-between` with three children leaves "This device" and "This workspace" mid-row at about x=816 and x=845, while General has it beside the title (`UpdateSettings.tsx:20-30`, `SkillUpdateSettings.tsx:11-15`).
   - **Button size:** the legacy `.button` class makes "Check for updates" 38px, against about 30px for "Check now".
   - **Fix:** move `UpdateSettings`, `SkillUpdateSettings` and `AnalyticsSettings` to `SettingsSection`, which fixes all three. Then remove the dead rule at `settings.css:270-275`.

2. **The scope wording fix is incomplete.**
   - **Accounts:** the subtitle says "saved on the machine running Pitchcrew", and the next paragraph says "saved on this device" (`constants.ts:41`, `ConnectorSettings/index.tsx:18`).
   - **Other places:** the same wording is in the detector toast (`useDetectorSettings.ts:16`) and Google setup (`GoogleConnectionSetup.tsx:49`). AGENTS requires this distinction.
   - **Rail and synonyms:** General holds device preferences but sits under a rail group called "Workspace". "Machine" and "computer" are also both used for the same thing.

3. **The runtime rows don't direct attention to the blocker.**
   - **No row accent:** `data-attention` is set (`RuntimeRow.tsx:41`) but no settings CSS uses it, so an attention row differs only by its chip.
   - **Wrong emphasis:** optional "Update" gets the glaze button while blocking "Set up" stays outline. Several updates would also break the one-glaze-per-surface rule (`RuntimeUpdateAction.tsx:20`).
   - **Set up order:** it opens on Installation, with sign-in below it (`RuntimeDetails.tsx:25-41`).

4. **The runtime failure state is rough** (`v2-fixture-runtime-error.png`).
   - **Spacing:** "Career Coach" nearly touches the rose panel, because the row's `gap: 8px` applies to a single child, `Collapsible`.
   - **Alignment:** "The installer failed…" is indented, but "Run this command…" is not.
   - **Dates:** "7 Nov 2026, 04:34" sits alongside "07/11/2026, 04:34:52".
   - **Terms:** "Sign-in needed" sits alongside "Authentication needed".
   - **Toast:** a green "Runtime update started" covers a failed row. The mocked instant failure may exaggerate this, but `RuntimeUpdateAction.tsx:24` has no handling for it.

5. **Real runtime data leaks into the row.** Hermes shows `…Install directory: %USERPROFILE%\Ap`, cut off mid-path with no ellipsis, because `health.ts:31` takes the first 100 characters of raw output. Parse a clean version in the adapter layer, which also respects invariant 2. The problem predates this work, but it is the most visibly broken line on the page.

6. **Unavailable settings look available.**
   - **Updates:** the switch stays on while the page says update checks are disabled.
   - **Privacy:** all three switches remain live, with "Analytics is unavailable" only at the bottom (`AnalyticsSettings.tsx:25-39`).
   - **Runtimes:** "Update checks disabled" is the most prominent item above the list, and expanding it reveals only a disabled switch. A plain note would do, as long as search can still reach the setting.

7. **Row treatment varies by section.** `settings.css:1-2` says lists sit in recessed trays. General and Accounts follow that, but Privacy, Updates and the four detector rows don't. General's divider is also inset while the Accounts divider runs full width.

8. **Accounts shows redundant content when nothing is connected.** "Effective agent access" repeats "Connect GitHub" and "Connect Google", which pushes External agents below the fold (`EffectiveAccess.tsx:15-37`). Use one quiet line until something is connected.

9. **Packet rules has fit and naming problems.**
   - **Truncation:** the select reads "All words, including headi" at 1280px, so the two-pane layout is too tight there.
   - **Naming:** "Packet rules", "Saved checks" and "2 saved rules" use different nouns for the same thing.
   - **Phone:** the editor sits below the list and under the pinned footer. I found no `scrollIntoView` in `PacketRules`. The only focus calls are at `useRuleForm.ts:50,67`, which I didn't trace, so test whether picking a rule visibly changes anything.

10. **Smaller polish**
    - **Phone naming:** "General" appears in the picker and again in the heading directly below it, so drop or shrink one.
    - **Heading levels:** runtime and access rows use `h3` inside an `h3` section, and should be `h4` (`RuntimeRow.tsx:47`, `EffectiveAccess.tsx:21`).
    - **Ghost buttons:** their padding breaks edge alignment, such as "Details" on phone and "Show introduction" on desktop.
    - **Sign-in chips:** six identical "Sign-in not checked" chips are noise if production shows the same, so make that state quiet metadata.
    - **Cleanup:** remove the dead branch in `SettingsHeading.tsx:8-12` and the dead `.settings-scope` rule at `settings.css:174`.

## Confirmed fixed from v1

- **General:** it is compact with a clean tray, and the inaccurate preview is gone.
- **Headers:** page subtitles are now one line or two, with no duplicate Packet rules title.
- **Runtimes:** attention sorting and release-aware button labels work.
- **Phone semantics:** the picker and labelled regions replace the bad tab semantics.
- **Slash search and targets:** the slash search guards look right in source, as does the 44px target CSS.

## Limits of this review

- **Viewport-only captures:** the screenshots miss External agents, the fourth detector, the end of the Rules form and `RuntimeUpdatesLink`.
- **Non-normal states:**
  - Local data was captured while "Checking the background service…" was showing, because the test doesn't wait for it.
  - Updates, Privacy and Runtimes show disabled or unchecked branches rather than a normal production state.
- **States never captured:**
  - Populated accounts, sources and writing preferences
  - Rules validation errors and the "Saved" stamp
  - The search dialog and focus outline
  - Several runtimes needing attention at once, or one that isn't installed
  - Desktop dark mode and the width where compact layout starts
- **Test gap:** the touch check measures height only, and `.settings-content button` sets only `min-height`, so the copy icon's width is unverified. The inline "API documentation" links aren't covered either.
- **T3 comparison:** I only listed the T3 settings folder and did not compare designs, so nothing here relies on it.
- **Unrelated to this work:** I didn't score the app sidebar or app bar. Content is cut off about 15px above the window bottom on Writing and Rules, which may come from the shared layout, but I didn't confirm that.

## Path past 9

Blockers 1–3 and 5–8 should bring this to about 8.8–9.0, with blockers 4, 9 and 10 providing the margin. A score above 9 also needs a recapture that includes:

- Full-page screenshots
- A resolved Local data state
- A production-like Updates and Privacy state
- A fixture with several runtimes needing attention
- At least one populated Accounts or Job sources state
