# Independent UX review (Grok) — 2026-11-08

Reviewer: Grok, read-only, no product edits, no commits, no other final review read.
Checkout: `t3/ux-journey-review` at `65f6bf85`, dirty working tree. App: `http://127.0.0.1:4418/` with scratch data `C:\Users\spide\.pitchcrew-ux-audit-20261108`. Own preview tab only. No AI runs, no approve / export / record, no profile or settings edits, no employer pages.

Score: **7.5 / 10**. This does not meet a 9. The desktop handoff is now coherent. Two consistency defects are still visible, and recording a submission is still one click.

## Findings

### 1. Decisions still calls the current stage “You approve” after the files are exported

Severity: should fix before a 9. Not a dead end. The headline on the same screen is right.

Visually verified at 1280×720 on Decisions for UX Recheck Studio (fictional), opened with Continue application (navigation only). Screenshot `docs/reviews/ux-final-grok-2026-11-08/08-decisions-handoff-1280x720.png`.

The sheet title is “Apply to UX Recheck Studio (fictional), then record it”, the chip is “Ready for you to submit”, and the body says files are saved and nothing has been sent. The rail “UX Recheck Studio (fictional) so far” paints the current ochre bead as **You approve**, with Applied still empty.

The job sheet for the same job, in the same session, paints that bead as **Ready to apply** (`06-job-footer-current-1280x720.png`). Board status text is “Ready to apply”.

Source: `jobTimeline` always uses the static track label.

```21:29:packages/ui/src/Decisions/helpers.ts
  return trackSteps.map((step, index) => {
    const entered = changes?.find((change) => change.state && step.states.includes(change.state));
    const bead = beads[index] ?? 'todo';
    return {
      id: step.id,
      label:
        step.id === 'drafting' && bead === 'done' && drafts > 1
          ? `Drafted, ${drafts} drafts`
          : step.label,
```

`trackSteps` still names that step “You approve” (`packages/ui/src/ClayInterface/helpers.ts` line 15). `stepLabel` already renames the current bead to “Ready to apply” when the packet stage is `apply` (`helpers.ts` lines 36–52). The job sheet uses `stepLabel`. The Decisions rail does not.

Repro: Board → Continue application on the exported UX Recheck card, or open the job and use the footer Continue application. Do not click I’ve submitted. Look at the right-hand track.

### 2. On a narrow board the Needs you card hides “Nothing has been sent” and the file list

Severity: should fix before a 9 for a phone-width board. The next screen still says nothing was sent.

Visually verified at 390×844. Screenshot `02-board-phone-390x844.png`. The Needs you card shows the title “Apply to UX Recheck Studio (fictional), then record it”, the role, fit 60, and Continue application. It does not show the source line, the sentence “Files saved on this computer. Nothing has been sent…”, the pdf chips, or the reviewer lines. Those nodes stay in the DOM with `display: none`.

At 1280×720 the board container is wide enough and the same card shows the safety sentence, both files, and both reviewer lines (`01-board-1280x720.png`).

Source: `@container board (width < 70.25rem)` hides `.clay-deck-source`, `.clay-deck-evidence`, `.clay-deck-detail`, `.clay-deck-then`, and `.clay-deck-next` (`packages/ui/src/styles/clay-interface.css` lines 728–762). The new safety copy lives in the hidden detail.

Phone Applied column was also opened read-only (`03-applied-phone-390x844.png`): Live UX Studio shows Screening, fit 92; Example Studio shows Interviewing, fit 60.

### 3. “I’ve submitted” and “Record manual submission” commit Applied with no extra confirm

Severity: residual footgun. Labels are explicit, so this is not a mislabeled control. It is still the easiest way to mark a job applied before the employer form is used.

Visually verified, not clicked:

- Decisions sticky bar, primary button **I’ve submitted**, hint “Record the submission only after you have applied.” (`08-decisions-handoff-1280x720.png`). Also present: Open application page (not opened), Let an agent prepare (not clicked).
- Job sheet footer, outline **Record manual submission** beside a filled **Continue application** (`06-job-footer-current-1280x720.png`).

Source:

- `packages/ui/src/components/InboxView/components/PacketDecisionActions.tsx` lines 47–60: I’ve submitted POSTs `/approvals/${id}/complete` with `{ state: 'submitted' }`.
- `packages/ui/src/components/CardDetails/next-action.ts` lines 207–230: Continue application is the primary (`openInbox`). Record manual submission is an alternate and POSTs `/cards/${id}/move` with `{ state: 'submitted' }`. Test expects that split (`next-action.test.ts` lines 178–181).

### 4. Polish: Demo copy says “Profile line(s)”

Visually verified on the desktop Needs you card and under Decisions → Worth knowing. Source: `packages/adapters/src/demo/index.ts` line 14. Awkward plural, not a flow break.

### 5. Polish: Application → Export does not point at Decisions

Visually verified (`07-application-export-section.png`). Expanded Export says only “The current packet was exported. Record submission only after you have applied.” There is no Open in Decisions control in that section (`ApplicationSectionContent.tsx` lines 54–65). The sheet footer on the same view does offer Continue application, so the user is not stuck. The section sentence and the footer hint disagree about the next move.

## What the current tree got right (visually)

Desktop board at 1280×720 (`01`, `06`): Needs you title “Apply to UX Recheck Studio (fictional), then record it”; “Nothing has been sent”; resume.pdf and cover_letter.pdf; Continue application. In progress chip “Ready to apply”. Applied: Screening (fit 92) and Interviewing (fit 60). Shortlisted empty hint is present. Lead location ellipsizes on the narrow column; the full string is the element title.

Job sheet, Job tab, after the working tree’s footer update (`06`): stage “Ready to apply”; line “Waiting on you: Apply to UX Recheck Studio (fictional), then record it”; hint “Files saved on this computer. Nothing has been sent. Apply from Decisions, then record your submission only after you have applied.” Primary Continue application, secondary Record manual submission. Application sections: Brief confirmed, Documents draft available, Reviews reviewed, Export exported.

Lead sheet, Anthropic, Product Engineer, Computer Use, fit 60 (`04`): current bead Lead, next line “you decide whether to shortlist”, primary Shortlist, hint that confirmation happens before drafting. Not shortlisted.

Decisions handoff (`08`): folder path shown as text with Copy folder path (not copied). Reviewer summary, “2 of 2 documents readable”, “0 document errors”, gaps about the uninspected form. “Then” says the user chose to apply themselves and nothing is sent until they record it.

## Working tree moved during this review

The first paint of the UX Recheck job sheet (`05-job-footer-before-reload.png`) showed a single filled footer button, **Record manual submission**, and the hint “Record this only after you have applied.” A read of `next-action.ts` at that moment had `case 'apply'` returning only that action.

A later read of the same file, and a reload of the Job tab (`06`), show Continue application as the primary and Record as an alternate. The score above is for that later tree, which is what is on disk now. `05` is kept so the transition is visible. It is not the current defect.

## Visually verified vs inferred

Verified in this preview tab:

- Board at 1280×720 and 390×844, including the Applied column on the phone.
- Anthropic lead sheet footer (Shortlist). Closed without shortlisting.
- UX Recheck job sheet, Job tab and Application → Export. No export request, no reevaluate, no record.
- Decisions handoff for approval `cb180fd8-484a-4902-b820-829e5935c110`. No I’ve submitted, no Open application page, no agent prepare.

Inferred from source, not opened in the app:

- Activity history classification (`CardDetails/history.ts`).
- Readable vs Source packet viewer (`PacketDocumentView.tsx`). File cards are listed on Decisions; none was opened.
- Export format/layout footer sharing (`useExportChoices`) on a not-yet-exported packet.
- Brief confirmation checkbox row and form-currency nag (`needsBrief` ignores `formIsCurrent`).
- Writer failure diagnostics disclosure. Not re-run. Claude Code terminal `is_error` handling was not changed; not treated as a new defect.
- Onboarding, Add job draft, chat header at 520px, live hiring panel, physical phone keyboard.
- 1440×900 CSS layout was measured earlier this session; those PNGs were narrower than the CSS viewport, so they are not used as proof. 1280×720 PNGs matched the accessibility tree.

Environment limits: an earlier open of a job sheet in this same tab failed while Vite was rebuilding `@base-ui/react/tabs` (504, then the module loaded). This continuation’s job sheet and Decisions page loaded. The parent full suite was not polled. Lint and typecheck results cited in the brief were not re-run here.

## Score

**7.5 / 10.** Desktop next actions now agree: board, job footer, and Decisions headline all say continue / apply, then record, and they say nothing has been sent. Lead shortlist vs confirm-later is right. Stage names on the board and job sheet match the exported state.

It is not a 9. The screen Continue application opens still marks the current step You approve (`Decisions/helpers.ts`). A phone-width board drops the safety sentence that the desktop card depends on. Recording Applied is one click from the Decisions primary button. Opus owns the formal 9 gate. These three should be resolved before that gate is treated as met.

Screenshots: `docs/reviews/ux-final-grok-2026-11-08/`.
