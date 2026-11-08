# Brief and Add job fixes (UX-02 to UX-05), 2026-11-08

Implementation note for UX-02, UX-03, UX-04 and UX-05 in [ux-journey-2026-11-08.md](ux-journey-2026-11-08.md). Pending parent verification in the app. The footer wiring is described below and is not done yet.

## UX-02: Brief preparation hides the automatic path

- `ApplicationBriefReview/index.tsx`: when a brief has loaded, has no context and is not being edited, `BriefActions` renders above form inspection. Manual preparation stays below it.
- `components/BriefActions.tsx`:
  - With no brief, an open section ("Extract the brief from the posting") explains the isolated run and says that extraction neither confirms the brief nor starts drafting. It ends with "Or prepare it yourself below."
  - Once a brief exists, re-extraction is a collapsed `AccordionSection` named "Extract again from source".
  - With no capable agent, the text explains why automatic extraction is unavailable and says manual preparation still works.
- `components/ExtractionControls.tsx` (new): the agent select and extract button, moved out of `BriefActions` unchanged apart from a label prop.
- While someone edits a brief that has no saved context, extraction is hidden (it was already disabled during editing). Nothing is prefilled.

## UX-03: One confirmation action with a visible reason

- `helpers.ts`: `briefConfirmationBlocker({ loaded, draft, busy, linked })` returns the reason confirmation is unavailable, or `''`. It checks, in order: the brief is loading, the job's work is active, or a linked job has no form choice (inspection or the explicit manual check).
- `hooks/useApplicationBrief.ts` now returns `confirmationHint` and `confirmDisabled`. `confirm()` returns early when there is a blocker or `savingRef.current` is set, so the footer and the inline button cannot send twice. `sourceRevision`, `expectedRevision`, `normalizedBrief`, the refresh, dirty and saving guards, and backend validation are unchanged. Missing personal answers are not a client blocker; the daemon and the existing Ready gate still handle them.
- `components/ConfirmBrief.tsx` (new): the inline Confirm and Cancel editing buttons. The disabled reason sits directly under them and is linked with `aria-describedby`. The form choice stays explicit; nothing is chosen for the user.

### Footer integration contract (parent applies this in `CardDetails/next-action.ts`)

Replace the `brief.editing` block, which only jumped back to the section, with:

```ts
if (brief.editing)
  return {
    label: 'Confirm brief',
    hint: brief.confirmationHint || 'Confirms the complete brief and requirements shown above.',
    disabled: brief.confirmDisabled,
    perform: () => void brief.confirm(),
  };
```

`brief` is the `useApplicationBrief` return value already in `CardDetailsModel`, so no type change is needed. If the `JobActions` test or the label policy needs the long label, use `'Confirm complete brief and requirements'`. Browser tests that use `exact: true` will then find two buttons with that name, so scope them to `.detail-footer` or the brief section.

## UX-04: Manual form-check checkbox

- `components/FormPreparation.tsx`: the label uses the established `checkbox-label` class, so the `.form label` column layout no longer applies. It adds `items-start` (an unlayered utility, so it overrides the `components`-layer rule), a 32px minimum height (44px on coarse pointers) and a wrapping text `<span>`. The checkbox keeps its size (`shrink-0 mt-0.5`).
- The whole label is the click target. The box starts unchecked.

## UX-05: Unsupported posting fallback

- `link-actions.ts`:
  - New pure helper `jobLinkHint({ askScout, external, blocker })`.
  - When Scout is unavailable, the hint first says the details can still be entered below and added. The setup step follows, written as "To ask Scout later, …": it names Scout's settings in Crew and the exact capability label, or Settings > Runtimes for a missing runtime.
- `components/JobLinkField.tsx`: uses the helper. The "external" sentinel string was replaced with an `unavailable` boolean for the disabled state.
- There is no navigation shortcut. Closing the Add job dialog would discard the draft, and nothing grants capabilities automatically.

## Tests

- New `ApplicationBriefReview/__tests__/helpers.test.ts`: blocker order, the explicit form choice (never preselected), and unlinked jobs or missing personal answers left to the daemon.
- `AddOpportunity/__tests__/link-actions.test.ts`: updated blocker wording, plus a new test that manual entry stays visible beside every unavailable Scout path.
- `test/application-form.test.ts`:
  - Extraction leads before a brief exists and has no collapsed re-extraction yet.
  - The disabled reason is visible; the manual box starts unchecked, shares a row with its text and is toggled by clicking the text, after which the reason disappears.
  - After the brief exists, re-extraction is collapsed.
- Results:
  - `bun run test -- packages/ui/src/ApplicationBriefReview packages/ui/src/components/AddOpportunity`: 58 passed.
  - `bun run test -- packages/ui/test/application-form.test.ts packages/ui/test/application-brief-dirty.test.ts packages/ui/test/job-edit.test.ts`: 10 passed.
  - `bun run lint`: passed.
  - Oxfmt on the touched files: clean.
  - `bun run typecheck`: fails only in the untracked `CardDetails/export-format.ts` from another task. No errors in these files.

## Objections and notes

Parent review: wired the persistent footer to the same guarded `brief.confirm()` and blocker, and added a focused footer-action test. Native Electron at 1442×961 shows the manual checkbox beside its full label, initially unchecked; clicking the label checks it and enables both confirmation buttons. With no form choice the persistent footer explains why confirmation is disabled, even while the inline action is below the viewport. The temporary choice was cancelled. Removed “isolated run” from the extraction explanation so it describes the user-visible result. The browser integration test now scopes the repeated hint to its brief section and exercises confirmation from the persistent footer.

- When the footer and the inline button both offer Confirm, it is the same action with the same blocker, so they do not compete. The parent may still drop the inline button later.
- AGENTS.md has no sentence about the brief's extraction layout or the Add job hint, so it needs no update for these changes. Parent may add one if wanted.
