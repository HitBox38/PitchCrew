# Regular-user UX journey — 8 November 2026

Completed: UX-01–24 are accepted after Claude Opus 5.5 fixes and parent review iterations. Independent third-pass reviews pass at **Opus 5.5: 9.0/10** and **Grok: 9.1/10**, with no unresolved material flow issue. The final frozen repository check exits **0**, with **3394 tests passed, 8 skipped**, 54 script tests passed, lint, types and all builds passed. Earlier failed reviews, intermediate checks and pending-verification statements below are historical evidence, superseded by this summary and the final acceptance section. Remaining nonblocking polish and coverage limits are retained in the final review notes.

## Method and environment

Hands-on audit of the actual Electron app through Windows Computer Use (`@oai/sky`), using screenshots, pointer input, keyboard entry and accessibility observations. No API calls, database seeding or test harness drove the user journey. Source inspection was used afterward to distinguish product issues from automation artifacts. Branch began at `65f6bf85`, equal to `origin/dev`.

Scratch workspace: `C:\Users\spide\.pitchcrew-ux-audit-20261108`, daemon port 4418. Fictional candidate Alex Rivers and fictional jobs; no real employer submission or connected-account mutation. Development Demo exercised the actual brief, packet, rendering, approval, export and tracking services; its assessments and writing are scripted. The later real-runtime extension completed source extraction, fit, drafting, Reviewer review, Word export and synthetic outcome tracking using Claude Code and Codex, with a real drafting failure found and repaired along the way.

Skills: find-skills search (`npx skills find "ux audit"`), repository frontend-design and web-design-guidelines, Windows computer-use, and React best practices for implementation review. Existing guidelines were sufficient; no new global skill installed.

## Completed walkthrough

1. Launched from clean checkout; resolved missing dependencies and used pinned Bun 1.4.4 through `npx bun@1.4.4` (system Bun was 1.4.2).
2. Read both introduction pages and started the setup checklist.
3. Opened Add profile, replaced the starter note with four fictional evidence bullets and saved. Checklist advanced from 1/3 to 2/3.
4. Opened Add job; tested blank submission validation and an unsupported `https://example.com/ux-audit-job` URL. Entered full fictional posting manually, saved and finished setup.
5. Opened job details, prepared brief manually, entered context/responsibilities/qualifications/constraints, explicitly chose manual form checking and confirmed the brief.
6. Evaluated fit (Demo 60/100), shortlisted, drafted application and opened Resume/source claims.
7. Requested packet review, then selected Markdown + PDF + DOCX / Formatted and requested export approval.
8. Opened Decisions, read review limitations, opened the actual PDF resume and verified it rendered readably.
9. Approved exact files and chose Submit myself. The app saved the packet locally. Recorded a fictional manual submission; Decisions cleared.
10. Opened tracking, moved the audit job to Interviewing and verified the sidebar/history changed.
11. Opened job chat and Packet/Browser controls. Opened a native browser and navigated to example.com successfully. Hid the panel again.
12. Wrote a chat draft; navigated through Crew, agent settings, Skills and Routines, then returned. The draft survived. Sent it to the Demo group; all three recipients completed.
13. Inspected Settings > Runtimes: Claude Code and Codex were reported signed in, Cursor Agent incompatible, Grok Build and Hermes needed sign-in. Changed only the standalone Scout conversation runtime to Claude Code for one live check.
14. Opened the public Anthropic Greenhouse board in the native browser, selected an observed current posting URL, and used Add job > Fetch from link. Company, role, locations and complete description filled successfully before saving to the scratch board. The import completed within the first 500ms observation window; this is a single observation, not a benchmark. The optional salary field remained blank despite an explicit annual salary range in the retained description (minor import-quality observation; no text was lost).
15. Repeated the fictional pipeline after the fixes, including the extracted-but-unconfirmed lead, actual manual-form checkbox/confirmation, readable packet, saved folder handoff and separate submission tracking. Left UX Recheck Studio exported and unrecorded for independent reviewers.
16. Configured scratch agents through Crew settings for a real-provider extension: Claude Code Writer, Codex Scout and Reviewer. Created Live UX Studio from a complete fictional posting, extracted its brief, assessed fit, shortlisted and confirmed it.
17. Observed two failed real Writer attempts, inspected Diagnostics and documented the safe-recovery problem. After Claude's contract repair and a scratch daemon restart, the same Writer configuration saved a first packet on one normal Retry. The real Reviewer passed it with explicit limits.
18. Chose Word, verified that the persistent footer reflected that choice, requested export approval, inspected both actual DOCX previews, approved the exact files and exported them locally. Recorded a synthetic manual submission and Screening outcome, then verified the track, sidebar, next step and history.
19. Reproduced a lazy sheet download failure by stopping only the idle scratch daemon. Verified the clay recovery dialog over Board, the explicit unsent-edit reload warning, Keep this window and Close. Restarted the isolated-cache daemon and verified normal job/Decisions loading.
20. Verified the final handoff in Electron: Ready to apply in Board, job details and Decisions; Continue application primary, recording secondary; one primary export request action. At 390×844, the Board retains Nothing has been sent without horizontal overflow. Used the fictional Live job's status menu to verify that correcting tracking back to Awaiting approval restores its consumed manual export, then restored Screening after checking the reviewed export controls.

## Issue register

Reproduction steps describe the original walkthrough. Earlier implementation notes are retained as an audit trail; this table gives the current parent-review status. Independent final reviews pass at Opus 9.0 and Grok 9.1. Priorities reflect user impact, not security severity.

| Issues   | Current status                         | Evidence                                                                                                                                                |
| -------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UX-01    | Parent accepted after Claude iteration | Native extracted/unconfirmed leads advance through Evaluate fit and Shortlist; confirmed drafting and Reviewer review follow in order.                  |
| UX-02–05 | Parent accepted                        | Native extraction-first screen, persistent confirmation with blocking reason, explicit checkbox beside its label, and visible manual-entry fallback.    |
| UX-06–07 | Parent accepted                        | Readable document with preserved Source; new lead hides premature Packet match.                                                                         |
| UX-08–10 | Parent accepted                        | Native suggested PDF, truthful generation state, exact PDF preview/download, clear local file handoff and separate manual-submission action.            |
| UX-11    | Parent accepted with small corrections | Native meaningful history plus collapsed technical record; tests preserve unknown messages and failures.                                                |
| UX-12–13 | Parent accepted                        | Native Interviewing label and full company/title in actual browser split; phone and shorter desktop viewport checks also recorded below.                |
| UX-14–15 | Parent accepted with copy corrections  | Native introduction explicitly names AI provider context; Demo checklist clearly says scripted/no AI and wraps without clipping.                        |
| UX-16    | Parent accepted after live check       | Selecting Word updates the footer hint; its Request export approval generates DOCX plus Markdown files shown in Decisions.                              |
| UX-17    | Parent accepted                        | Native Board, sidebar and chat lead to applying with saved files; Continue application opens the truthful manual handoff.                               |
| UX-18    | Parent accepted after live retry       | Repaired Writer examples retain strict validation; native real retry saved a packet in 41 seconds and cleared the failed queue.                         |
| UX-19    | Parent accepted                        | Board actions use shared non-native Button composition, navigate correctly and no longer emit the Base UI warning in the restarted app.                 |
| UX-20    | Parent accepted after native recovery  | Isolated Vite caches; native failed sheet retains Board, explains reload and offers Keep this window. Browser recovery 2/2 and backend 64/64 pass.      |
| UX-21–23 | Parent accepted after iteration        | Native single primary export action, Ready to apply tracks and correct Decisions target; 390px Board retains Nothing has been sent without overflow.    |
| UX-24    | Parent accepted after iteration        | Opus phone patch fits every action at actual 390px and 320px with no footer overflow; related browser checks, final types and parent measurements pass. |

### UX-01 — Next-step guidance contradicts the available action (high, open)

Reproduce: open a new lead with no brief. The stage says **Next: Scout checks the fit**, while the primary action is **Prepare brief**. After a fit score exists, both that line and the primary **Evaluate fit** remain; Shortlist stays secondary. After drafting, the line says **Next: you approve the packet**, although **Review packet** is still required.

Impact: a new user cannot trust the stage line and can repeat work instead of advancing.

Acceptance: next-step wording reflects actual brief/form/review gates and current fit; a scored lead prominently offers Shortlist while reevaluation stays available. Preserve every launch/approval guard. Reuse authoritative state calculations where possible across job details and job chat.

Implementation (group 1, implemented — pending parent verification): new pure `packages/ui/src/lib/job-step.ts` orders the brief, form, fit, answer, packet-review, export and outcome gates once. Job details' footer (`components/CardDetails/next-action.ts`) feeds it the loaded application context (which also compares source revision); the stage line (`ClayInterface/jobs.ts` `nextUp`) feeds it snapshot facts. Lead without a brief: **Next: you prepare the job brief** / Prepare brief (Shortlist beside it). Brief exists but unconfirmed: the existing brief decision line / Review brief, with Shortlist and Evaluate fit still available (fit only needs the extracted brief, as the daemon enforces). Unscored lead: Scout checks the fit / Evaluate fit + Shortlist. Scored lead: **Next: you decide whether to shortlist** / primary **Shortlist** (hint shows the score) with outline **Evaluate again**. Linked shortlisted job without form choice: you check the application form. In review or stale review: Reviewer reviews the packet / Review packet. Agreed: you prepare the export for approval. changes_requested now reads Writer revises the packet. No daemon gate, queue, approval or launch guard changed; actions still go through the same routes and `launchBlocker`. Tests: `lib/__tests__/job-step.test.ts`, `ClayInterface/__tests__/next-up.test.ts`, three new cases in `CardDetails/__tests__/next-action.test.ts`. Limitations: the snapshot cannot compare the source revision, so after a posting edit the stage line may lag the footer until the brief is re-extracted (the footer stays authoritative); an inspected form newer than an inspected confirmation is not detected in the snapshot either. A shortlist pending move now shows its spinner on the single primary button rather than a separate Shortlist button.

### UX-02 — Brief preparation hides the automatic path (medium, open)

Reproduce: choose Prepare brief. Form inspection and Prepare brief manually are visible; **Agent and source extraction** is collapsed, hiding the main extraction path. The footer repeats Prepare brief without running or explaining extraction.

Impact: users are steered toward rewriting their posting into several empty textareas before discovering the agent can help.

Acceptance: make the recommended extraction path and its purpose visible when no brief exists, while keeping manual preparation and form limitations clear. Do not invent or silently prefill structured requirements.

### UX-03 — Brief form has two competing continuation actions (high, open)

Reproduce: edit the manual brief in the 680px job sheet. **Confirm complete brief and requirements** is below a long scroll. The fixed footer says **Continue brief review** and only jumps back toward the same section. Confirmation is disabled without a nearby explanation until the form-check choice is made.

Impact: repeated scrolling and an unclear disabled action, even after the main fields are filled.

Acceptance: a single clear path to confirmation, reachable from the sticky footer; show the actual reason confirmation is unavailable; preserve unsaved-edit guards, required answers and explicit manual form checking.

### UX-04 — Manual form-check checkbox separates control from label (medium, open)

Reproduce: Prepare brief manually for a linked job. Checkbox occupies its own line, with the long bold label beneath it; screenshot showed the small square at x795/y651 and label at y678.

Impact: poor association and an unnecessarily awkward decision target.

Acceptance: aligned checkbox plus wrapping label in one usable hit target, at desktop and narrow widths, keyboard accessible. Do not preselect this choice.

### UX-05 — Unsupported posting fallback gives an indirect permission instruction (medium, open)

Reproduce: enter the example.com posting URL in Add job. Fetch becomes disabled **Ask Scout to add job**, with **Enable “Scan saved job sources and add or update jobs from links” for Scout in Crew.** The manual form remains, but the helper no longer says it can be used instead.

Impact: users can read this as a blocking requirement and leave the dialog unnecessarily.

Acceptance: explain the manual fallback beside the failed/unavailable path; offer useful setup navigation without discarding a draft or changing permissions automatically.

### UX-06 — Primary document reading surface is raw Markdown (medium, open)

Reproduce: Application > Documents > Resume. First reading view shows `# Alex Rivers`, `## Application…` and `-` bullets in monospace. The later PDF viewer is readable.

Impact: application review feels like editing code; users must generate files to see readable content.

Acceptance: readable Markdown preview by default, with source text/copy still available. Preserve exact packet bytes, provenance and safe link handling; no editing or silent rewrite.

### UX-07 — Packet-fit assessment dominates an undrafted job (medium, open)

Reproduce: new lead > Job. A large **Packet match to job / Not rated** section, explanatory paragraph, disabled reevaluation button and helper appear before any packet exists. The actual candidate-fit next step is elsewhere.

Impact: introduces a second kind of score before it is usable and competes with the first task.

Acceptance: defer this optional section until a packet exists, or keep it in a concise disclosure. Existing evaluated results and reevaluation remain available.

Implementation (group 1, implemented — pending parent verification): `JobOverview` renders Packet match only when a packet or an earlier rating exists. Reevaluation, its blockers and existing ratings are unchanged once shown. Covered by the existing job-details browser test (submitted job with packet still shows and reevaluates); no dedicated new test for the hidden case.

### UX-08 — Export choices use developer-first defaults and vague busy state (medium, open)

Reproduce: Prepare export defaults to **Markdown**; PDF/DOCX require a dropdown change. Requesting all formats changes the footer to **Saving job…**, although files are being generated and verified.

Impact: ordinary applicants can finish with an unexpected format, and the longer operation gives an inaccurate account of its work.

Acceptance: make the useful application-file choice obvious (with compatibility explained), show document generation/preparation while waiting, retain bounded verification and exact-file approval. Consider format requirements when choosing defaults; do not force unsupported formats.

### UX-09 — Successful export does not surface a usable file handoff (high, open)

Reproduce: Decisions > Approve packet > Submit myself. Success changes the footer to I've submitted / Open application page, but the **Saved to** path is below the long attachment list. It is a long internal `try-export-<hash>` directory. No prominent access/copy control is visible in the success area.

Impact: users may not know where their files are before opening the employer form.

Acceptance: after export, show a compact success handoff with a clear way to access the approved files or copy their folder path. Web and Electron must both have truthful supported actions. Never open arbitrary unvalidated paths or bypass approval.

### UX-10 — “Submit myself” labels an export action (medium, open)

Reproduce: after approval, Submit myself first exports locally. Only afterward does the user get Open application page / I've submitted.

Impact: the immediate effect of a consequential-looking action is unclear, even though small helper copy explains it.

Acceptance: use a short action label that names export/manual application and clearly states that nothing is sent. Keep manual tracking separate from actual submission.

### UX-11 — Activity history exposes internal bookkeeping by default (medium, open)

Reproduce: job > Update outcome > History. A five-minute journey generates many rows including **Saved turn activity**, **Released application**, claim/ownership changes, **Moved to agreed** and repeated deterministic-workflow messages.

Impact: submission, review and outcome changes are buried in implementation events.

Acceptance: meaningful job history first; retain full technical evidence through a labelled disclosure or filter. Keep failures visible and avoid deleting or rewriting events.

### UX-12 — Current post-submission status is not clear in the job header (medium, verified)

Reproduce: move submitted job to Interviewing. The stage still says Applied, the next line remains **you track their reply** and no clear Interviewing label appears in the details header. The sidebar truncates it and History records it.

Impact: users must infer whether the update stuck, especially after the toast fades.

Acceptance: show the current outcome in the applied-stage presentation and use a useful next action, while preserving the six-stage model.

Implementation (group 1, implemented — pending parent verification): the current Applied step's label (StageTrack labels, its screen-reader stage text and the compact chat stage label) now names Screening, Interviewing or Offer; Submitted stays Applied. Still six stages. Next line by outcome (for example **Next: you prepare for interviews and record the outcome**), and the footer's Update outcome hint names the state. Tests: `stepLabel` cases in `next-up.test.ts`, the outcome hint case in `next-action.test.ts`. Checked in a hidden web preview of the audit job chat: stage text read “Stage 6 of 6: Interviewing” with the outcome-specific line (DOM text, not native Electron).

### UX-13 — Browser split collapses job identity almost completely (high, verified)

Reproduce: at native window 1442×961, open Browser from the job chat. The chat column is about 520px and keeps full sidebar plus many header controls. The company/title/summary shrink to a few characters (`E…`, `S…`, `E…`) beside participant and navigation controls.

Impact: the user loses which role/application they are working on while browsing.

Acceptance: preserve a readable company/title area at this width using wrapping or a compact header/action arrangement. Keep essential actions and keyboard access; do not resize the inspected native page or invalidate approvals merely to change header content.

Implementation (group 1, implemented — pending parent verification): `styles/chat/header.css` adds two `chat-desk` container steps for desktop (phone layout excluded via `.chat-mobile-view`). From 40rem up to 48rem the Job, Packet and Browser labels are hidden visually but kept as accessible names, and the bead stays visible. Below 40rem the identity takes a full row, with the view switch and labelled controls below it and the stage row third. The job h1 gets a `title` holding the full company · role. CSS only: the browser panel, its native page size and approvals are untouched. Verified only by DOM measurement in a hidden web preview, with the chat panel forced to 520px through an inline style in that tab (the browser was not opened, so no session or approval state changed): the identity row was 508px, and company/title were both untruncated (scrollWidth ≤ clientWidth). At 680px the controls were 40px icon buttons. Pixel screenshots from that hidden tab were stale and were not used. Native 1442×961 Electron recheck still needed. Trade-off: below 40rem the header is about 87px taller (211px vs 124px at full width).

### UX-14 — Introduction underexplains provider data flow (medium, verified)

Reproduce: introduction page 2 says **Your profile, board and drafts stay on this device. Agents run on the AI runtimes you choose.** It does not plainly say relevant context is sent to the chosen provider during an AI run.

Impact: “local-first” can be read as offline/private processing when setting up.

Acceptance: concise, plain and accurate local-storage/provider-context explanation in onboarding; no long warning or extra consent gate.

Parent review: Claude implementation retained local storage but still named only the runtime. Parent tightened it to explicitly name the runtime and AI provider. The surrounding browser-approval wording was also corrected to reflect permission modes and final-submission approval. Native introduction page 2 rendered the provider sentence cleanly at 1442×961; no new step was added. Final cross-review still pending.

### UX-15 — Demo readiness looks like real crew readiness (low, verified)

Reproduce: fresh development workspace > Start setup: crew is already Complete and “Scout, Writer and Reviewer are ready.” Demo limitations appear only in later run surfaces.

Impact: users trying the app can confuse scripted demonstrations with a configured AI crew.

Acceptance: development-only setup clearly labels scripted readiness; retain production readiness logic.

Parent review: Claude's ready-seat helper preserves the previous readiness calculation and tests cover real, Demo, mixed and production-unavailable configurations. Parent removed wording that could imply a mixed crew was entirely scripted. Native Board checklist shows the explicit Demo/no-AI explanation and wraps within the narrow setup card without clipping; accessible crew status is “Ready as scripted examples.” Green completion beads continue to mean the example setup is usable. Focused Onboarding tests passed 5/5. Final cross-review still pending.

Parent native recheck for group 1: at 1442×961, job details visibly reads **Interviewing**, with **Next: you prepare for interviews and record the outcome** and the corresponding footer hint. Job chat uses the same outcome wording. Opening its actual native browser shows the full company and role on a dedicated identity row, with reachable Job / Packet / Browser controls below. The page still starts at x806/y133 and ends at y871, matching the original split page region; the correction does not resize it. UX-12 and UX-13 pass this native desktop check, subject to final independent review. The taller narrow header is an explicit tradeoff; phone/short-window checks remain for final verification.

## Slowness and errors

### Final Opus review follow-ups — UX-21–23 (material, parent accepted)

The independent Opus 5.5 review returned **7.5/10, FAIL**. Its own desktop/phone Board checks passed basic layout, but job details, Decisions and Chat hit UX-20, preventing a full independent inspection. Additional source/native-image findings: **UX-21**, inline and persistent-footer Request export approval are both primary glazed actions; keep the same guarded request but only one visual primary. **UX-22**, the current stage and screen-reader label still say You approve after approval and manual export; use the actual approval/handoff state consistently for visible and accessible labels. **UX-23**, exported job details makes Record manual submission primary, while the necessary application handoff is elsewhere; Continue application should lead to the existing Decisions handoff, with recording subordinate and explicit only-after-applying guidance. The phone handoff also needs to retain a concise Nothing has been sent explanation. All approval, export, eligibility and recording gates must remain unchanged.

Underlying UX-20 evidence: read-only dependency requests return **504 Outdated Optimize Dep** for real Base UI/Streamdown/Lexical and other optimized imports, despite the CardDetails source module returning 200. The shared Vite dependency directory and metadata are absent while temporary optimization directories remain. Multiple tests create development daemons using the same default UI/cache root; installed Vite removes that directory when cache metadata is absent or incompatible. Concurrent cache interference is strongly supported, but the specific deleting process is not attributed. Isolate development/test instance caches instead of repeatedly clearing a shared live cache. The independent review note is `ux-final-opus-2026-11-08.md`; a fresh review is required after correction, with no score uplift assumed.

Current acceptance: Claude's repair isolates Vite caches by data folder and uses temporary caches for deliberate UI tests; non-UI fixtures no longer start Vite. Native failure injection by stopping only the scratch daemon produced a recoverable job-sheet dialog over Board. Reload explains unsent-edit loss and allows Keep this window; Close leaves Board usable. After restart, job details and Decisions load normally. Browser recovery passes 2/2 and ten cache/backend files pass 64/64. Native exported-job tracks now read Ready to apply, Continue application opens its packet, recording is secondary, and the export choices have one primary request action. At an actual 390×844 browser viewport the compact handoff says Files saved. Nothing has been sent, with no horizontal overflow. Parent review and screenshots are recorded in `ux-parent-handoff-review-2026-11-08.md`. Fresh independent scores remain outstanding.

### UX-24 — Phone Decisions footer hides application actions (high, new)

The second independent Opus review returned **8.5/10, FAIL**, confirming the earlier material fixes but finding this new blocker. At 390×844, an exported manual packet has four actions in a no-wrap footer. The primary is squeezed to 44px, clipping its label, Let an agent prepare is cut off and More is off-screen. The footer itself scrolls horizontally (470px contents in 366px), although the document width fits; the earlier document-overflow check was too weak to catch it. Parent viewed the review screenshot and inspected the `@container decide (width < 640px)` no-wrap rule, confirming the finding. Acceptance: primary and alternatives are completely readable/reachable at 390px without horizontal scrolling; every action fits its container and viewport, with a browser regression assertion for the manual-export state. Preserve all actions and submission gates.

The second review also records nonblocking polish in `ux-final-opus-second-pass-2026-11-08.md`: clipped sidebar statuses, raw state names in manual-correction history, past-stage/document labels, inconsistent word-count presentations, Demo plural wording, a development warning from lazy loading, the resting Browser button style, repeated phone stage heading and Add job initial focus. These are sent back to Claude for an evidence-based cleanup. A tracking confirmation modal is not needed; the independent reviewer agrees the local reversible action and existing hints are clear. The optional Undo toast remains a separate convenience, not a pass requirement.

The independent Grok second pass returned **8.0/10, FAIL**, independently confirming the same phone-footer and sidebar-status problems. It agrees that recording needs no modal. Its additional nonblocking observations are preserved in `ux-final-grok-second-pass-2026-11-08.md`: an expanded external-submission disclosure introduces a second glazed action; desktop job-header edit/close targets are only 26px; Escape does not close the read-only chat Packet split; and the exported section could name Decisions explicitly. It also observed a Base UI uncontrolled-Collapsible warning on History and repeated 304/aborted snapshot diagnostics without a rendered failure; these require source diagnosis before calling them product defects. No further approval, export or employer action was performed by the reviewers.

Parent's own read-only preview reproduced UX-24 at actual 390px: footer clientWidth 366, scrollWidth 470, visibly clipped primary and hidden alternatives. Resizing the same Decisions view did not reproduce the reported Collapsible warning (console entries remained empty); notes stayed open after the desktop-to-phone resize. `VerdictNotes` changes its uncontrolled defaultOpen with the media query, a plausible mechanism but not proof of that reported console event. The parent tab was closed without an approval, export or tracking change.

The subsequent frozen full check exited **0**: **468 test files passed, 2 skipped; 3392 tests passed, 8 skipped**, plus 54 Node script tests. Lint, root/landing types, UI/desktop build and landing production build all passed. Vitest took 1862.68 seconds. SHA-256 comparisons verified all 120 recorded changed source/test files remained identical during the run. The landing build's two generated `next-env.d.ts` import changes were restored to the original dev-type paths. Existing build warnings remain recorded below. This validates the patch before the phone-polish iteration; it does not pass UX-24 or the independent score gate.

Parent applied the 21-file Claude phone-polish patch only after that run finished and after verifying its original-file hashes. Current acceptance: actual 390×844 footer is 366px wide with 366px contents; at 320×844 it is 296/296. Both are 192px tall with no internal scroll, one full-width recording action, and whole, reachable application/agent/More controls. New browser assertions cover both widths. Native sidebar shows Ready to apply, Screening and Interviewing in full; correction History uses product labels and You, and the past approval phase is neutral. Lint passes, **813 UI/adapters tests pass across 152 files**, and **26 browser checks pass across six files**, including the real development React warning check. Actual Bun 1.4.4 integration also passes SQLite, HTTP gates, conditional snapshots, SSE, bounded helpers, MCP stdio, unapproved-export rejection and Vite assets.

The final parent iteration resolves the real TypeScript error in the revised loader's optional-union promise type. It also makes header hit areas explicit (the old pseudo-element margins overlapped adjacent buttons), and controls the review-notes disclosure as viewport defaults change. Types, lint and five focused files pass (25 tests). Parent measured 32×32 desktop and 44×44 phone controls and verified responsive defaults plus an explicit user's disclosure choice across resizing without console warnings. Native Add job focuses the URL field, then Escape returns focus to Add job without saving or fetching. Existing saved Demo copy is historical and is not rewritten. The phone stage heading is retained for its filtered count, sorting and focus target; read-only Packet splits remain nonmodal with a reachable Close control rather than acquiring an app-wide Escape handler. Parent accepts the changes. At that point the latest scores were **Opus 8.5 / Grok 8.0**, both failed; the subsequent third-pass reviews below supersede them.

### UX-20 — Lazy screen failure replaces the app with a raw error (high, newly verified)

During independent review, the development log reported failed dynamic imports for job details, Decisions and Chat. Parent reproduced opening Live UX Studio from the actual Electron sidebar: the whole app became **Something went wrong!**, with a raw module URL in a red box and only **Hide Error**. There is no retry, reload, return-to-Board action or clay recovery surface. A normal Ctrl+R restored Board but opening job details failed again. Evidence: scratch `screenshots/module-load-fatal.jpg`. A direct read of the top-level job-details module returned HTTP 200 JavaScript, so the underlying dependency/request cause is not established yet. This appeared after a development daemon restart while the full suite and review tabs were active; no installed-production regression is claimed from that context alone. The destructive recovery presentation is observed independently of the request's cause. Acceptance: diagnose the actual import failure, restore the running review flow, and present a clear recoverable screen/panel without exposing raw implementation details or automatically discarding unsent drafts.

### UX-19 — Board action links declare native-button semantics (low, verified)

The actual development daemon relayed Base UI console errors while Board rendered: **A component that acts as a button expected a native button because nativeButton is true**. Stack identifies `DeckActions`. Review and Answer are router links composed through the shared Button without `nativeButton={false}`. Parent applied that existing repository pattern to both link branches, retaining navigation and appearance. This is a small review correction; the regular-user Continue application navigation already passed, and the restarted console will be checked after revisiting Board.

Revisited Board in the restarted native app; no Base UI or console error was relayed. Both navigation anchors use the repository's non-native Button composition. The shared browser confirms the expected href after HMR. An attempted explicit link role was rejected by the repository accessibility lint rule and removed; no lint exception was added. Related advanced-review prompt examples were also made schema-valid during parent review, with 27 contract/privacy tests passing; a live advanced hiring-panel run is outside this walkthrough.

### UX-18 — Real Writer draft fails without useful recovery diagnosis (high, verified)

Native live extension: Claude Code / Sonnet 5.5 / High successfully extracted the fictional posting; Codex Scout then assessed fit. After explicit confirmation, **Draft application** failed in 38 seconds. One normal Queue **Retry** failed again in 42 seconds. No packet was saved. Both turns and Queue say **The runtime did not return a valid structured result. Check its model/sign-in and retry.** The chat stage says **Writer revises the packet**, although no first packet exists. Diagnostics and Retry are available in chat; the generic message gives no evidence for changing sign-in or model.

Opened the failed turn's **Diagnostics** disclosure natively: it repeats the same generic error and provides Copy diagnostics, without a result category or a field hint. Successful extraction and fit activity reported 12 and 22 seconds respectively. These are app-reported turn durations, not isolated performance benchmarks.

Source investigation found a concrete instruction/schema contradiction: both Writer JSON examples include `changes: []`, while the optional change-notes schema requires 1–8 items when present, and the handoff instructions say to omit changes on a first draft. This can produce an invalid result when followed exactly. The actual two outputs were discarded, so it is a candidate cause, not a confirmed diagnosis of those runs. The generated scratch run contains instructions and skills, without a raw output log. Acceptance: consistent first-draft/revision examples, strict result validation, safe field/category diagnostics without retaining private output, truthful initial-draft retry guidance, and a successful native live retry before acceptance. Preserve all MCP permissions, approval gates and runtime isolation.

Parent review of Claude correction: first-draft examples now omit changes, revision examples contain a nonempty note, and resume/cover-letter/reviewer-summary placeholders satisfy the unchanged schemas. Rejected results retain only missing/invalid-JSON/schema/wrong-role categories and up to four allowlisted field paths, without private output, values or validator messages. Unsupported model/sign-in advice is removed. A missing first packet maps to drafting rather than revision. After restarting the scratch daemon, one native **Retry** with the same saved Writer configuration completed in **41 seconds**, saved a packet, cleared the failed request and advanced to **Next: Reviewer reviews the packet**. Old failed turns remain historical evidence. This supports the fix without retrospectively proving the discarded outputs' exact failure category. Focused contract/privacy/UI tests pass (267 passed, 2 skipped), and the final full check is running.

Full repository check completed with **3311 passed, 11 failed, 8 skipped**. Four failures were the dirty-brief test fixture still leaving the job as a lead; the corrected shortlisted fixture passes 4/4. Other recorded stacks show Windows clipboard CRLF comparisons (2), platform-dependent POSIX mode (1), forward-slash path assumptions (2), a Windows raw path passed to Node `--import` (1), and an initial browser navigation timing out at 5 seconds (1). Minimal platform/readiness test fixes are being verified; these results do not constitute a green full check.

### UX-17 — Board still asks to approve an exported manual application (medium, verified)

Reproduce: approve the fictional packet, choose **Export to apply myself**, leave **I've submitted** untouched, then return to Board. The Needs you card still says **Approve the … packet?**, its job card and sidebar say **Approve packet**, and the stage line inherits approval wording. Decisions correctly says Apply, and the saved-files handoff says nothing has been sent. The underlying state is correct; the board's guidance is stale. Acceptance: pending packet approvals retain approval wording; approved/exported manual packets lead with applying and recording submission only after applying. Keep all attention and review/export/submission gates; do not mark a job submitted or assume the application happened.

Parent native review: Board now shows **Apply to UX Recheck Studio (fictional), then record it**, the saved-files/nothing-sent explanation and **Continue application**. Job card and sidebar say **Ready to apply**. The button opens the existing Decisions handoff, with full local folder, file tiles and a separate **I've submitted** action whose footer says to record only after applying. Job chat's next line names the same apply-then-record step. No submission was recorded. Source review confirms attention eligibility still comes from `packetNeedsAction`; the presentation helper distinguishes pending, approved, manual export, agent handoff and uncertainty without changing those gates. Native desktop check accepted; final independent review remains.

Live extension underway: configured only the isolated scratch crew through native **Use recommended setup** and Save settings: Writer = Claude Code / Sonnet 5.5 / High, Scout = Codex / GPT-6.1-Sol / Medium, Reviewer = Codex / GPT-6-Astra / High. No native accounts, credentials or permissions were changed. The recommendation button showed Checking installed runtimes across observations, then supplied complete choices; polling was not frequent enough to state an exact latency. Concurrent repository tests mean these observations are not a performance benchmark.

Live extension results so far: created **Live UX Studio (fictional)** manually from a fictional posting with no application link. Real Claude Code source extraction produced an accurate structured brief, explicitly retained the fictional/audit limitation, separated required qualifications from preferred automated testing and noted missing salary/form limits. Codex Scout then saved a 92/100 fit assessment; the primary action advanced to Shortlist. No runtime error was observed in either step. Drafting, real Reviewer and export-footer recheck remain.

### UX-16 — Export footer repeats navigation after opening the choices (medium, verified)

Parent native review: the real Codex Reviewer passed the live fictional packet in **48 seconds**, with explicit missing-form/contact/evidence limitations. **Prepare export** opens the choices and changes the footer to **Request export approval**. Selecting **Word (.docx)** updates the footer's format hint. One click on that footer generated `resume.docx` and `cover_letter.docx` plus the Markdown copies; Decisions shows those exact files under approval `42566f1b-89a6-4c3b-9923-6654bcd6142d`, with two readable-document checks and no document errors. Word preparation completed between observations, so a busy-controls screenshot was not captured in this fast request; focused tests cover the immediate request guard and disabled state. The native payload/result check passes.

Fresh recheck: after the reviewed job's **Prepare export** opens the Export section, the persistent primary action still says **Prepare export** and only focuses that section. The user must switch to the inline **Request export approval** button. This repeats the brief's former navigation-only footer problem. Acceptance: once the export section is open, the persistent action requests approval with the exact visible format/layout choices through the same guarded action as the inline button; before it opens, Prepare export can remain navigation. Disable both choices and requests while preparing files and retain the existing server approval gates.

Fresh native recheck evidence: created **UX Recheck Studio (fictional)**, extracted with Demo, evaluated at 60/100 while still unconfirmed, shortlisted, completed and confirmed the brief from the persistent footer after explicitly selecting manual form checking, drafted, reviewed and generated the suggested PDF files. Next-step and primary actions progress through fit, shortlist, draft, Reviewer review and export. PDF is suggested with the unchecked-form limitation visible; busy copy reads **Preparing and checking documents…**. Its job conversation is `54903055-e1d3-4694-8cc8-e5237a9501ae`, and approval is `cb180fd8-484a-4902-b820-829e5935c110`. Manual handoff and tracking recheck continue.

Downloaded the earlier approved resume through the actual native Download/Save dialog into the isolated audit folder. Its SHA-256 matches the exported approved resume exactly (19,839 bytes). The Save dialog exposed unrelated filenames incidentally; none were opened or used as task data.

Parent packet review: UX-06's native default is now a readable resume, with the exact Markdown still available in Source. UX-09's saved-files handoff is visible above the review in Decisions History; the long folder wraps, Copy folder path succeeds, and the approved PDF renders. UX-11's history has a collapsed Technical steps record. Parent tightened that classifier to keep unfamiliar progress and failed/interrupted/cancelled runs visible, and added the observed Profile-version bookkeeping and known chat starts. A Word-format hint was corrected so it does not claim all upload fields reject PDF when some accept both. Focused packet helper tests pass 3/3. Fresh export and manual-handoff recheck remains.

Responsive check: shared browser at 390×844 shows full job role/company in its compact header, Interviewing status, reachable Job/Packet/Browser controls and composer. Read-only DOM measurement confirms no horizontal document overflow and 44px header control targets. The next-move sentence is truncated in the compact stage area; the full wording remains in its accessible text and job details. This is a CSS viewport check, not a physical phone or touch-keyboard test.

Second parent review of UX-01: a fresh public posting imported through Fetch from link, extracted with Demo and scored 60/100 still shows **Confirm brief** in the board's Needs you card and **Review brief** as its primary footer action. This is the common extracted-but-unconfirmed case, so UX-01 is not accepted yet. Fit and shortlisting should lead while a job is a lead; required confirmation and form readiness still gate drafting after shortlisting. A focused Claude iteration will also use the existing core form-currentness helper so newer changed inspected requirements invalidate snapshot guidance while identical requirements stay current.

Parent native review of UX-03/04: the persistent confirmation action and its disabled reason are visible, the manual-check checkbox and wrapping label share a row, and clicking the label explicitly enables confirmation. Cancelling restores the saved brief. Footer wiring uses the same guarded action as the inline button. Focused helper/footer unit tests passed 14/14; the browser integration check is running.

- **Environment, resolved:** first `bun run dev` failed with missing better-sqlite3. `bun install --frozen-lockfile` installed 787 packages in about 15 seconds. This is a checkout prerequisite, not a product runtime regression.
- **Environment, resolved:** system Bun 1.4.2 versus repository 1.4.4; used `npx --yes bun@1.4.4` without replacing the user's global binary.
- **Cold development start:** roughly half a minute from daemon launch to readiness/dependency scan. Native desktop's first start also downloaded Electron. These were cold setup costs; do not report them as measured installed-app startup latency.
- **Observed run time:** Scout fit and Reviewer Demo workflow reported less than one second; Writer's completed chat activity reported 9 seconds (including actual packet verification). While running, the job only said “Running the deterministic demo workflow,” without a document-verification phase. Include truthful progress if an existing phase signal is available; do not invent percentages.
- **Observed export:** formatted PDF/DOCX preparation needed a later observation before completion. Exact wall time was not instrumented; do not claim a precise latency. UX-08 covers inaccurate busy copy.
- **PDF preview:** initially displayed Loading PDF, then rendered successfully on the next observation. No render error observed.
- **Automation, excluded from product defects:** shared preview first returned ERR_CONNECTION_REFUSED during startup, followed by a 15000ms snapshot timeout; switched to native app. Some Windows accessibility trees lagged the screenshot, and offscreen/input index actions did not always act. Screenshot-backed actions worked. Source confirms skip link is correctly `href="#main"`; the cached absolute UIA URL is not a product navigation bug.

## Verification boundaries and review gate

The complete local application pipeline was exercised with fictional data, not an employer's live form. No real application was submitted. Browser navigation was tested; approval targeting, file upload, CAPTCHA/auth handoff and live employer-form submission remain separate flows requiring their own fixture or authorized target. Skills and Routines were opened and inspected; a routine editor was opened and cancelled, not scheduled. No claim is made that every setting or failure branch has been tested.

Live Scout chat: passed. Conversation-only Claude Code override saved successfully. A request to read the fictional Profile produced a source-linked two-sentence response, identifying relevant frontend roles and asking about work authorization/location. Completed activity reported 6 seconds and one tool step. No runtime error observed. This validates one live chat turn, not the full live-provider drafting/form pipeline.

Implementation status: UX-01–24 have parent acceptance after Claude Opus 5.5 implementations and iterations, with small parent integration/copy corrections. The pre-phone-polish frozen repository check passed 3392 tests with eight skipped, 54 script tests, lint, types and all builds. The applied phone patch passes 813 UI/adapters tests and 26 browser checks; the final correction passes types, lint and 25 focused checks, with parent control-size/disclosure/focus acceptance. The third-pass reviews and final settled repository check now pass; their evidence follows.

Implementation audit also caught and repaired a malformed intermediate `useCardDetails.ts` edit; the repeated fragment was removed mechanically after a concurrent-change check, then Claude applied the intended change correctly. This was an implementation error caught during work, not a baseline app defect. Initial full-check assertion failures were corrected for intentional fixture behaviour, Windows/platform readiness and unrelated installed-runtime probing; affected focused checks and the subsequent frozen full check pass. The original failures remain documented above.

Fresh manual handoff passes: after inspecting the generated resume PDF and approving the exact packet, **Export to apply myself** saves the local files and explicitly says **Nothing has been sent**. The next action is separately **I've submitted**. The fictional job remains at this stage for final reviewers; the original audit job still records Interviewing and validates the tracking/outcome path.

The real-runtime extension also reached local export and tracking: inspected both generated DOCX previews (readable, with truthful Word-layout approximation notes), approved the exact files, chose **Export to apply myself** and observed the saved-files handoff. The absent application URL is explained beside the actions. Recorded a synthetic manual submission for this fictional audit only; the job left To decide, the sidebar became Submitted, and job details advanced to Applied with **Update outcome**. No employer was contacted. UX Recheck Studio remains at manual handoff for independent reviewers.

Then recorded a synthetic Screening outcome through **Update outcome**. The current stage becomes **Screening**, the line becomes **Next: you prepare for screening and record the result**, the footer repeats that purpose, and History leads with **Moved to Screening** and the manual-submission record. Earlier failures remain in history; known bookkeeping stays in the collapsed technical record. Native evidence images are saved outside the repository under the scratch workspace's `screenshots` folder.

Both initial independent reviews scored 7.5/10 and failed. The second passes scored **Opus 8.5 / Grok 8.0**, both failed, while confirming the earlier material fixes and identifying the phone footer and readability issues addressed by the latest patch. The required UI/UX pass threshold is **9/10 or higher**, with justified rubric scores and no unresolved material flow defects. The third passes below meet that threshold; the earlier scores remain as the review and iteration history.

Third-pass update: independent **Opus 5.5 scores 9.0/10, PASS**, and **Grok scores 9.1/10, PASS**, both with no unresolved material flow issue. Their own 1440/1280/390/320 checks confirm the earlier material fixes, keyboard More-menu operation, full sidebar statuses, shared word counts, 32/44px controls, Add job focus, responsive notes and no React warnings. Nonblocking suggestions and coverage limits remain in `ux-final-opus-third-pass-2026-11-08.md` and `ux-final-grok-third-pass-2026-11-08.md`; no claim of a flawless app is made. Opus's thirteen screenshots were mirrored into the audit screenshots folder with their `third-pass-` names; Grok's twenty-one remain under the audit workspace's `scratch/screenshots`. The requested independent UX score gate is met. Final test validation also passes, as recorded below.

During the previous accepted-source full check, a 10-second timeout appeared in the first Profile import fixture case (the other three cases passed). A separate scratch-config diagnosis avoided rebuilding the distribution used by that running suite. The following paragraphs record the diagnosis and the four test-only corrections applied after that process exited. Product source stayed frozen; completion was withheld until the corrected rerun passed, irrespective of the passing UX scores.

Isolated diagnosis reproduced the same one-failed/three-passed result: **Hook timed out in 10000ms** at the first `beforeEach`, while its initial `page.goto()` still waited for load. The first test body never ran and the DOM had no controls at expiry. No reload or query reset occurred; that earlier hypothesis is disproved by the trace. The fixture's 10-second Playwright default also applies to navigation, so increasing only the hook would leave another 10-second deadline. The test-only correction gives cold navigation 30 seconds and the local setup hook 60 seconds to cover navigation plus its existing 30-second dialog-readiness wait. All action timeouts and assertions remain unchanged. A fresh-cache run of that exact correction passed outside the frozen checkout before application.

The prepared Profile import correction passes all four cases in a fresh-cache run: first navigation took 12.939 seconds, after which every original search/selection assertion executed. Chat References reproduced a matching 10-second navigation timeout (six bodies skipped); the explicit 30-second cold navigation then passes all six cases, with first navigation 13.282 seconds. A dedicated Vite HTTP/WS contract test also exceeds its old 15-second whole-case budget: an isolated run with unchanged assertions took 28.621 seconds, including 8.483 seconds startup, 13.142 seconds client-asset preparation and 5.902 seconds bounded shutdown. Its local budget is now 45 seconds. These test-only corrections were prepared outside the checkout while that full run finished. One instruction-update restart case also reached its 15-second deadline; its diagnosis follows. No runtime or UX change was inferred from that failure alone.

The frozen run then ended with the four expected failed files: **3385 passed, three timed out, fourteen skipped** (six were blocked by Chat References setup), 2279.71 seconds. Final stacks match the reproduced setup/test deadlines. The instruction case's three initializations alone took 15.574 seconds; isolating unrelated native detection preserves Demo and all seven tests pass under their original 15-second budget. After the process exited, the parent verified the four-file patch's before/after hashes and applied it. No assertions were removed and runtime-source drift from the reviewed UI is zero. The complete check was then rerun with 139 source/test hashes frozen and passed. `ux-final-test-readiness-2026-11-08.md` records the exact scope and evidence.

Additional verification: after UX-17, the Decisions browser suite passes 7/7, including approval and manual-export heading changes. Platform/readiness corrections pass 24/24 focused tests across five files; the updated dirty-brief fixture separately passes 4/4. App/desktop build and landing production build pass. Build output still includes CSS `::highlight` optimization, large chunk, ineffective PDF.js dynamic import and landing `metadataBase` warnings; no runtime failure was attributed to those warnings during the walkthrough.

## Final acceptance — 9 November 2026 local time

The settled `npx --yes bun@1.4.4 run check` exited **0** at approximately **2026-11-08 22:11 UTC** (9 November, 00:11 in Jerusalem). **470 test files passed, 2 skipped; 3394 tests passed, 8 skipped**, plus **54 Node script tests passed**. Lint, the 1134-component structural checks, root/landing typecheck, UI build, desktop build and landing production build all passed. Vitest duration was **2091.90 seconds**. This result supersedes all earlier pending or failed validation statuses.

All **139 recorded source/test SHA-256 hashes remained unchanged** during the run. The landing build's only generated source diff was its two `next-env.d.ts` type-import paths; those were restored to the original dev paths after inspecting the exact diff. The independently reviewed runtime code did not change after the passing Opus/Grok reviews. Separate actual Bun 1.4.4 integration also passed SQLite persistence, HTTP session/Host/Origin gates, conditional snapshots, SSE, bounded Node helpers, MCP stdio, unapproved-export rejection and development UI assets.

Final check log: `C:\Users\spide\.pitchcrew-ux-audit-20261108\verified-final-check.log`; frozen manifest: `verified-source-hashes.json` in the same folder. The accompanying formatting log is `verified-format-check.log`. Both independent UX reviews pass their required score gate. The native journey, issue/delay log, Claude implementation/review iterations and final validation are complete. Changes remain uncommitted; no PR or deployment was requested. No real employer submission occurred, and the coverage boundaries above still apply.
