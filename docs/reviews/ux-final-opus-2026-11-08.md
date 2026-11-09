# Final UI/UX review (Claude Opus 5.5): regular-user journey, 8 November 2026

Independent reviewer pass on branch `t3/ux-journey-review` (uncommitted working tree). I read AGENTS.md, the journey register (`ux-journey-2026-11-08.md`, UX-01–19) and the relevant diff. I did not read the other final review. No code edits, AI runs, approvals, exports, state changes or employer pages.

## Verdict

**Score: 7.5/10 (conditional). FAIL / NO PASS VERDICT.**

Two things block a pass:

1. **I could not inspect the essential paths visually.** The scratch dev daemon on `:4418` restarted at 21:15 local. Since then its Vite dependency optimizer has been stuck: `packages/ui/node_modules/.vite/` holds only `deps_temp_e6f6948b` (React only) and no `deps/`. `@base-ui/react` tabs, combobox and checkbox return `504 Outdated Optimize Dep`. That was still the case at 19:22:56Z after several reloads. As a result, every lazily loaded surface fails with the root "Something went wrong! Failed to fetch dynamically imported module" page: job details (`CardDetails/index.tsx`), Decisions (`InboxPage.tsx`) and Chat (`ChatPage.tsx`). Only Board renders. The daemon log `dev-final.log` shows the same errors at 21:20:53, a time when I was not clicking, so the native app may be hitting them too. This is a dev-server cache problem, not a product regression in the diff. Still, under the brief I cannot claim a pass for the job sheet, brief, export, Decisions handoff or chat paths without seeing them myself.
2. **The user-visible failure mode has no recovery path.** When a lazy route chunk fails, the user gets the TanStack default text "Something went wrong!" with a raw module URL and no reload action (`Warning: The following error wasn't caught by any route … set an 'errorComponent' in your RootRoute`). The diff did not introduce this. But it is the screen a regular user lands on after an update, cache eviction or daemon restart, and I reproduced it three times on the three most important routes. I count it as a material recovery defect. Fix it before awarding ≥9; acceptance criteria are below.

The score is not raised for the threshold. If the daemon is restarted, the lazy paths render as the parent's native screenshots show, and F1 below is fixed, I would expect roughly 8.5. F2 and F3 hold it below 9.

## Findings (most important first)

### Blockers

**B1 — Lazy route load failure is unrecoverable for users (material, pre-existing, reproduced).**
Repro: with a stale or missing Vite dep cache (or, in production, a deleted or renamed chunk after an update), click any Board job card, go to `/inbox` or open `/chat/<id>`. The whole app is replaced by "Something went wrong! / Hide Error / Failed to fetch dynamically imported module: …". There is no app shell, no reload control and no plain explanation. Hide Error leaves a blank page. Evidence: `C:\Users\spide\.pitchcrew-ux-audit-20261108\screenshots\opus-final-jobsheet-vite-504.png`; the parent also captured `module-load-fatal.jpg`.
Acceptance: a root/route `errorComponent` (or `defaultErrorComponent` on the router) that keeps the workspace shell where possible, says in one product sentence that part of the app failed to load, offers **Reload** (and, for chunk-load errors, reloads automatically once), and keeps the copyable technical detail behind Details. A unit/browser test should simulate a rejected lazy import.

**B2 — Coverage gap (environmental, not a product defect).** I could not visually check the job sheet (brief extraction-first screen, confirmation footer, checkbox row, readable document view, Packet match hiding, export footer), the Decisions saved-files handoff and History, or the job chat (header at the 520px browser split, phone header, failure diagnostics). The parent should restart the scratch daemon (or clear `packages/ui/node_modules/.vite`) and request a re-review of those paths. I did not restart it, as instructed.

### Material UX (should fix before a 9)

**F1 — Two identical primary "Request export approval" buttons on one surface.** Once the Export section is open, `ExportRequest.tsx:44-51` renders an inline primary button, and the sticky footer (`next-action.ts:186-198`) shows a second primary with the same label. Both are visible together in the parent's native `word-export-footer.jpg`, about 170px apart. This breaks AGENTS' "one glaze action per surface" and makes users wonder whether the two do different things. UX-16 fixed the footer by duplicating rather than consolidating.
Acceptance: one primary action while the section is open. Either the footer is primary and the inline control becomes secondary or is removed (the format/layout selects stay inline), or the reverse. Both routes keep the same guarded `request` and disabled state.

**F2 — Stage track says "You approve" after the user has approved and exported.** For UX Recheck Studio, Board shows the status **Ready to apply** and the Needs-you card **Apply … then record it**. The card's stage track still puts the ochre "current" bead on _You approve_, and its accessible text reads "Stage 5 of 6: You approve" (visible in the desktop snapshot). `StageTrack.tsx` `stepLabel` now remaps only the Applied step (UX-12). The approve step keeps its label and the ochre "waiting" tone, `currentTone … step?.id === 'approve' ? 'ochre'`, even when the approval is consumed. This contradicts the guidance UX-17 fixed elsewhere and the bead law (ochre = waiting on the user's decision).
Acceptance: when the current packet is exported (the `packetExported` facts already exist in `lib/job-step.ts`), the stage-5 label and screen-reader text read "Ready to apply" or "Apply". Ochre is acceptable because the move is the user's, but the label must not ask for an approval already given.

**F3 — Job details' primary for an exported job jumps straight to "Record manual submission".** `next-action.ts` `case 'apply'` makes **Record manual submission** the sheet's primary footer action. The stage line says "you apply, then record your submission", but the sheet offers no apply/open-files affordance next to it. Open application page and the files live in Decisions. A user who opens job details from Board sees a one-click primary that records a submission they may not have made. The hint ("Record this only after you have applied") helps but sits in small text. This is pre-existing logic, now surfaced as the main path by the new step model.
Acceptance: make the primary **Continue application** (opens the same Decisions handoff that the Board card uses). Alternatively, show it as primary with Record manual submission as a secondary action. No gate changes.

### Optional polish

- **P1 — Phone Board repeats the stage name.** At 390px a "Leads · 1" stage selector sits directly above a "Leads 1" column heading (`opus-final-board-phone-390.png`). Hiding the column heading when the selector is shown would save a row.
- **P2 — The phone Needs-you card drops the "Nothing has been sent" line.** On desktop the line is prominent. On phone the compact card shows only title + Continue application. That is truthful but less reassuring. Consider a one-line "Files saved · nothing sent" meta row.
- **P3 — Reviewer highlight copy "4 source-backed Profile line(s)"** uses "(s)" pluralisation in a prominent card. Pluralise properly.
- **P4 — `postSubmissionStates` includes `withdrawn`/`rejected`/`ghosted`, so `jobStep` returns `outcome` for them (`lib/job-step.ts:39-47, 136`).** A pre-submission withdrawn job therefore offers outcome-style guidance. `trackIndex` likely returns null for closed jobs, so `nextUp` avoids it. Worth a test for the job-details footer in that case.
- **P5 — Native `word-export-footer.jpg` shows faded select options ("PDF (suggested)", "PDF and Word", "Markdown only") overlapping the helper paragraph and footer.** This is most likely the select's closing fade caught mid-transition. I could not reproduce it because the sheet would not load, so it is not a confirmed defect.

## What I verified visually (my own preview tab, screenshots viewed)

| Viewport             | Surface                    | Result                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1440×900             | Board                      | Clear hierarchy. Needs-you deck leads with **Apply to UX Recheck Studio (fictional), then record it**, "You exported the files · 54m ago", a recessed "Files saved on this computer. Nothing has been sent. Apply on the posting, then record it." note, file tiles with page counts and **Continue application**. Cards show Ready to apply / Screening / Interviewing with fit numbers. UX-17 and UX-12 look right on Board. |
| 1280×720 (short)     | Board                      | Same content fits without clipping. Lead title wraps to two lines, location truncates with an ellipsis (full text in `title`). Deck ends at ~y550, so nothing is hidden.                                                                                                                                                                                                                                                       |
| 390×844 (phone, CSS) | Board                      | Phone title bar, glaze Add job, compact Needs-you card with Continue application, stage selector, readable cards, no horizontal overflow seen. See P1/P2.                                                                                                                                                                                                                                                                      |
| 1440×900             | Job sheet, Decisions, Chat | **Failed to render** (B1/B2). Snapshot accessibility trees at phone size were stale (desktop boxes), so phone claims rely on the image only.                                                                                                                                                                                                                                                                                   |

Screenshots saved: `C:\Users\spide\.pitchcrew-ux-audit-20261108\screenshots\opus-final-board-desktop-1440.png`, `opus-final-board-short-1280x720.png`, `opus-final-board-phone-390.png`, `opus-final-jobsheet-vite-504.png`.

## Evidence from the parent's native screenshots (viewed, not re-performed)

- `word-export-footer.jpg`: the export footer requests the visible choices with a truthful format hint and "Nothing is sent". The stage line "Next: you prepare the export for approval" matches the footer. Duplicate primary button (F1).
- `live-screening-outcome.jpg`: stage label **Screening**, "Next: you prepare for screening and record the result", Update job status buttons with "Status updates do not contact the employer", History leading with "Moved to Screening" / "User recorded a manual submission". Decisions behind it shows "Files saved on this computer … Nothing has been sent", the full folder path, the Reviewer's assessment with gaps, and a separate **I've submitted**. The truthful approval → local export → manual-submission handoff looks good.
- `live-word-resume.jpg`: readable DOCX preview, layout-approximation note, Preview/Source toggle, and download gated with an explanation.
- `writer-failed-diagnostics.jpg`: _pre-fix_ state (old generic "Check its model/sign-in" text, a "Changes requested" chip with no packet). I have no screenshot of the post-fix failure copy, so UX-18's new diagnostics are **inferred from source only** (`packages/adapters/src/process/results.ts` categories plus the parent's note).

## Source review (inferred, not visual)

- `lib/job-step.ts` gives one ordered gate model shared by the footer and `nextUp`. The lead branch correctly avoids holding scored leads on brief confirmation; confirmation and form checks return after shortlisting. A failed first draft (`changes_requested` with no packet) maps to `draft`. No daemon gates changed. `formIsCurrent` mirrors the core helper without importing zod; that is a duplication risk worth a sync test, which exists via `next-up.test.ts`.
- `FormPreparation.tsx`: the checkbox and its wrapping label share one `<label>` hit target with coarse-pointer min height, not preselected. Good.
- `ConfirmBrief.tsx`: the disabled reason is linked by `aria-describedby`, and the footer uses the same `confirm`. Good.
- `DeckActions.tsx`: `nativeButton={false}` on the Link-rendered buttons (UX-19). The label comes from `packetAction(stage)`. Good.
- Approval, export and submission gates: I found no client-side bypass. Footer actions call the same routes. `packetNeedsAction` still drives attention.

## Rubric (0–10 each, weighted equally)

| Criterion                                  | Score | Justification                                                                                                                            |
| ------------------------------------------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| First-use discoverability                  | 8     | Board deck and "Next:" lines lead well. Extraction-first brief seen only in parent evidence.                                             |
| Clear next step                            | 7.5   | Consistent shared model, but F2 (approve label after approval) and F3 (Record submission as primary) contradict it at the handoff stage. |
| Reading / visual hierarchy                 | 8.5   | Calm clay hierarchy on Board. Duplicate glaze on export (F1).                                                                            |
| Disabled / busy explanations               | 8     | Source shows linked hints. Not visually verified this pass.                                                                              |
| Recovery                                   | 5.5   | B1 dead end reproduced on three core routes. UX-18 post-fix copy not seen.                                                               |
| Readability                                | 8.5   | Readable documents (parent evidence), good type scale.                                                                                   |
| Responsiveness                             | 7.5   | Board fine at all three sizes. Chat/job sheet at phone and short sizes unverified by me.                                                 |
| Keyboard / accessibility                   | 7.5   | Labels and `aria-describedby` correct. Stale "You approve" screen-reader text (F2). Not keyboard-walked this pass.                       |
| Truthful approval / local export / handoff | 8.5   | "Nothing has been sent" is consistent across Board and Decisions, and recording is separate. F3 weakens it in job details.               |

Mean ≈ 7.7, rounded down to **7.5** for the unverified essential paths.

## Highest-impact fixes to reach ≥9

1. B1 route error component with Reload (and one automatic reload for chunk-load errors), with a test.
2. F1 single primary export action.
3. F2 stage-5 label/screen-reader text reflects an approved/exported packet.
4. F3 job-details primary for exported jobs is Continue application; recording becomes secondary.
5. Restart the scratch daemon and re-run visual review of the job sheet, Decisions handoff and chat at 1440×900, 390×844 and 1280×720 before any pass.

## Limits

No AI runs, approvals, exports, status changes or employer pages. Preview at phone size is a CSS viewport, not a device or touch keyboard. The full repository check was not polled or run. The parent owns `final-check.log`.
