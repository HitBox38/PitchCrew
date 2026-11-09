# UX-17 post-export guidance iteration (2026-11-08)

Implementation by Claude Opus 5.5 for parent review. No UX score is claimed here.

## Problem

After **Export to apply myself**, Decisions correctly said Apply / Ready for you to submit, but the Board still read as an unapproved packet: the Needs you card said **Approve the … packet?**, the job card and sidebar said **Approve packet**, and the stage line said "Waiting on you: Approve the … packet?". The underlying state was right (the card stays `awaiting_approval` until the user records the submission, and `packetNeedsAction` keeps the current consumed packet in attention). Only the wording was stale, because `jobStatus`, `decisionTitle`, `decisionSource` and the `signals.ts` packet detail hardcoded approval copy for every packet decision.

## Change

- New `packages/ui/src/ClayInterface/packet-guidance.ts` derives one `PacketStage` from the approval and its card, after eligibility has already been decided:
  - `approve`: approval `pending`.
  - `verify`: a submission attempt for this approval is `uncertain`.
  - `apply`: `submission.method === 'manual'`, approval `consumed` and an `exportDirectory` is present. The daemon records the manual choice only after verifying the exported files. Anything less falls back to `choose`.
  - `preparing`: `submission.method === 'agent'`.
  - `choose`: approved, or consumed without a recorded method.
- `signals.ts` `decisions()` adds optional `stage` and `status` to packet decisions and words `detail` from the stage. The filter is still `packetNeedsAction(approval, data.cards)`, unchanged, so counts, ordering and eligibility do not change. Brief, browser and question decisions are built exactly as before.
- Wording, shared by every surface through the existing functions:

  | Stage     | Job card / sidebar (`jobStatus`, `cardLine`)                                                  | Deck, peek, stage line (`decisionTitle`) | Deck source (`decisionSource`) | Deck action          |
  | --------- | --------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------ | -------------------- |
  | approve   | Approve packet                                                                                | Approve the X packet?                    | Reviewer agreed                | Review               |
  | choose    | Choose how to apply                                                                           | Choose how to apply to X                 | You approved                   | Continue application |
  | apply     | Ready to apply                                                                                | Apply to X, then record it               | You exported the files         | Continue application |
  | preparing | Decisions' delivery label (Preparation queued, Agent preparing, Preparation needs attention…) | Check on the X application               | Handed to {agent}              | Continue application |
  | verify    | Verify submission                                                                             | Did the X application go through?        | Submission uncertain           | Check submission     |

  The `apply` detail reads "Files saved on this computer. Nothing has been sent. Apply on the posting, then record it." The `preparing` detail says nothing is submitted until the user approves the final click. It does not claim the agent is still working: preparation status comes from Decisions' own `requestStatus`, which is reused rather than copied.

- `DeckActions.tsx`: same `/inbox?decision=<id>` link. Only the label follows the stage.
- `DeckEvidence.tsx`: approved and handed-off packets show the stage detail above the existing frozen files and Reviewer highlights.
- `Decisions/components/DecisionHeading.tsx`: the hardcoded `Apply to ${company}` for non-pending packets now uses `decisionTitle`, so the sheet heading matches the Board. The trailing `?` is stripped only for the pending approval title, as before. The heading's status chip (`RequestStatus`) is unchanged.
- `jobs.ts` `nextUp`: the rest-state `apply` step now says "you apply, then record your submission".

Not changed: approvals, the submission handoff, permissions, queue/order, attention counts, card states, CardDetails export hook/next action, Onboarding, ApplicationBriefReview, backend and runtimes. Nothing marks a job submitted.

## Tests

- New `packages/ui/src/ClayInterface/__tests__/packet-guidance.test.ts` (8 tests) checks every surface function together:
  - Pending keeps all original approval wording, including the stage line and the Review action.
  - Approved and unexported asks how to apply, with no "Approve" text anywhere.
  - Consumed manual with saved files says apply, then record. It contains neither "Approve" nor "submitted", the detail says nothing has been sent, and the card stays `awaiting_approval`.
  - A manual method without a consumed export stays `choose`.
  - Agent handoff: running reads Agent preparing, failed reads Preparation needs attention, and the source names the agent it was handed to.
  - An uncertain attempt asks to check the submission.
  - Eligibility: for current, stale-packet, closed-card, rejected and mixed approvals, `decisions()` returns exactly the `packetNeedsAction` set.
  - Brief, browser and question titles and statuses are unchanged.
- `packages/ui/test/inbox.test.ts` (browser suite, **not run by me**): after Approve packet, the heading is now `Choose how to apply to Juniper Fixture` instead of `Apply to Juniper Fixture`. After export, it adds a check for `Apply to Juniper Fixture, then record it`. The existing `Ready for you to submit` chip and `awaiting_approval` assertions are unchanged. The `Export to apply myself` line was already in the working tree.
- Commands (pinned Bun via `npx --yes bun@1.4.4`):
  - `bun run test -- packages/ui/src`: 148 files, 784/784 passed (unit only).
  - Focused: ClayInterface, Decisions and InboxView unit tests passed 55/55, and the new file passed 8/8.
  - `bun run typecheck`: passed.
  - `bun run lint`: passed, including component line limits.
  - `bun x oxfmt` on the changed files: applied.

## Limitations and objections

- Browser suites were not run, as requested. The parent should run `packages/ui/test/inbox.test.ts` and any Board deck journey. The Decisions heading wording intentionally changed for approved packets (from "Apply to X" to "Choose how to apply to X"). If the parent prefers the old Decisions heading for `choose`, it is a one-line revert in `DecisionHeading.tsx`.
- A handed-off or exported packet still counts as "Waiting on you" in the stage line and deck, because attention eligibility was kept as instructed. The wording now says what the user actually does (apply then record, check on the preparation, or verify), so it no longer asks for approval again. Whether agent preparation should count as waiting on the user is a separate eligibility question that I did not change.
- The `preparing` card and sidebar status follows the first delivery's status, exactly as Decisions does. It is not verified against live provider runs.
- No native or live check was done for this change. The parent's live UX Recheck Studio flow (approval `cb180fd8-…`) should now show **Ready to apply** on the job card and sidebar, and **Apply to UX Recheck Studio (fictional), then record it** with **Continue application** in Needs you.
- AGENTS.md was not edited. It does not describe the old packet wording, so nothing in it became false.
