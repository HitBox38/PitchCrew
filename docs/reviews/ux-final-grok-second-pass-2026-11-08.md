# Independent UX review, second pass (Grok) — 2026-11-08

Reviewer: Grok, read-only, no product edits, no commits, no subagents. Own preview tab only, `http://127.0.0.1:4418/` (not `localhost`). Scratch data left as found. No AI runs, no approve, export, record, submit, shortlist, confirm, or settings writes. No employer page, auth, upload, or CAPTCHA.

Checkout: shared worktree `C:\Users\spide\.t3\worktrees\PitchCrew\t3-d77f866c`. Source was frozen for `bun run check` (session 40283). This pass did not run tests, builds, or the suite, and did not restart the daemon.

Score: **8.0 / 10**. Verdict: **FAIL** against a 9 with no material unresolved flow issue.

The first-pass dead ends that this pass could recheck are fixed: opened routes render, the current ready-to-apply stage says Ready to apply, the job primary is Continue application, and the phone Needs you card keeps “Files saved. Nothing has been sent.” The score stays under 9 because the phone Decisions action row clips that handoff’s primary, and the Jobs sidebar still does not show a readable stage.

## Rubric

Judgment, not an average that hides the weak row. Phone handoff and cross-surface scan are weighted because this pass was asked to prioritize them.

| Area               | Score | This pass                                                                                                                                                                             |
| ------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Opened routes      | 9     | Board, job sheet, Application documents, Decisions, chat, History, Add job, and Settings General all rendered. No raw fatal page. The recovery card was not re-driven.                |
| Desktop handoff    | 9     | Board, job sheet, Decisions, and chat agree on Ready to apply for UX Recheck. Continue application is the job glaze. The Decisions rail’s current bead is Ready to apply.             |
| Phone handoff      | 6     | The safety line is visible at 390. The job sheet footer fits. The Decisions action row shrinks “I’ve submitted” to a 44px fragment and pushes More off screen.                        |
| Cross-surface scan | 7     | Column cards, sheets, History, and chat use the current stage. The sidebar status ellipsizes to a letter or two. A completed approve bead on a Screening job still reads You approve. |
| Keyboard           | 8     | Tab shows a 2px primary ring. Escape closes Add job and the job sheet and returns focus to the opener. Escape does not close the chat packet split.                                   |
| Copy and targets   | 8     | Default surfaces keep one glaze. Job header icon buttons are 26px on desktop. Demo copy still says “Profile line(s)”.                                                                 |

## First-pass blockers, rechecked

1. **Lazy-route fatal page.** Not reproduced. Vite stayed connected. Board, Decisions (`/inbox?decision=cb180fd8-484a-4902-b820-829e5935c110`), History (`/inbox?view=history`), chat `/chat/54903055-e1d3-4694-8cc8-e5237a9501ae`, Add job, and Settings General loaded. The Load Recovery card and the explicit reload choice are parent evidence only (`native-load-recovery.jpg`, `native-reload-choice.jpg`). This pass did not stop the daemon.

2. **Duplicate Request export approval.** On the already-exported UX Recheck packet, Application → Export says the packet was exported and does not render a second primary. The unexported form was not recreated, because that needs a status change. Parent `native-single-export-action.jpg` covers the unexported case. Not re-failed here.

3. **Decisions rail “You approve” on a ready-to-apply packet.** Fixed on the current bead. At 390 the rail reads Lead, Shortlisted, Drafting, Review, **Ready to apply, current**, Applied empty. Screen reader on the job sheet: “Stage 5 of 6: Ready to apply”. Same wording on the board card, the job sheet, and chat.

4. **Record manual submission as the job primary.** Fixed. On the job sheet the glaze is Continue application. Record manual submission is an outline, at 1440 and at 390. Not clicked.

5. **Phone hides “Nothing has been sent.”** Fixed. At measured `innerWidth` 390 the Needs you card shows “Files saved. Nothing has been sent.” The longer `.clay-deck-detail` is `display: none`; `.clay-deck-handoff` is `display: block` (`clay-interface.css` 732–785, copy in `DeckCard.tsx`). The same compact line shows at 1280×720 while the sidebar is open, because the board container is under 70.25rem. No document horizontal overflow (`scrollWidth` equals `innerWidth` at 1440, 1280, and 390).

6. **“I’ve submitted” confirmation.** No modal recommended. See the reassessment below. The phone defect is the clipped control, not a missing confirm.

## Findings

### 1. At 390px the Decisions action row clips the primary

Severity: fix before a 9. The body copy is intact, so this is not a dead end. It is a material phone handoff defect on the surface this re-review was asked to prioritize.

Live, measured `innerWidth` 390, `innerHeight` 844, opened with Continue application (navigation only). Screenshot `C:\Users\spide\.pitchcrew-ux-audit-20261108\scratch\screenshots\390-decisions-footer-clipped.png`.

The sheet title, “Ready for you to submit”, the folder path, and “Nothing has been sent.” are readable. The sticky row is not:

| Control                | Box               | Label width                                                                                     |
| ---------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| I’ve submitted (glaze) | 26,732, **44×44** | `scrollWidth` 65, `white-space: nowrap`, overflow visible. The visible fragment reads “submit”. |
| Open application page  | 78,732, 188×44    | Full label.                                                                                     |
| Let an agent prepare   | 274,732, 154×44   | Clipped to “Let an agent pr”. Extends to x=428.                                                 |
| More packet actions    | 436,732, 46×44    | Off screen.                                                                                     |

`footer.decide-footer` is 366px wide with `overflow-x: auto` and `scrollWidth` 470. `scrollLeft` was 0. A thin scrollbar sits under the hint “Record the submission only after you have applied.” Document `scrollWidth` stayed 390, so the page itself does not scroll sideways. The row does.

At the same 390 width the **job sheet** footer is fine: Record manual submission 192×44 and Continue application 156×44, both labels whole, hint visible (`390-job-handoff.png`). At 1280×720 the Decisions row also fits: I’ve submitted 116×38, Open application page 188×38, Let an agent prepare 154×38, More 83×38, footer `scrollWidth` 968.

Source of the squeeze, `@container decide (width < 640px)` in `packages/ui/src/styles/decisions.css` 947–957: `.decide-actions` is `flex-wrap: nowrap`, and `.decide-actions > button:first-child` is `flex: 1 1 auto`. The glaze is the first button, so it shrinks to the 44px minimum while Open application page and Let an agent prepare stay `flex: 0 0 auto`.

Proposed fix, for the parent, not applied: under that container, stack the actions full width, or give the glaze `flex: 0 0 auto` and `min-width: max-content`. Keep one glaze. Keep More on screen. Do not add a confirm modal to paper over the clip.

### 2. Sidebar status text is not readable

Severity: fix before a 9 for a sighted scan of Jobs. The accessible name is the full stage, and the board column still shows it, so the handoff is not blocked.

Live at 1280×720 and at 1440×900 with the sidebar expanded. Screenshots `1280-board-compact-nothing-sent.png`, `1440-board-sidebar.png`, and `1280-screening-track.png` (sheet open).

Computed widths of `.clay-job-status` at 1280, sidebar about 275px:

| Accessible name | Visible width           | What a sighted scan shows |
| --------------- | ----------------------- | ------------------------- |
| Ready to apply  | 12px (`scrollWidth` 89) | “R.”                      |
| Screening       | 38px (`scrollWidth` 58) | “Scr…”                    |
| Interviewing    | 30px (`scrollWidth` 73) | “Int…”                    |

With the job sheet open the Ready to apply box collapsed to **2px**. Tooltip and the button name stay “UX Recheck Studio (fictional) Ready to apply”.

`.clay-job-company` is `flex: none` and `.clay-job-status` is `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap` (`clay-interface.css` 147–157). The company takes the row. The conversation toggle adds padding, which makes the status the piece that disappears.

Proposed fix: let the company shrink (`min-width: 0`) and give the status a min-width that fits “Interviewing”, or put the stage on its own line. The ochre asks color is already correct and should stay.

### 3. A completed approve bead reverts to “You approve”

Severity: consistency polish. The **current** stage is right, which is what the first pass failed.

Live on Live UX Studio (fictional), fit 92, opened from the sidebar and closed with Escape. `1280-screening-track.png`. Screen reader: “Stage 6 of 6: Screening”. Track labels: Lead, Shortlisted, Drafting, Review, **You approve** (done), **Screening** (current, neutral ring). Footer hint: “Prepare for screening, then record how it went.” Glaze: Update outcome. Not clicked. History lists the same job as “Job stage: Screening” and Example Studio as Interviewing (`1280-decisions-history.png`).

`stepLabel` returns the static track label whenever the step is not the current index (`helpers.ts` 48–53). `trackSteps` still names that step “You approve” (line 15). The rename to Ready to apply applies only while that bead is current. After the job is applied, the completed handoff step shows the old words again.

Proposed fix: once a packet stage exists, keep that stage’s short name on the approve bead after the job moves on, so a Screening track reads Ready to apply as done and Screening as current.

### 4. Smaller leftovers

These do not carry the fail on their own.

- **Conditional second glaze.** On UX Recheck → Activity, expanding “Already applied outside Pitchcrew?” shows Register external submission as a glazed primary while Continue application stays glazed in the footer. The disclosure was opened and not submitted. Collapsed, the sheet has one glaze. Proposed fix: keep Register as an outline.
- **Demo copy “Profile line(s)”.** Seen on the wide Needs you card this pass. Awkward plural. Source remains the demo adapter. Not a flow break.
- **Desktop job-header icons are 26×26.** Edit job and Close dialog measured 26×26 at 1280 on the Live UX sheet. The desktop target is 32px. At 390 those header controls are 44×44, and the phone board controls that were measured are at least 44px.
- **Chat packet split ignores Escape.** On the UX Recheck chat, Escape left Packet pressed. Clicking Packet closed it. The readable resume was visible while it was open. Composer stayed usable with the sidebar and packet both open.
- **Export section wording.** The exported section says to record only after applying and does not name Decisions. The sheet footer does: “Apply from Decisions, then record your submission…” Not a stuck state.

## “I’ve submitted” — no extra confirm

Reassessed on the live Decisions sheet. The control was not clicked.

The label is “I’ve submitted”. The body tells the reader to open the files, apply on the form, then choose I’ve submitted, and says nothing has been sent. The footer hint says to record only after applying. This is local tracking. `packages/board/src/board/manual-status.ts` is the user-only path the parent cited for preserving a consumed export. Parent native screenshots show a Board move from Screening to Awaiting approval and back, without a reexport. This pass did not repeat that move.

A confirmation modal would add a step to a reversible local action the user asked to keep simple. The phone bug above makes the label harder to read. Fix the row. Do not add a modal to raise the score.

## What held up

Measured viewports, via `window.innerWidth` / `innerHeight` after resize. The resize tool’s reported viewport lagged (it once returned 1280×800 while CSS was already 1280×720, and 1280×800 while CSS was 390×844). The evaluate numbers are the ones used below.

- **1440×900.** Board Needs you: “Apply to UX Recheck Studio (fictional), then record it”, files saved, nothing sent, Continue application. In progress “Ready to apply”, ochre bead, “Stage 5 of 6”. Applied: Live UX Screening fit 92, Example Studio Interviewing fit 60. Anthropic lead fit 60. Add job opened and Escape closed it. Companies afterward were still UX Recheck, Live UX, Example Studio, and 1 lead. `1440-board-sidebar.png`, `1440-job-footer.png`, `1440-decisions-handoff.png`, `1440-chat-ready.png`, `1440-add-job.png`.
- **1280×720.** Compact safety line on the Needs you card. History loads two past approvals with Screening and Interviewing. Settings → General loads Match system, chat width, sounds, and Show introduction. Nothing in Settings was changed. `1280-board-compact-nothing-sent.png`, `1280-decisions-history.png`, `1280-settings-general.png`.
- **390×844.** Needs you keeps the safety line and a 150×44 Continue application. Stage picker switches to In progress and shows Ready to apply with the bead track. Job sheet stage labels are whole, including Ready to apply, and the footer pair fits. `390-board-nothing-sent.png`, `390-in-progress-ready-to-apply.png`, `390-job-handoff.png`.
- **Lead sheet, Anthropic.** Stage 1 of 6 Lead. Future step 5 still says You approve, which is the static future label, not the current stage. Shortlist is the glaze. Confirm brief stayed disabled. Review or edit brief opened. The uninspected-form checkbox was left unchecked. Cancel editing closed the editor. Not confirmed, not shortlisted.
- **Application documents.** Readable resume for Alex Rivers, then Source showing the markdown heading. Not a PDF binary preview.
- **Chat.** “Stage 5 of 6: Ready to apply” and “Waiting on you”. Composer present. No message sent. Browser pane left at “Not open”.
- **Keyboard.** Tab inside the phone job sheet moved to Open job posting (`a`, 44×44, outline `rgb(58, 84, 130) solid 2px`, offset 2px) and stayed in the dialog. Escape closed it and restored focus to “UX Recheck Studio (fictional) · Senior Frontend Engineer · Fit 60”. Tab from Settings focused Board with the same 2px ring (offset −2px). Enter was not used.

Queue stayed 0/5. Notifications stayed 9 unread. No new job appeared.

Console, not treated as a failed page: one React `use()` warning at 20:17:32 during the brief editor, after which the UI kept rendering; a Base UI uncontrolled Collapsible warning when History opened; repeating `GET /api/snapshot?view=workspace` 304 paired with `net::ERR_ABORTED`. The board and Decisions views still updated.

## Untested

- Load Recovery, Keep this window, and any daemon restart. Parent screenshots only.
- An unexported packet’s export form, and whether a second Request export approval can reappear. Parent screenshot only.
- In-app PDF or DOCX preview from the Decisions file rows. Names and sizes were visible. Files were not opened.
- Decisions History item detail, Packets and Browser filters, and search.
- Example Studio job sheet. History shows Interviewing. The sheet was not opened.
- Live UX chat `5322fbd7-79d9-4f31-8bd1-91be4dc2c85f` and Anthropic chat `ff32e089-161a-4c08-9fe4-b3f200647742`, beyond the sidebar links.
- Chat Browser panel beyond “Not open”. No browser agent.
- Crew, Profile, Updates, Privacy, Local data, Accounts, and the workspace introduction. Show introduction was not clicked.
- Add job validation. The empty form was not submitted. Fetch from link stayed disabled.
- A full tab roster, Shift+Tab, and shortcuts other than the visible Ctrl+1 / Ctrl+3 / Ctrl+4 labels.
- Reversing a recorded submission from the Board menu. Parent evidence only. Not repeated.
- Employer forms, sign-in, file upload, and CAPTCHA. None were opened. No claim about them.
- `bun run check` session 40283. Not polled.

## Fixes proposed back to the parent

Not applied in this pass.

1. Stop the Decisions glaze from shrinking below its label under `@container decide (width < 640px)`. Stack the row or use `min-width: max-content` on the primary. Keep More on screen.
2. Make the sidebar stage readable. The company should not be `flex: none` while the status is the only flexible ellipsis.
3. Keep the packet-stage name on a completed approve bead so Screening does not show a done step called You approve.
4. Leave “I’ve submitted” without a new confirm. The label, the body order, and the hint are enough on desktop, where the button is 116px and fully labeled.
5. When the Activity disclosure is open, draw Register external submission as an outline.
6. Pluralize “Profile line(s)” in the demo copy, and bring the desktop job-header icon buttons up to 32px.
