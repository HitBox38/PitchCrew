# Phone polish: parent review iteration (2026-11-08)

Three corrections requested by the parent review of the phone-polish patch. No other product files changed.

## 1. `retryable-lazy.ts` type error

The root typecheck failed at `use(load())`: the attempt type `Promise<void> & { status?: 'pending' | 'fulfilled'; value?: undefined }` does not match React's discriminated `Usable` thenable union, because `status` was an optional union rather than a single discriminant.

The attempt is now typed as a plain `Promise<void>`. After it settles, `Object.assign(loading, { status: 'fulfilled' as const, value: undefined })` adds React's fulfilled-thenable fields at runtime, so `use()` still returns synchronously on later renders. No `ts-ignore` or `any`. Unchanged: one stable promise per attempt that never rejects, failures stored and thrown at render, `retryFailedLoads()` resets, `preload`, no automatic reload.

## 2. Job details header controls

Edit job, Open job posting and Close dialog in `CardDetails/components/JobSummary.tsx` now use the shared `Button` `variant="ghost" size="icon-sm"` (32px) in place of the legacy `className="icon-button"` (26px, where the `::after` hit extension overlapped the next button across the 4px gap). The global coarse-pointer 44px floor still applies. Accessible names, the Edit tooltip and disabled reason, handlers and `nativeButton={false}` on the posting link are unchanged. `.icon-button` is not changed globally.

## 3. `VerdictNotes` collapsible state

`InboxView/components/VerdictNotes.tsx` passed `defaultOpen={!useIsMobile()}`, so a viewport change altered an uncontrolled default (a possible Base UI warning) and a phone could keep the wrong first state. The collapsible is now controlled from its first render: `open={chosen ?? !mobile}` with `onOpenChange` storing the user's choice (`chosen` starts as `null`). The default follows the viewport until the user opens or closes the notes, and then keeps their choice. There is no effect and no flash. Hooks run before the early return. The trigger, aria and content are unchanged.

## Not changed

Escape in the Packet split view (optional) stays out of scope: the split is nonmodal with a reachable close button, and AGENTS.md reserves Escape for the expanded browser.

## Checks

- `npx bun@1.4.4 run typecheck`: passed (root and landing).
- `npx bun@1.4.4 run lint`: passed (Oxlint plus the component line-limit and disclosure checks, 1134 files).
- `bun run test` on `LoadRecovery/__tests__/recovery.test.ts`, `test/load-recovery.test.ts`, `test/lazy-development.test.ts`, `test/inbox.test.ts` and `test/job-details.test.ts`: 5 files, 25 tests passed.
- No live 32/44px hit measurement or viewport-resize console check was done in this iteration; the parent will measure.

## Parent acceptance

Parent inspected the actual final source and checked the running app in an owned browser tab. At actual 1280×720 all three job-header controls are 32×32; at 390×844 they are 44×44, without relying on the overlapping legacy pseudo-element margins. Reviewer notes default open on desktop and closed on phone; explicitly opening them on phone survives a desktop-and-back resize. No console warning appeared during this sequence. The tab is closed. Native Add job also focuses the URL field: a test character entered there without selecting a field, Escape closed the dialog and focus returned to Add job, with the board still at four jobs. Nothing was fetched or saved.

The parent accepts this correction. Repository format check passes after formatting the second Grok review note. Subsequent independent third-pass reviews pass at Opus 5.5 9.0/10 and Grok 9.1/10, both with no unresolved material flow issue. Final source is frozen for the complete repository check; its result is recorded in the journey's current verification summary.
