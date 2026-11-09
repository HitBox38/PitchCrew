# UX-16 export footer iteration (2026-11-08)

Implementation by Claude Opus 5.5 for parent review. No UX score is claimed here.

## Problem

On a reviewed (`agreed`) job, the persistent footer said **Prepare export** and only opened or refocused the Export section. The real next step, **Request export approval**, existed only inline, so the footer repeated the brief's earlier navigation-only problem.

## Change

- New `packages/ui/src/components/CardDetails/hooks/useExportChoices.ts` holds the export format, layout and request state for the whole job details model. The format follows `suggestedExportFormat(card)` until the user picks one (`null` means "use the suggestion"), so a changed inspected form still updates the suggestion until a deliberate choice is made. `request()` sends the existing `POST /cards/:id/approval` with `{ formats: exportFormats(format), layout }` and the same success toast. A ref guards against duplicate requests from either button or a double click. `requesting` stays true until the promise settles. Choices are never reset, so they survive a failed request.
- `useCardDetails.ts` gets two exact additions: the import, and `exportChoices` in the model. The brief's `editing` footer integration is untouched.
- `ExportRequest.tsx` renders from the shared choices. Both selects and the button are disabled while the job is busy or the request is in flight, and the button sets `aria-busy`. The suggestion label `(suggested)`, the suggestion reason (including `acceptsFile` caveats) and the "Markdown copies are always included … Nothing is sent." copy are unchanged.
- `next-action.ts`, `export` step: when `tab === 'application'` and `sections` includes `export`, the footer becomes **Request export approval** and calls the same `exportChoices.request`. It is disabled while requesting or busy. Its hint names the visible choice, for example "Word (.docx), formatted, plus Markdown copies. You approve the exact files in Decisions. Nothing is sent." Markdown only reads "Markdown copies only. …". Before the section is open, the footer is still **Prepare export** and only navigates.
- The store's synchronous pending action still handles the in-flight state. The footer shows **Preparing and checking documents…** with a spinner from the earlier `work.pending` branch.

No new routes, approval paths, capabilities or provider loops. The server payload shape and every approval, review and export gate are unchanged.

## Tests

- New `packages/ui/src/components/CardDetails/__tests__/export-footer.test.ts` runs the real `useExportChoices` hook through a minimal call-order hook stub (the repo has no React testing library) together with the real `jobNextAction`:
  - Before the section is open, and when other sections are open, the footer is still **Prepare export** and only opens `export`, with no request.
  - After choosing Word, the footer requests `{ formats: ['docx'], layout: 'formatted' }` instead of the suggested PDF. Two `perform()` calls send one request, and the footer stays disabled until the request settles.
  - PDF and Word with plain layout sends `['pdf','docx']` and `plain`. Markdown only sends `[]`, and its hint says so.
  - A rejected request keeps Word/formatted, clears `requesting` and allows a retry. A busy model disables the footer.
- Commands (pinned Bun via `npx --yes bun@1.4.4`):
  - `bun x vitest run packages/ui/src/components/CardDetails/__tests__`: 4 files, 29/29 passed.
  - `bun run typecheck`: passed (root and landing).
  - `bun run lint`: passed, including component line limits (ExportRequest 59 lines).
  - `bun x oxfmt` on the changed files: applied.
- No browser suites were run, to avoid overlapping the parent's full `check`. No browser test references "Prepare export" or "Request export approval" by name.

## Limitations and objections

- While the Export section is open, two visible buttons are named **Request export approval**: the inline one and the footer. Both call one guarded action, matching the parent's pattern for **Confirm brief**. Any future Playwright selector needs to scope to the footer or the section.
- The duplicate-request guard is per job details mount. A second open job sheet for the same card could still send its own request. The store's pending action and server checks still apply.
- The hook test uses a stub for React state, not a DOM render. Parent should still check natively that choosing Word in the section changes the footer hint, and that both controls lock during preparation.
- Export choices now live in the job details model. Collapsing and reopening the Export section keeps the user's choice, which is intended. Closing job details resets it.
