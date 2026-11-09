# Phone-polish patch: implementation, review and testing note (8 November 2026)

The parent application/review section records verification after application. The original implementation, risks and proposed checks below it describe Claude's earlier prepared patch; statements that tests had not run are historical, not the current validation status.

Artifacts in `C:/Users/spide/.pitchcrew-ux-audit-20261108/phone-polish-patch/`:

- `changes.patch`: git-apply diff, 21 files (19 modified, 2 new). Generated from exact `before/` and `after/` copies.
- `manifest.txt`: the checkout's SHA-256 for every modified path, taken while frozen. All match the `before/` copies (no drift).
- `before/` and `after/`: the exact copies, with relative paths preserved.

No checkout file was modified. I ran no repository test, build, lint or typecheck, and did not touch the daemon or the frozen check.

## Parent application and review

After the frozen full check passed (3392 tests passed, 8 skipped; lint/types and all builds passed), the parent verified every original SHA-256 and applied this patch cleanly. The actual Bun integration also passed SQLite, HTTP session/Host/Origin checks, conditional snapshots, SSE, bounded Node helpers, MCP stdio, unapproved-export rejection and dev UI assets.

Native Electron now shows full Ready to apply, Screening and Interviewing sidebar statuses; correction history says Moved to Reviewed / Awaiting approval with You; the passed step reads Approval rather than a new instruction. In the parent's own browser at actual 390×844 and 320×844, every manual-handoff action is whole and reachable. Footer clientWidth/scrollWidth are 366/366 and 296/296, respectively, with a 192px height and no internal scroll. Screenshots are outside the repo under scratch screenshots as `parent-phone-footer-390-fixed.png` and `parent-phone-footer-320-fixed.png`.

Initial parent checks: lint passed, and six browser files passed **26/26**, including real development React lazy loading, load recovery, the manual footer at 390/320, Add job focus, Board layout and native-browser panel behaviour. The broader UI/adapters source suite then passed **813/813 across 152 files**. Typecheck caught TS2345 in `retryable-lazy.ts`: the optional union `status` on Attempt was not assignable to React's discriminated Usable promise types. Parent returned that concrete error to Claude.

The follow-up in `ux-phone-parent-iteration-2026-11-08.md` resolves the type error, uses explicit 32px header controls with the 44px phone floor, and controls responsive Reviewer notes. Types, lint and five focused files (25 tests) pass. Parent measured actual 32×32/44×44 controls and verified default/explicit disclosure choices across resizing without console warnings. Parent accepts the phone-polish iteration. Subsequent independent third-pass reviews pass at Opus 5.5 9.0/10 and Grok 9.1/10, including their own phone-footer and responsive checks. Final repository validation is recorded in the journey's current verification summary.

The parent also made external-submission registration outline to preserve one glazed footer action, and named Decisions explicitly in the exported section's next-step text. P10 is retained because its heading carries sorting, filtered counts and keyboard focus. No Undo toast or tracking confirmation was added. Saved Demo reviewer text remains historical; new Demo wording is corrected without rewriting events.

## Apply

From the repository root, once the frozen check finishes:

1. Re-verify the hashes in `manifest.txt`.
2. Run `git apply --check <patch>`, then `git apply <patch>`.

I checked the patch with `git apply` against a copy of `before/`. The result matched `after/` exactly. The only difference was line endings: my check copy had no `.gitattributes`, and the repo's `* text=auto eol=lf` keeps LF in the checkout.

## Changes

### N1 / UX24 (required): Decisions phone footer reflows

- **`styles/decisions.css`**, in `@container decide (width < 640px)`:
  - `.decide-actions` now wraps. Each action is `flex: 1 0 auto` (it never shrinks below its natural label width), with `max-width: 100%`, `white-space: normal` and centred text, so a label wraps rather than clips at extreme widths.
  - The first action (the glazed primary) and any `.decide-footer-note` take a full row.
  - The icon-only More keeps its square through `.decide-more { flex: none }`.
  - Wider layouts are unchanged.
- **`PacketMoreActions.tsx`**: adds the `decide-more` class to the trigger. Handlers, menu items, approvals and labels are unchanged.
- **Variants, all handled by the same rules:**
  - Pending: Approve full-width, then Request changes and More.
  - Choosing: Let an agent prepare full-width, then Export to apply myself and More.
  - Manual: I've submitted full-width, then Open application page and Let an agent prepare, then More. When there is no URL, the note takes its own row.
  - Continue application.
  - Uncertain: Open job only.
  - Browser approval footer: the `.approval-footer` wrapper is the full row and its buttons wrap.
  - Question footer: Answer full-width, then Cancel.
  - Brief: a single action.
- **Live evidence, DOM-only:** in my own preview tab I injected exactly these rules into the real exported UX Recheck footer and fixed the `decide` container's width. Nothing was saved, and I removed the probe and closed the tab.

  | Width | Current CSS                                             | Proposed CSS                                                                                                          |
  | ----- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
  | 390   | footer `scrollWidth` 542 vs `clientWidth` 390: overflow | no overflow (390/390). I've submitted fills 14–376. Row 2: Open application page + Let an agent prepare. Row 3: More. |
  | 320   | footer `scrollWidth` 542 vs `clientWidth` 320: overflow | no overflow (320/320). One action per row; More sits beside Let an agent prepare.                                     |
  - At both widths no label is clipped (`scrollWidth <= clientWidth`), and each action is 44px tall.
  - The footer grows from about 88px to 192px. Its 50% `max-height` leaves room on 844px and shorter phones; at extremely short heights the footer scrolls vertically, which is existing behaviour.
  - The preview tab would not apply the viewport resize, so this was a container-width emulation, not a real 390px viewport.

- **Test, `test/inbox.test.ts`:** extends the existing post-manual-export flow at real 390×844 and 320×844 viewports. It checks:
  - the four exact action names;
  - every action's rect is inside both the footer and the viewport;
  - no clipped labels;
  - the footer has no internal scroll on either axis;
  - the primary fills its row.

  It then restores 390 for the existing attachment checks.

### P1: sidebar job rows

`styles/clay-interface.css`: the company name now truncates first, with a 2.5rem minimum. The status is `flex: 0 0 auto` with a 55% cap, so "Ready to apply", "Screening" and "Interviewing" stay readable; a very long status clips last. The accessible name and tooltip are unchanged. I did not suppress the status when space runs out: that needs a container query, and hiding it would also change the accessible name. Not verified live; please confirm at 1280px with the sidebar open.

### P2: History wording

`ActivityPage/labels.ts`: stored `User changed status to <state>` is rendered like `Moved to <state>`, using the shared `stateLabels` (for example "Moved to Awaiting approval", "Moved to Reviewed"). The row's actor line already says "You". Unknown states pass through verbatim, failures are never hidden, and stored events are not rewritten. Unit tests are added.

### P3: passed approval stage

`ClayInterface/helpers.ts` `stepLabel`:

- A passed approval step reads **"Approval"**. I deliberately did not use "Approved": imported or externally registered submissions and user drags can pass stage 5 with no approval, so "Approved" could be false. "Approval" reads as a phase name, like Drafting and Review. If you prefer "Approved", it is a one-word change.
- Current and future steps are unchanged: a future step still reads "You approve", and the current one keeps its packet-stage labels.
- The Decisions rail uses `stepLabel`, so it follows.
- The existing assertion in `stage-track.test.ts` is updated.

### P4: Documents row

`CardDetails/helpers.ts`: the Documents row says "Exported version" only when `packetExported` is true, meaning a consumed approval with an export directory whose packet equals the current card packet. A later edit reads "Draft available" again. It never claims "final". An approved-but-not-yet-exported packet still reads "Draft available": I left that alone to avoid threading approvals into a 100-line-limited component. Test added.

### P5: word counts

- **Proven from source:** the chat Packet panel split on whitespace, so Markdown markers (`#`, `-`) counted as words. The file tiles count only runs that start with a letter or digit. For the same text that gives different numbers, which matches 54 vs 48.
- **Fix:** one shared `readableWordCount` in `lib/packet-labels.ts`, used by both `ChatView/packet-panel.ts` and `FileViewer/attachments.ts`. Stored artifacts and metadata are untouched.
- **Test:** new `ChatView/__tests__/packet-panel.test.ts` asserts that the panel and tile agree, at 8 words where the old rule counted 11.
- **Caveat:** if a PDF tile's `text` were extracted PDF text rather than the Markdown source, counts could still differ slightly. The reviewer saw PDF and .md tiles agree at 48.

### P6: demo plural

`adapters/src/demo/index.ts`: "1 source-backed Profile line" / "N … lines". This affects only newly generated demo reviews. The saved review on UX Recheck keeps "line(s)" because events are append-only, and there is no data rewrite.

### P7: `retryableLazy` and `use()`

- **Cause, confirmed in React 19.3 `react-dom-client.development.js`:** `trackUsedThenable` records the fiber that suspended on mount. `finishRenderingHooks` logs "This library called use() to suspend in a previous render but did not call use() when it finished" when the same key path then finishes with no `use()` (`thenableState === null`) and no discrete event intervened.
  - The old `Lazy` called `use()` only while the component was missing, so the retry render after the import resolved skipped it.
  - Conditional `use()` is normally allowed. The problem is suspending without calling it again on the retry.
- **Fix:**
  - `Lazy` calls `use()` on every render.
  - Each attempt has one stable promise. It never rejects: a failure is stored and thrown at render.
  - The promise is marked `status: 'fulfilled'` once it settles, so `use()` returns synchronously on every later mount, with no extra suspend and no "uncached promise" warning. React reads that field on the client and in Fizz.
- **Unchanged:** `retryFailedLoads()` (it clears the error and the attempt, so the next render imports again), `preload` (the shared in-flight promise), no automatic reload, and the Chromium failed-module confirmed-reload logic in `LoadRecovery`.
- **Test coverage:**
  - The existing `recovery.test.ts` now exercises the new path through `renderToStaticMarkup`, since Fizz `use()` must see `fulfilled`.
  - New `test/lazy-development.test.ts` drives the real development UI (Vite and development React, through the orchestrator helper with `ui: 'dev'` and `uiCache: 'temporary'`) in headless Chromium. It loads the app shell, Board, the job sheet and Decisions as first-time lazy imports, and asserts that no console error or warning mentions `use()`.
  - I believe the old code reproduces the warning deterministically on the first suspended lazy mount (the root App route), but I have not run it before or after the fix. Port 14785 is unused in the repo.
  - This test is slower (a Vite dependency optimisation; 180s budget).

### P9: Browser header button

`BrowserButton.tsx`: `variant="ghost"`, matching Job and Packet. The existing `.chat-browser[data-open]` sunken style still marks it pressed while the browser shows the page. Waiting and working beads, the accessible names and `aria-expanded` are unchanged. Native viewports, takeover and approvals are untouched. Comment updated.

### P11: Add job initial focus

`AddOpportunity/index.tsx`: passes `initialFocus` to the existing `Modal` and Base UI API.

- Opening Add job by mouse, pen or keyboard focuses the enabled Job post URL field.
- Touch keeps Base UI's default (the popup), so no virtual keyboard appears.
- Edit job keeps the default.
- When the field is disabled or missing, it falls back to the default.
- Final focus restoration (Escape or Cancel returns to Add job) is unchanged.

Test: `test/job-edit.test.ts` asserts focus lands on the URL field after clicking Add job.

## Not implemented

- **P8 (Undo toast):** not implemented, as instructed. There are no permission, gate, backend or queue changes.
- **P10 (phone Board selector and heading):** declined, for three reasons:
  - The column heading is not a pure duplicate. It carries the search-filtered "N of M" count, the state beads and the per-stage sort menu, and it is the focus target `focusStage` uses for Jump and moves.
  - `board-layout.test.ts` ("phone stages retain readable counts and full touch targets") codifies readable phone headings.
  - Hiding it would move sort and beads into the selector row: a layout change, not polish.

  A low-risk later option is to drop the count from the select trigger only (keeping it in the options), which needs a custom `SelectValue` render.

## Risks and honest limits at patch preparation

- **Nothing has run.** No unit, browser, typecheck or lint run.
  - I format-checked every `after/` file with the repo's `oxfmt` config; there are no differences.
  - I typechecked only a minimal isolated snippet of the `Attempt` promise typing with the repo's `tsc`.
- **N1 is not verified at a real viewport.** It is verified live by DOM-injected CSS with container-width emulation; the real-viewport check is the new test.
- **The manual state stacks three rows on phones** (about 192px). That was a deliberate trade for readable, reachable actions with one full-width primary.
- **P7 browser test:** the warning is printed once per page, via React's `didIssueUseWarning`. If the dev server's first-load dependency optimisation triggers a full reload, the test still loads all four surfaces afterwards. Its pre-fix failure is expected but unproven.
- **P1:** CSS reasoning only, not verified live.

## Original proposed checks after applying

1. `bun run format:check` and `bun run lint`. Component line limits: AddOpportunity ends at about 46 lines and PacketMoreActions at about 50.
2. `bun run typecheck`
3. `bunx vitest run packages/ui/src/ActivityPage/__tests__/labels.test.ts packages/ui/src/ClayInterface/__tests__/stage-track.test.ts packages/ui/src/components/CardDetails/__tests__/helpers.test.ts packages/ui/src/ChatView/__tests__/packet-panel.test.ts packages/ui/src/LoadRecovery/__tests__/recovery.test.ts packages/ui/src/Decisions/__tests__/helpers.test.ts`
4. `bunx vitest run packages/ui/test/inbox.test.ts packages/ui/test/job-edit.test.ts packages/ui/test/lazy-development.test.ts packages/ui/test/load-recovery.test.ts packages/ui/test/board-layout.test.ts packages/ui/test/browser-native-job-panel.test.ts`
5. Optional proof for P7: temporarily revert only `lib/retryable-lazy.ts` and confirm `lazy-development.test.ts` fails, then restore.
6. Native or 390px visual check of the Decisions footer in the pending, manual and agent states, the sidebar job rows at 1280px, and the Browser button closed vs open.
7. Then the full `bun run check` and the separate final Opus/Grok re-review.
