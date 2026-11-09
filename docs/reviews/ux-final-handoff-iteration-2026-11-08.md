# Handoff iteration: UX-21–23 (Claude Opus 5.5), 8 November 2026

Implementation sub-agent note for the parent. It covers only UX-21 (duplicate export primary), UX-22 (stage 5 after approval and export) and UX-23 (the job-details primary at the handoff). These map to findings F1–F3 in `ux-final-opus-2026-11-08.md`. No score is claimed. Nothing here was checked in the native app or a browser; the parent owns that verification.

## Changes

### UX-21: one primary export request (and the confirm-brief duplicate)

- `components/CardDetails/components/ExportRequest.tsx` now takes `footer: boolean`. While the footer offers the same request, the inline button is not rendered and the helper line adds "Request export approval below when these choices are right." In any other case (for example the footer shows Cancel run or Review brief) a quiet outline button stays. Its `disabled`/`aria-busy` and `choices.request` are unchanged.
- `ApplicationSectionContent.tsx` sets `footer` from `jobNextAction(model).perform === model.exportChoices.request`. That is an identity check on the shared `useExportChoices` request from the same render, so it is true only when the footer requests exactly the visible format and layout.
- `useExportChoices` is untouched: the ref guard, retaining the picked format/layout after failure, and the payload all stay as they were.
- `ApplicationBriefReview/components/ConfirmBrief.tsx`: the inline "Confirm complete brief and requirements" is now `variant="outline"`. The footer's Confirm brief (same `confirm`, same blocker and `aria-describedby` hint) is the surface's one primary.

### UX-22: stage 5 follows the actual packet stage

- `ClayInterface/packet-guidance.ts`:
  - New `cardPacketStage(card, approvals)` returns the stage of the newest approval that still passes `packetNeedsAction`, using the existing `packetStage`. It returns undefined for an agreed packet or a stale approval.
  - New `packetWaitsOnUser` makes agent preparation the user's move only when its delivery is paused, failed or waiting.
- `ClayInterface/signals.ts`: new `decisionWaits` and `jobAsks` helpers. Attention eligibility and the decision list are unchanged.
- `ClayInterface/helpers.ts`:
  - `stepLabel(state, index, stage?, short?)` names the current approval step by stage. Full names: You approve / Choose how to apply / Ready to apply / Agent preparing / Verify submission. Short names in the labelled track row: You approve / Approved / Ready to apply / Preparing / Verify.
  - New `currentStageTone` is the single current-bead rule. Asked means ochre; live means plum. At rest the approval step is ochre, except during agent preparation, when it is neutral.
  - Six stages and the Screening/Interviewing/Offer labels are unchanged.
- `StageTrack` takes an optional `stage` and uses both helpers, for the screen-reader "Stage 5 of 6: …" text and the visible labels. All three callers pass the same derived stage and `jobAsks`: Board `ClayJobCard`, job details `JobProgress` and chat `ChatStageTrack`. The chat current label and bead now use `currentStageTone` too. Before this, chat showed a neutral bead at rest on the approval step while the track showed ochre.
- `ClayJobCard` no longer forces ochre for every stage-5 card. A preparing agent's run now draws plum instead of ochre.

### UX-23: Continue application in job details

- `components/CardDetails/next-action.ts`, case `apply` (current packet exported):
  - Primary is **Continue application** through `model.openInbox`. It reaches the existing Decisions handoff through `WorkspacePanels`, which I did not change.
  - The hint reads "Files saved on this computer. Nothing has been sent. Apply from Decisions, then record your submission only after you have applied."
  - **Record manual submission** becomes an outline alternate with the same `act` move.
  - While an agent prepares, there is no record alternate, and the hint says nothing is submitted until the user approves the final click.
- Case `approve` with an approved, unexported packet now reads Continue application, with the hint "Packet approved. Choose how to apply in Decisions." A pending packet keeps Open in Decisions. Uncertain submissions still resolve first to Verify submission.
- No tracking, navigation, permission, queue, backend or gate changes.

## Not done

- **Phone Needs-you "Nothing has been sent" line (P2).** I did not get to it in this round. `DeckEvidence` is still hidden on phones. The parent should decide whether to assign it.
- **Board column summary beads and sidebar job rows** (`columnBeads`, `stateTone`/`jobBeadTone`) still draw every stage-5 job ochre, and still treat a preparing packet decision as "asks". They are not StageTrack callers, so I left them alone. The same applies to `nextUp`, which still says "Waiting on you: Check on the … application" during an agent handoff. If the reviewers want strict agreement with the track, `jobAsks`/`decisionWaits` can be reused there.

## Out-of-scope fix flagged

- `ClayInterface/__tests__/next-up.test.ts` (untracked, someone else's) expected "Writer revises the packet" for a packetless `changes_requested` job. That contradicts the deliberate `lib/job-step.ts` rule from UX-18. I changed it to expect "drafts" when there is no packet and added a packet-bearing "revises" case. The parent's full check would otherwise fail on it.

## Tests and checks

- New `ClayInterface/__tests__/stage-track.test.ts` (10 tests) covers:
  - the full and short labels and SR text for pending, approved, manual export, agent and uncertain packets;
  - six beads with Screening after submission;
  - the agreed and stale fallback to You approve, and newest-approval selection;
  - bead tone (ochre for the user's move, neutral or plum while preparing, ochre when preparation is paused);
  - agreement between the job-details and chat track markup;
  - the footer's Continue application, with recording only as an alternate (calling `act` only on that alternate) and none while preparing;
  - approved / pending / uncertain footer labels;
  - the inline export button being absent when the footer requests, and outline (never `button primary`) otherwise.
- `components/CardDetails/__tests__/next-action.test.ts`: the fixture gains `approvals: []`, and the exported expectation is now Continue application with a Record manual submission alternate.
- `bunx vitest run --maxWorkers 1` over `ClayInterface`, `CardDetails`, `ApplicationBriefReview`, `Decisions` and `InboxView`: 20 files, 98 tests passed.
- `tsc --noEmit -p .` passed. `oxlint --deny-warnings` passed on the touched folders. `oxfmt --check` passed. `scripts/check-components.ts` passed.
- No browser suites, full builds or full checks were run.
