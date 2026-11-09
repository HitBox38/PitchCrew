# Final UI/UX gate, second pass (Claude Opus 5.5), 8 November 2026

This is an independent reviewer pass on branch `t3/ux-journey-review`, an uncommitted, frozen working tree. Before reviewing I read:

- AGENTS.md
- `ux-journey-2026-11-08.md`
- both first final reviews (Opus and Grok)
- `ux-parent-handoff-review`, `ux-screen-recovery` and `ux-final-handoff-iteration`

I reviewed in my own preview tab at `http://127.0.0.1:4418/`, which loaded normally. Every lazy route and panel rendered, with no 504s, so the first pass's environment blocker is gone.

I made no product edits, ran no tests or builds, polled no checks, started no AI runs and changed no saved state. I did not approve, export, record or submit anything, and visited no employer pages. Opening chats cleared their unread markers, which is unavoidable when viewing them. I toggled the device-local sidebar preference during the run and restored it to collapsed afterwards. My tab is closed.

## Verdict

**Score: 8.5/10. FAIL: the gate is not met.**

Every material finding from the first pass is fixed in the live app (table below). Desktop and short-desktop now tell one consistent, truthful story from Board through job details, Decisions and chat.

One new material defect remains on the core handoff surface at phone width (**N1**), so I cannot score a 9 or call the flow free of material issues. N1 is a small CSS fix. After N1, plus a recheck at 390px, I would expect about 9.

## Prior material findings, rechecked live

| Finding                                                    | Status    | Live evidence (mine)                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1: raw fatal page on lazy-load failure                    | Fixed     | All routes and panels loaded. I could not force a chunk failure without changing the environment, so the recovery UI is judged from the parent's native `native-load-recovery.jpg` and `native-reload-choice.jpg` (clay dialog inside the shell; "Reload Pitchcrew…" with an explicit draft-loss confirmation; Keep this window; Close; Technical details) and from source (`lib/retryable-lazy.ts`, `LoadRecovery/`). |
| F1: two primary export buttons                             | Fixed     | UX Recheck job sheet → Application. After export, the Export section has no inline button. The only primary on the sheet is the footer's **Continue application** (DOM check: one `primary` button in the dialog).                                                                                                                                                                                                     |
| F2: "You approve" after approval and export                | Fixed     | Board card, job details track and chat header all read **Ready to apply**, with an ochre current bead. Screen-reader text is "Stage 5 of 6: Ready to apply".                                                                                                                                                                                                                                                           |
| F3: Record manual submission as the sheet primary          | Fixed     | The footer leads with **Continue application**. Record manual submission is an outline alternate. The hint reads "Files saved on this computer. Nothing has been sent. Apply from Decisions, then record your submission only after you have applied."                                                                                                                                                                 |
| Grok 1: Decisions rail static "You approve"                | Fixed     | Rail: "Ready to apply, current". Then: "You chose to apply yourself…".                                                                                                                                                                                                                                                                                                                                                 |
| Grok 2 / P2: phone Needs-you hides "Nothing has been sent" | Fixed     | At a real 390×844 viewport (`innerWidth` 390, `scrollWidth` 390), the card shows "Files saved. Nothing has been sent." above Continue application (44px target).                                                                                                                                                                                                                                                       |
| Continue application opens the right packet                | Confirmed | Board deck Continue application → `/inbox?decision=cb180fd8-…`, the UX Recheck handoff.                                                                                                                                                                                                                                                                                                                                |

## Remaining findings (most important first)

### Material

**N1 — The Decisions handoff footer overflows at phone width. Its primary label is clipped and More is off-screen.**
Viewport 390×844, `/inbox?decision=cb180fd8-…` (exported, unrecorded packet). The footer row holds four actions: I've submitted, Open application page, Let an agent prepare and More. Measured in the DOM:

- **I've submitted** shrinks to its 44px minimum width (`scrollWidth` 65) and shows only "submitt".
- Let an agent prepare is cut at the right edge.
- **More packet actions** sits at x=436, completely outside the 390px viewport. Request changes, Not applying and Open job are reachable only by finding the footer's horizontal scrollbar (`.decide-footer` `scrollWidth` 470 vs `clientWidth` 366).

The page itself does not scroll sideways, so this is easy to miss in a width-only check. Screenshot: `opus2-decisions-390-footer-overflow.png`.

Cause: in `styles/decisions.css` (phone block, about line 947), `.decide-actions { flex-wrap: nowrap }`, and `.decide-actions > button:first-child { flex: 1 1 auto }` lets the primary shrink while the outline buttons do not. That rule fits two-button decisions (Approve / Request changes / More) but not the four-button post-export state.

This is the single most important phone surface for a regular user: the moment they apply and record.

Acceptance:

- At 390px every footer action is fully visible without horizontal scrolling, and the primary label is never truncated.
- Suggested approach: let `.decide-actions` wrap on phones, with the primary full-width on its own row and the secondaries on the next row. Alternatively, keep I've submitted and Open application page visible and move Let an agent prepare into More on narrow screens.
- Add a 390px browser assertion that each footer button's `scrollWidth <= clientWidth` and its right edge is `<= innerWidth`.

### Polish (not blocking; recommended)

- **P1 — Sidebar job rows clip the status to one letter.** At 1280px with the sidebar open, the rows read "UX Recheck Studio (fictional) **R.**", "Scr…" and "Int…". The status span gets about 12px. The parent's native screenshot shows the same thing. The accessible name is complete. Fix: drop the status text when there is no room, or let the company name truncate first.
- **P2 — History mixes two voices.** User status corrections read "User changed status to screening / agreed / awaiting approval": third person, lowercase internal state IDs, and "agreed" is never shown to users anywhere else. Neighbouring rows read "Moved to Screening" with "You". AGENTS says Activity rewrites stored wording into one product sentence per event. Fix: render these as "You moved it to Screening" with display labels.
- **P3 — The finished stage 5 still reads "You approve".** On submitted jobs (Live UX Studio, Screening) the completed step is labelled with an imperative. "Approved" would read better for a past step. It is not misleading, because the bead shows done.
- **P4 — The Documents status says "Draft available" after approval and export.** On the UX Recheck Application tab, the other rows say Confirmed / Reviewed / Exported. "Approved" or "Final" would match.
- **P5 — Word counts disagree.** The chat Packet panel says the resume is 54 words; the Decisions file tiles say 48 (PDF and .md). The panel probably counts the name and heading lines. Use one counting rule, or label the difference.
- **P6 — "4 source-backed Profile line(s)"** is still on the Board deck and in Decisions (carried over from the first pass's P3/Grok 4). This is demo-review text, but it is the most prominent card on Board.
- **P7 — `retryableLazy` calls `use()` conditionally.** `lib/retryable-lazy.ts` calls `use(load())` only while the component is missing, so the render after resolution skips it. React logged "This library called use() to suspend in a previous render but did not call use() when it finished" at 20:13:35Z, while I was opening a job sheet. I saw no user-visible effect. In React 19 this is a development warning, but it shows a hook-pattern smell in the new loader. Fix: keep a stable promise and call `use()` on it on every render until the component resolves, or throw the pending promise. Add a test with React's dev warnings treated as failures.
- **P8 — "I've submitted" correction (my independent read).** I agree with the parent: no confirmation modal. The action is local, reversible and clearly labelled, with "Record the submission only after you have applied" beside it. "Nothing has been sent" appears three times on the path. Undo exists, but only through the Board card menu's Move to…. Job details' Update job status offers only forward outcomes (Interviewing / Rejected / Withdrawn / No response). Undo is therefore discoverable but not obvious. Optional and in keeping with the user's preference for simplicity: show a toast after recording, "Recorded as applied · Undo", which reverts through the same user-only status path. Not required for a pass.
- **P9 — The chat header Browser button looks raised while closed.** At 1280px and 390px, Browser has a raised clay surface next to ghost Job/Packet buttons, even though `aria-expanded=false` and no browser is open. It reads as pressed or selected. AGENTS reserves the pressed look for an open browser.
- **P10 — Phone Board repeats the stage name.** A "Leads · 1" selector sits directly above a "Leads 1" heading (unchanged from the first pass's P1).
- **P11 — Add job opens with focus on Close.** Moving focus to the first field (Job post URL) would save a Tab. Escape and Cancel close correctly, and focus returns to Add job.

## What I verified myself (own tab, screenshots viewed)

Screenshots are in `C:\Users\spide\.pitchcrew-ux-audit-20261108\screenshots\opus2-*.png`.

| Viewport (actual inner size) | Surface                                                      | Result                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1440×900                     | Board                                                        | Needs-you deck: "Apply to UX Recheck Studio (fictional), then record it", "You exported the files · 1h ago", "Files saved on this computer. Nothing has been sent.", file tiles, Continue application. Cards: Ready to apply / Screening / Interviewing.                                                                                                                   |
| 1440×900                     | UX Recheck job details (Job, Application, Documents, Export) | Single primary in the footer. Readable resume view with Sources quoting profile.md. Export says "Exported" with a "Record submission only after you have applied" line. Escape closes and focus returns to the card.                                                                                                                                                       |
| 1440×900 / 1280×720          | Decisions handoff                                            | Saved-folder path with Copy, Reviewer assessment with real gaps (form not inspected, availability/compensation unconfirmed), frozen file tiles, fixed export choice, rail correct. Footer: I've submitted (primary), Open application page, Let an agent prepare, More (Request changes / Not applying / Open job). Escape closes the More menu and returns focus to More. |
| 1280×720                     | Decisions History                                            | Two past decisions with job stage, Reviewer summary, Approved chip and file count.                                                                                                                                                                                                                                                                                         |
| 1280×720                     | Live UX Studio job details                                   | Stage 6 Screening; "Next: you prepare for screening and record the result"; Activity has Update job status with "Status updates do not contact the employer". History keeps the earlier parent correction sequence (see P2).                                                                                                                                               |
| 1280×720                     | UX Recheck job chat + Packet panel                           | Stage track and "Waiting on you: Apply… then record it" match Board and job details. Job-event chips include "Approved and exported". The read-only Packet panel opens; × closes it. The next-step line truncates at the narrow split.                                                                                                                                     |
| 1280×720                     | Anthropic lead details + Review brief                        | Lead stage; "Next: you decide whether to shortlist"; primary Shortlist with Evaluate again / Review brief outlines. Review brief expands the extracted brief, requirements and uninspected-form warning in place. I did not confirm.                                                                                                                                       |
| 1280×720                     | Add job                                                      | "Nothing is saved until you add it." Company and Role title marked required. Keyboard: Enter opens, Tab reaches the URL field, Escape closes and focus returns to Add job. Nothing was added.                                                                                                                                                                              |
| 1440×900                     | Crew                                                         | Roster with runtime · model, capability lines and idle states; no overflow.                                                                                                                                                                                                                                                                                                |
| 390×844                      | Board, lead sheet, Decisions, job chat                       | Board and lead sheet good: 44px targets, reachable footer, no overflow. Chat: compact stage, view tabs, icon actions, composer reachable. **Decisions footer fails (N1).**                                                                                                                                                                                                 |

Automation note: on Board at 1280px, two of my coordinate clicks on job cards did not open the sheet. A later tap at 390px opened it first time. I attribute this to the drag sensor's handling of automated pointer events, not to a confirmed product defect.

## Rubric (0–10 each, equal weight)

| Criterion                                  | Score | Justification                                                                                                                                    |
| ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| First-use discoverability                  | 8.5   | The deck and the "Next:"/"Waiting on you" lines lead clearly. Undoing a mistaken recording is buried in Move to… (P8).                           |
| Clear next step                            | 9     | One shared stage model now agrees across Board, sheet, chat and the Decisions rail.                                                              |
| Reading / visual hierarchy                 | 9     | One glaze action per surface on desktop. Calm clay trays.                                                                                        |
| Disabled / busy explanations               | 8.5   | Hints are present and linked. Busy states were not exercised (no state changes allowed).                                                         |
| Recovery                                   | 8.5   | Strong recovery design, from parent native evidence and source. Not reproducible by me. Development `use()` warning (P7).                        |
| Readability                                | 8     | Sidebar status clipped to "R." (P1), mixed history voice and raw state IDs (P2), "(s)" (P6), word-count mismatch (P5).                           |
| Responsiveness                             | 7     | Board, sheet and chat good at 390 and 1280×720. The Decisions handoff footer is broken at 390 (N1).                                              |
| Keyboard / accessibility                   | 8.5   | Escape and focus return correct for the sheet, menu and dialog. 44px phone targets. Accessible names are complete even where visible text clips. |
| Truthful approval / local export / handoff | 9.5   | "Nothing has been sent" is consistent everywhere. Recording is clearly separate and after applying. Gates untouched.                             |

Mean ≈ 8.5. **Overall 8.5/10. FAIL** because of the unresolved material phone handoff issue (N1).

## Fixes proposed to the parent (not applied)

1. **N1 (required):** make the Decisions phone footer wrap or reflow so every action is fully visible at 390px, with the primary label never truncated. Add a 390px browser assertion.
2. P1 sidebar status truncation; P2 history wording through display labels; P6 proper plural.
3. P7: make `retryableLazy` call `use()` on every render, or throw the pending promise.
4. Optional: P8 Undo toast after I've submitted; P3/P4 past-tense labels; P5 one word-count rule; P9 Browser button resting style; P11 initial focus in Add job.

## Not tested / limits

- No live employer form, sign-in, upload, CAPTCHA or real submission. No browser-panel run, approvals or autonomous preparation.
- I did not approve, export, record, change status, confirm a brief, shortlist or add a job. Busy and failure states after those actions were not exercised.
- I did not trigger load recovery myself. That evidence is the parent's native screenshots plus source.
- No AI runs. The Writer failure diagnostics were seen only as historical Activity rows ("The runtime did not return a valid structured result…"), not as a fresh failure.
- Phone checks use a CSS viewport in Chromium, not a real device, touch keyboard or safe-area insets.
- Screen-reader output was read from DOM and accessibility-tree text, not from an actual screen reader.
- I did not poll or run the frozen full check (`session40283`).
