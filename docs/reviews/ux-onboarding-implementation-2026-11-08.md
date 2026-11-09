# Onboarding UX fixes — implementation notes (2026-11-08)

Scope: UX-14 and UX-15 from [ux-journey-2026-11-08.md](ux-journey-2026-11-08.md). Only `packages/ui/src/Onboarding/` changed.

## UX-14 — Introduction underexplains provider data flow

- `components/ApprovalIntroduction.tsx`: the local-data line now reads “Your profile, board and drafts are saved on this device. When an agent works, the context it needs for that task goes to the AI runtime you chose for it.”
- Same caption style and position; no warning, consent gate or extra step.
- Tests: copy-only; no existing test asserts the old wording. Native rendering not rechecked here.

## UX-15 — Demo readiness looks like real crew readiness

- `helpers.ts`: new `scriptedSeats(data)` returns ready seats whose only ready agents use the `demo` runtime. `setupProgress` and `missingSeats` are unchanged, so production behaviour stays as before (paused or unavailable Demo roles are not ready).
- `components/SetupChecklist.tsx`: when the crew passes only through Demo, the row says “Scripted examples only: Scout, Writer, Reviewer use Demo, with no AI. Choose a real runtime in Crew.” instead of “Scout, Writer and Reviewer are ready.” Mixed crews name only the scripted seats.
- `components/SetupItem.tsx`: optional `status` replaces the announced “Complete” with “Ready as scripted examples”.
- The row still counts toward “3 of 3 ready”, so Finish setup / Set up later and saved onboarding choices work as before.
- Tests (`__tests__/helpers.test.ts`): all-Demo crew → ready, all three seats scripted; real crew → none scripted; mixed crew → only the Demo-only seats; paused + unavailable Demo (production shape) → not ready, all seats missing, none scripted.

## Verification

- `bun run vitest run packages/ui/src/Onboarding`: 5/5 passed (Bun 1.4.4 via npx).
- Oxlint and Oxfmt `--check` on `packages/ui/src/Onboarding`: clean.
- `tsc -p packages/ui`: no Onboarding errors (one unrelated error in `src/lib/__tests__/job-step.test.ts`, which belongs to another task).
- No screenshots or native UI check yet.

## Parent review

- Rechecked introduction page 2 and the Board checklist through native Computer Use. Provider-context copy fits the dialog, and the longer Demo explanation wraps inside the narrow Board setup card without clipping.
- Tightened the data-flow sentence to name the runtime and AI provider explicitly; removed “Scripted examples only” because named Demo seats can coexist with real agents in a mixed crew.
- Corrected the browser-approval explanation to reflect configurable browser permissions while keeping final application submission approval explicit.
- Readiness logic accepted. Existing tests cover Demo, real, mixed and unavailable/paused production roles. The completion bead still signifies a usable example setup; no new readiness gate was introduced.
- UX-14 and UX-15 accepted for this group, subject to final independent review and broader responsive checks.
