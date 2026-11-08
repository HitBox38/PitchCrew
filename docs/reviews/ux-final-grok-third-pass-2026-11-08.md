# Independent UX review, third pass (Grok) — 2026-11-08

Reviewer: Grok, read-only, no product edits, no commits, no subagents. Own preview tab only, `http://127.0.0.1:4418/` (not `localhost`). CSS viewport only. No physical phone, no screen reader, no employer page, auth, upload, or CAPTCHA.

Checkout: shared worktree `C:\Users\spide\.t3\worktrees\PitchCrew\t3-d77f866c`. Source stayed frozen for `bun run check` session 26469. This pass did not run tests, builds, the suite, or the log, and did not restart the daemon or clear caches. UX Recheck stayed unrecorded. “I’ve submitted”, Request changes, Not applying, Shortlist, brief confirm, Fetch, and Add job submit were not activated.

Score: **9.1 / 10**. Verdict: **PASS** against a 9 with no unresolved material flow issue.

The second pass failed on two material defects: the phone Decisions action row clipped “I’ve submitted”, and the Jobs sidebar ellipsized the stage. Both are fixed in this running app, measured in this tab. Residual copy and vocabulary items below do not block the handoff.

## Rubric

Judgment, weighted toward the phone handoff, sidebar readability, keyboard, and cross-surface stage language. The overall score is that judgment. It is not an average.

| Area                | Score | This pass                                                                                                                                                     |
| ------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phone handoff       | 9.5   | At measured 390 and 320 the four Decisions actions are whole, the glaze is full width, More stays on screen, and the hint sits under the row.                 |
| Sidebar readability | 9     | Company truncates first. Ready to apply, Screening, and Interviewing fit at 1440, at 1280, and in the 390 drawer.                                             |
| Keyboard            | 9     | Add job opens on the URL field, a typed character lands there, Escape cancels and returns focus. More opens and Escape closes it at 1440 and at 390.          |
| Cross-surface stage | 9     | UX Recheck is Ready to apply on Board, the sheet, Decisions, and chat. Live UX’s past bead is Approval. A lead’s future step still says You approve.          |
| Copy and targets    | 9     | One glaze on the handoff. Header icons are 32px on the desktop sheet and 44px at 390. Saved demo text still says “line(s)”. The generator now pluralizes.     |
| Opened routes       | 9     | Board, sheets, Application, Activity, History, Decisions, chat Packet, and Add job rendered. No fatal page. Recovery and provider failure were not re-driven. |

## How this pass measured

`preview_resize` kept reporting a stale viewport (often 1280×800) after the setting changed. Each size below is `window.innerWidth` / `innerHeight` read after a screenshot, with `devicePixelRatio` 1. Screenshot PNGs are sometimes scaled (a 1440 CSS view saved as a 1248-wide image). The accessibility boxes and `innerWidth` are the CSS pixels used here.

Own screenshots: `C:\Users\spide\.pitchcrew-ux-audit-20261108\scratch\screenshots\` with the `third-pass-` prefix. Parent native files under `C:\Users\spide\.pitchcrew-ux-audit-20261108\screenshots\` are cited only as parent evidence.

## Required fixes, rechecked live

### UX24 / N1 — phone Decisions manual handoff

Fixed. UX Recheck decision `cb180fd8-484a-4902-b820-829e5935c110`, sidebar closed at phone widths.

At `innerWidth` 390, `innerHeight` 844, document `scrollWidth` 390. The Packet decision bar is `clientWidth` 366, `scrollWidth` 366, `clientHeight` 192, `scrollHeight` 192, `overflow: auto` with no internal scroll. Screenshot `third-pass-390-decisions-footer.png`.

| Control                              | Box            | Overflow          |
| ------------------------------------ | -------------- | ----------------- |
| I’ve submitted (glaze, `default`)    | 26,638, 338×44 | `scrollWidth` 338 |
| Open application page (outline link) | 26,690, 338×44 | `scrollWidth` 338 |
| Let an agent prepare (outline)       | 26,742, 284×44 | `scrollWidth` 284 |
| More packet actions (ghost)          | 318,742, 46×44 | `scrollWidth` 46  |

The glaze and Open application page span the inner row. More is the square ellipsis, and its right edge (364) stays inside the bar (right edge 378). The hint “Record the submission only after you have applied.” is visible. “Nothing has been sent.” is in the files region.

At `innerWidth` 320, `innerHeight` 844, document `scrollWidth` 320. The bar is 296×192 with `scrollWidth` 296. I’ve submitted and Open application page are 268×44. Let an agent prepare is 214×44. More is 46×44. All four right edges end at 294, inside the bar. Screenshot `third-pass-320-decisions-footer.png`.

Keyboard at 390: focus on More, Enter opened the menu Request changes / Not applying / Open job, active item Request changes. Escape closed the menu, returned focus to More, and left the URL at `/inbox`. No item was activated. The open menu overlays the action labels (`third-pass-390-more-menu.png`). That is the menu layer. The closed row does not clip. The same More menu opened and closed with Enter and Escape at 1440 earlier in this tab.

### P1 — sidebar status

Fixed at the width that failed last pass, and in the phone drawer.

At 1280×720, Decisions open, sidebar about 275px (`third-pass-1280-decisions-sidebar.png`):

| Row                           | Company `client` / `scroll` | Status `client` / `scroll` |
| ----------------------------- | --------------------------- | -------------------------- |
| UX Recheck Studio (fictional) | 87 / 174                    | Ready to apply 89 / 89     |
| Live UX Studio (fictional)    | 118 / 148                   | Screening 58 / 58          |
| Example Studio (UX audit)     | 103 / 156                   | Interviewing 73 / 73       |

At 1440 the same three statuses also fit (89, 58, 73). At 390 the drawer repeats it: Ready to apply 89/89, Screening 58/58, Interviewing 73/73, while the longer company names ellipsize (`third-pass-390-sidebar.png`). Live UX’s company fits in that drawer (148/148).

### P2 — manual History labels

Fixed on the rows this tab opened. UX Recheck Activity history shows “Moved to Awaiting approval” with You, and “Moved to Reviewed” with Reviewer (`third-pass-1440-recheck-history.png`). Live UX history shows “Moved to Screening”, “Moved to Reviewed”, and “Moved to Awaiting approval”, actor You (`third-pass-1440-live-history.png`). Those lines do not show raw state ids or “User changed status to”. Storage was not rewritten. A “Recorded document verification findings” row still names orchestrator. That is an actor label, not a raw stage id.

### P3 — past Approval, current Ready to apply

Live UX sheet: “Stage 6 of 6: Screening”. The track includes Lead, Shortlisted, Drafting, Review, Approval, Screening. The past Approval bead is filled. Screening is the open current ring. The next line is about preparing for screening. Update outcome was not clicked.

UX Recheck is “Stage 5 of 6: Ready to apply” on the sheet, the Decisions rail (current ochre bead, Applied empty), the board card, and chat. The Decisions rail does not say You approve for that current step.

A lead still shows the future step as You approve. Anthropic’s track reads Lead (current), Shortlisted, Drafting, Review, You approve, Applied (`third-pass-1440-anthropic-lead.png`). That is the planned future step on a job that has not passed approval. It is a vocabulary difference from the past bead “Approval” and from the manual current stage “Ready to apply”. It does not mislabel the current stage. Not a material flow break.

### P4 — Exported version only for the current packet

UX Recheck Application: Documents row “Exported version”, Export row “Exported”, body copy that the current packet was exported and that submission is recorded only after applying. No “Draft available” on this packet. The readable resume is Alex Rivers, “APPLICATION FOR SENIOR FRONTEND ENGINEER”, four bullets, Sources from profile.md, without raw `#` markers (`third-pass-1440-readable-resume.png`, `third-pass-1440-application.png`).

### P5 — one word-count rule

On the Decisions files and the chat packet, resume.pdf and resume.md are 48 words, cover_letter.pdf and cover_letter.md are 58 words, form_answers.md is 9 words, note.md is 19 words. The readable packet matches the resume tile. Markdown markers are not counted as words in those tiles.

### P6 — plural in new demo reviews, old saved text kept

The Needs you card and the saved Reviewer’s notes still say “4 source-backed Profile line(s)”. That is the stored UX Recheck demo review. `packages/adapters/src/demo/index.ts` now builds `1 source-backed Profile line` or `N … lines`. This pass did not start a provider run, so the new generator was read, not executed. The saved sentence was left as stored.

### P7 — notes follow width until the user chooses

At 1440, before any toggle in this pass, Reviewer’s notes were `aria-expanded=true`. After resize to a confirmed 390, and before a click, they were `aria-expanded=false`. Opening them on the phone set the choice. They stayed open at 320, after returning to a confirmed 1440 (`third-pass-1440-notes-preserved.png`), and after returning to 390. Snapshots that reported console entries during this sequence listed none. This pass did not see a `use()` warning. The development React test remains parent and test evidence.

The explicit reload / draft-loss recovery card was not reproduced. Parent screenshots `native-load-recovery.jpg` and `native-reload-choice.jpg` cover that branch. The page did not throw.

### P9 — Browser rests ghost

On chat `54903055-e1d3-4694-8cc8-e5237a9501ae`, Job, Packet, and Browser are ghost and 32px tall at 1440. Browser was “Not open”, `aria-expanded=false`, shadow transparent. Packet opened and showed the same readable resume. Escape left the nonmodal packet open. Clicking Packet closed it. No external navigation.

### P11 — Add job focus

From the board, Add job opened with focus on the URL input (`name=url`, placeholder `https://…`, label “Job post URL optional”). A press of `x` without clicking the field set the value to `x`. Escape closed the dialog, created no job, and returned focus to the Add job button (92×32, outline `rgb(58, 84, 130) solid 2px`). The board still showed the same four jobs. Fetch was not clicked. Screenshots `third-pass-1440-add-job-focus.png` and `third-pass-1440-add-job-cancelled.png`.

### Header icons and register control

Desktop Anthropic sheet: Edit job and Close dialog are ghost 32×32. The posting control sits between them in the screenshot. At 390 the three controls measure 44×44 ghost: Edit job, Open job posting (link), Close dialog. Document `scrollWidth` stayed 390. Shortlist is the glaze (82×44); Evaluate again and Review brief are outline, 44px tall, labels whole.

“Already applied outside Pitchcrew?” on UX Recheck Activity opens inside the disclosure. Register external submission is outline. Continue application remains the only glaze in that footer. Nothing was submitted (`third-pass-1440-activity-register.png`).

## Other surfaces in this tab

Board at 1440 (`third-pass-1440-board.png`): Needs you names the apply-then-record handoff, “Files saved on this computer. Nothing has been sent.”, resume.pdf and cover_letter.pdf, Continue application. Columns: Anthropic fit 60 in Leads, Shortlisted empty, UX Recheck Ready to apply, Live UX Screening fit 92, Example Studio Interviewing fit 60. Queue 0/5.

Board at 390 (`third-pass-390-board.png`): “Files saved. Nothing has been sent.” Continue application is 150×44. Header controls are 44px (Open navigation, Add job, More ways to add, the overflow menu). The stage combobox reads “Leads · 1” and the column heading reads “Leads 1” with a 44px sort button. The heading carries the sort control, so the pair is redundant to read and still useful. Not a material defect.

Anthropic brief: Shortlist is the glaze. The hint says to confirm the brief before drafting. Review brief opens “Confirm the complete job brief before an agent drafts your application.” Documents say Not drafted. Export says Not exported. Nothing was confirmed or shortlisted (`third-pass-1440-review-brief.png`).

Decisions History at 1440 listed two past decisions, Live UX at Screening and Example Studio at Interviewing, with an Approved outcome chip. That chip is the packet decision, separate from the stage bead.

Chat packet and the job sheet agree on Ready to apply and the 48-word resume. No message was sent.

Repeated `GET /api/snapshot?view=workspace` requests returned 304 with a paired `net::ERR_ABORTED`. The UI kept rendering. This pass treats that as cancelled polling, not a broken page.

## Parent decisions, assessed here

“I’ve submitted” stays one click. The label, the hint “Record the submission only after you have applied.”, and “Nothing has been sent.” are visible at 1440, 1280, 390, and 320. This pass did not click it and did not request a modal.

The phone Board keeps the stage combobox and the column heading. The heading has the count and the sort button. Usable. Mildly redundant. Not a fail.

The chat packet stays open on Escape and closes from the Packet button. That matches the accepted nonmodal split.

No Undo toast was present, and none was required for this score.

## Untested in this pass

- Session 26469 and any earlier suite. Not polled. Not claimed green.
- Load-recovery card, explicit reload, and draft-loss warning. Parent screenshots only.
- Live provider runs, writer retry, form-inspection failure, and busy states.
- The unexported Export form. UX Recheck is already exported.
- Clicking I’ve submitted, reversing a submission, Request changes, or Not applying.
- Opening PDF or DOCX in an external viewer, download, or send. The in-app readable resume and file tiles were viewed.
- Example Studio’s job sheet. Board, sidebar, and History already say Interviewing.
- Settings writes, notifications panel, and search.
- A real screen reader, a physical phone, touch virtual-keyboard behavior, and any viewport or permission change outside this CSS preview.
- Employer auth, upload, and CAPTCHA.

## Result

No material flow issue remains in the surfaces this pass drove. The phone handoff and the sidebar stage are readable at the sizes that failed the second pass.

Review: `docs/reviews/ux-final-grok-third-pass-2026-11-08.md`

Screenshots: `C:\Users\spide\.pitchcrew-ux-audit-20261108\scratch\screenshots\third-pass-*.png`
