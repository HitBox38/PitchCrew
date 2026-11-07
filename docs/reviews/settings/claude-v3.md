# Settings v3 design review: 8.2/10, not yet above 9

**v3 is a real improvement on v2's 7.6, but one visible defect blocks a score above 9.** Clearing an editable field prints "null" in the interface and then shows a raw schema error. The evidence meant to show that error state doesn't show it.

## Rubric

| Area                                    | Score | Notes                                                                                     |
| --------------------------------------- | ----: | ----------------------------------------------------------------------------------------- |
| Information architecture and navigation |   9.0 | The rail, groups, phone picker and one-section-per-page structure are clear.              |
| Visual system and materials             |   8.5 | Headers now share one structure, but tray and divider rules still vary.                   |
| Hierarchy and action weight             |   8.5 | One glaze action per surface mostly holds, and Set up correctly outweighs Update.         |
| Copy and truthfulness                   |   7.5 | Scope is much better and the unavailable states are honest. Jargon and repetition remain. |
| Status and failure states               |   8.0 | Runtime failures are much stronger, but the section summary undercounts them.             |
| Form validation                         |   6.0 | This is the blocker area: "null" and the raw schema error.                                |
| Phone                                   |   8.5 | Readable with no overflow, and the rule picker works. A few rough spots remain.           |
| Dark mode                               |   8.5 | Coherent, though empty status beads almost disappear.                                     |
| Evidence quality                        |   7.5 | Much broader, but one claim is wrong and several states are missing.                      |

## Blockers

1. **"null" appears when Maximum words is cleared.**
   - `v3-fixture-phone-rule-error` shows "Cover letter — at most null words" in the picker and "Checks: At most null words."
   - `RuleLimitFields.tsx` writes `max: null`, and `PacketRules/helpers.ts:20` and `:44` print it with `String(rule.max)`.
   - The same code drives the desktop rule list. It affects bullet limits too, because line 22 and line 45 use the same pattern.

2. **The settled error message is raw schema text.**
   - `issueText` prefixes the path and passes the message through. I ran the real `validatePacketRules` with an empty maximum, which returned `Invalid input: expected number, received null`.
   - That renders as `max: Invalid input: expected number, received null`.
   - The message also appears at the bottom of the form, not on the field, and the input has no `aria-invalid` or `aria-describedby`.

3. **The rule-error fixture doesn't show a validation error.**
   - All three images show only "Checking…" in the footer, with no error text.
   - `settings-evidence.test.ts:177-180` captures as soon as Save is disabled, and Save is also disabled while checking.
   - `settings-workflows.test.ts:71-77` makes the same disabled-only assertion, so no test I found covers the error message.
   - I traced the settled message from code and did not see it rendered.

## Defects that should still be fixed

These are smaller, but together they keep the score under 9.

4. **"Rule type" reads as a property of the selected rule.** It actually configures the next new rule (`RuleFormList.tsx`, `new-rule-kind`), and it keeps showing "Word limit" whichever rule is selected. On phones it sits between "Rule to edit" and the form, which makes this worse. Label it "New rule type" or move it into an Add rule menu.

5. **The runtime summary undercounts attention.** `v3-fixture-runtime-attention` has three flagged rows, including a failed update and an incompatible version, but the summary says only "1 update available." (`RuntimeSettings.tsx`). The "Incompatible version" row also has only a quiet Details control, with no reason or next step visible.

6. **The attention accent breaks at the tray corner.** The square 3px bar sits outside the tray's rounded corner, leaving a sliver of paper between them (`settings.css:1042`; I confirmed this on an enlarged crop).

7. **Version strings are still inconsistent.** Hermes is fixed, but the same list shows:
   - `2.1.318 (Claude Code)`
   - `codex-cli 0.167.0`
   - `opencode v2.2.5`
   - `grok 1.0.77 (50ca579fa996) [stable]`
   - `omp/18.11.1`

   The name is repeated and the row looks like raw CLI output.

8. **The Background service "another folder" state is hard to read.**
   - It stacks five separate statements under "Installed for another folder" and "Running". It isn't clear which thing is running.
   - "Task Scheduler has the task." comes straight from `background/windows.ts:122`, and "daemon" is jargon.
   - It should give one plain sentence, then the action, with diagnostics under the disclosure.

9. **Timestamps are still inconsistent across Settings.**
   - Runtimes shows "7 Nov 2026, 04:45", while Updates shows "07/11/2026, 04:00:00." (`UpdateSettings.tsx:64`).
   - `JobSourcesSettings/helpers.ts:113` also uses the unformatted version.
   - The runtime formatter itself is defined three times.

10. **Privacy copy has gaps.**
    - Replay is disabled without saying why (`ReplaySettings.tsx`), though Diagnostics says "Requires usage analytics."
    - "Optional. Your sharing preference for this device." tells the user nothing.
    - The configured callout repeats the page subtitle.

11. **Layout rules still vary.**
    - **Switches:** they sit in trays on General, Updates and Privacy, but not on Writing, Accounts External agents or Runtimes daily checks.
    - **Dividers:** they are inset on General and Privacy, full-width on Writing, Accounts and Runtimes, and absent in Updates to review.
    - **Scope:** the Writing guide has no chip while its sibling section does, and the Runtimes setting writes "This workspace." inline. Consider showing chips only on pages that mix scopes.

12. **Smaller copy and phone issues.**
    - Updates says checks are off twice in a row ("Automatic checks are inactive…", then "Update checks are disabled…").
    - Accounts says "No agents" and then "No agents have access yet."
    - Connected services explains Disconnect when nothing is connected.
    - "connected-service capabilities" is jargon.
    - "Request contract taken from GPTZero client libraries" is a developer note in user-facing copy.
    - "titles with Frontend" is an unlabelled fragment.
    - On phones, Check actions are orphaned on their own rows, ghost buttons like "Details" look indented against the text, and two hairlines sit close together under the picker.
    - "See its output" is unconditional in `update.ts:63`, but the output disclosure only renders when output exists (`RuntimeOperation.tsx:46`), and the fixture shows none.

## What holds up

- **Headers:** the v2 legacy-header problem is gone in every panel I viewed.
- **Unavailable states:** these are honest. The app update switch explains the saved preference, and Privacy keeps opt-outs editable with availability stated first.
- **Hermes:** the path leak is gone, and it shows `0.22.2`.
- **Runtime failures:** the error box, manual command and Retry update are clear. Unknown sign-in is suitably quiet.
- **Phone picker:** `settings-evidence.test.ts:170-175` asserts focus and scroll position when a rule is selected.
- **Rule forms:** long select labels fit.
- **Empty states:** these are short and useful, for example Job sources.

## Optional additions, not defects

- A "needs attention" filter on Runtimes.
- Filter or sort for rules, or an add-rule menu beyond the labelling fix in item 4.
- A sticky rule list on desktop.
- Last-scan results inline on job sources.

## Evidence still missing

- **Rule validation:** the settled error state.
- **Privacy:** consent turned on.
- **Accounts:** at least one agent with access, Choose agents expanded, Google connected, and External agents enabled with its configuration.
- **Local data:** service installed for this workspace, and not installed.
- **Writing:** a populated preference, the guide proposal, the key dialog and a saved detector key.
- **Job sources and packet rules:** the source editor, and Advanced JSON plus the pattern and canonical-line rule types.
- **Search:** results and the highlighted destination.
- **Other layouts:** phone runtime failure, populated phone Accounts and Job sources, and tablet width.

## Limits of this review

- I opened 40 of the 43 v3 images. I did not open `v3-phone-dark-rules-part2`, `v3-phone-dark-rules-part3` or `v3-phone-dark-updates-part2`.
- I didn't launch the app, test keyboard or screen-reader behaviour, or re-run your test suites. I'm relying on your report that the 22 browser scenarios, 174 adapter fixtures, typecheck and lint pass.
- I reviewed interaction only from screenshots and code. I checked one validator result directly.
- I edited no project files and changed no user state. My only writes were a validator script and an image crop in the scratchpad.
- `git status --short` went from 69 to 70 entries during the review. Nothing I ran targeted the repo and nothing in the untracked list looks like mine, but I can't say what caused the change. Check this if the source was meant to stay frozen.

## Path to above 9

Fix items 1–5 and re-capture the rule error after "Checking…" clears, asserting the error text. Then apply one rule for trays, dividers and scope chips, and rewrite the Background service state. Those changes should credibly reach 9 or higher, but that needs a fresh review of new captures, including the missing states above.
