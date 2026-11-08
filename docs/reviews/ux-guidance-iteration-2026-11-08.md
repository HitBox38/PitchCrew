# UX guidance iteration — 2026-11-08

Focused follow-up to the parent review of [UX-01](ux-journey-2026-11-08.md) and the snapshot form check. No UX score is claimed here; the parent rechecks.

## Parent feedback and how it was addressed

### UX-01 rejected: an extracted, unconfirmed lead was held on brief confirmation

Observed: a lead imported through Fetch from link, extracted but unconfirmed, then scored 60/100, still showed **Confirm brief** in the board's Needs you deck and **Review brief** as the primary footer action.

Change:

- `ClayInterface/signals.ts`: `needsBrief` skips `lead` cards. An unconfirmed lead brief is no longer a decision, so the Needs you deck, Decisions page and count, job signals, card line, column beads and `nextUp` stop asking for it. A shortlisted (or later, not closed) job with an unconfirmed brief is still a decision.
- `lib/job-step.ts`: `jobStep` for a lead with a brief returns `evaluate-fit` when fit is absent and `shortlist` once a score exists, including 0, whether or not the brief is confirmed. After the lead stage the order is unchanged: form, brief, brief confirmation, then answers come before drafting.
- `components/CardDetails/next-action.ts`: the lead-only branch of `confirm-brief` is removed because that step is never reached for leads. If a lead's brief is unconfirmed, **Evaluate fit** and **Shortlist** add a **Review brief** alternate, and the Shortlist hint adds "You confirm the brief before drafting." Evaluate again and manual Shortlist work as before. The parent's `brief.editing` → `brief.confirm()` footer and its test are unchanged.

No backend gate, permission or route changed. Drafting still requires the confirmed brief through the existing daemon checks.

### Snapshot form check treated every inspected form as current

`snapshotStepFacts` now uses `formIsCurrent(card)` in `lib/job-step.ts`. It compares the adopted inspected form with the latest assessment's requirement metadata: URL, field label, type, required, visible, disabled, accept, options, maxLength, assessed, condition, blockers and uninspected, plus the "No application controls" placeholder. `missingAnswer` is ignored. It does no hashing and no fetch, and it adds no snapshot metadata. Source mutations still clear the context and assessments in `recordJobSourceChange`.

Objection: the parent asked me to import `applicationFormIsCurrent` from `@pitchcrew/core`. The UI cannot do that at runtime. `.oxlintrc.json` allows only type imports from `@pitchcrew/core` in `packages/ui/src`, and `application-form.ts` uses zod (`applicationFormSchema.parse`), which the lint rule keeps out of the bundle. I could not add a zod-free core export because core is outside this iteration's ownership. So `formIsCurrent` copies the core rules without zod. The job-step test imports the core helper through a relative path, for the test only, and asserts both helpers agree on every fixture. A later change could move the core comparison into a zod-free subpath export and delete the copy.

## Tests added or updated

- `lib/__tests__/job-step.test.ts`: covers unconfirmed leads with no score, 0 and 60. It checks that changed required, maxLength and label values, an added field and a new blocker all need confirmation, which returns a shortlisted job to `confirm-brief`. Identical newer inspections, browser-only differences and answer-only progress stay current. An adopted inspection with no assessment is not current. Each case is checked against core's `applicationFormIsCurrent`.
- `ClayInterface/__tests__/next-up.test.ts`: for unconfirmed leads with no score, 0 and 60, `decisions()` is empty, `jobSignals` has no entry and `nextUp` names fit, then shortlisting. Once the job is shortlisted, the brief decision is back.
- `ClayInterface/__tests__/signals.test.ts`: a lead's unconfirmed brief is excluded from decisions, and a shortlisted one is included.
- `components/CardDetails/__tests__/next-action.test.ts`: an unconfirmed lead gets Evaluate fit (no score) or Shortlist (0 and 60) as the primary action, with Evaluate again and Review brief alternates. A shortlisted job with an unconfirmed brief gets Review brief as its primary action.

## Evidence

- Focused: job-step, ClayInterface and CardDetails tests: 10 files, 57 tests passed.
- `vitest run packages/ui/src packages/ui/test/application-form.test.ts`: 147 files, 773 tests passed.
- `bun run typecheck` and `bun run lint` pass (Bun 1.4.4 via `npx --yes bun@1.4.4`).
- `oxfmt --check .` reports only `docs/reviews/ux-brief-implementation-2026-11-08.md`. That file belongs to another group and I did not touch it.

## Files changed

- `packages/ui/src/lib/job-step.ts`
- `packages/ui/src/lib/__tests__/job-step.test.ts`
- `packages/ui/src/ClayInterface/signals.ts`
- `packages/ui/src/ClayInterface/__tests__/signals.test.ts`
- `packages/ui/src/ClayInterface/__tests__/next-up.test.ts`
- `packages/ui/src/components/CardDetails/next-action.ts`
- `packages/ui/src/components/CardDetails/__tests__/next-action.test.ts`
- `docs/reviews/ux-guidance-iteration-2026-11-08.md`

## Left for the parent

Parent native recheck: the same Anthropic lead at 60/100 now has **Next: you decide whether to shortlist**, primary **Shortlist**, and secondary Evaluate again / Review brief. Its unconfirmed brief no longer fills the board's Needs you deck. UX-01 passes this previously failing native case. The form-currentness comparison was reviewed against the core helper and parity tests; its zod-free copy is a maintenance limitation to consider in final code review.

- Native recheck of the Anthropic lead scenario. Not run here: no live app run in this iteration.
- Unconfirmed lead briefs no longer appear in the Decisions page or its sidebar badge. That is intended: they come back as a decision once the job is shortlisted.
