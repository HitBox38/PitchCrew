# Writer first-draft result failure — 2026-11-08

## Reproduction (parent, UX18, real Electron)

Fictional job "Live UX Studio" with no URL, a valid confirmed brief, Writer on Claude Code Sonnet (High) and Scout on Codex (fit 92). The first isolated draft failed after 38 seconds; one normal Retry failed after 42 seconds, both with "The runtime did not return a valid structured result. Check its model/sign-in and retry." No packet was saved, the card moved to `changes_requested`, and the stage line read "Next: Writer revises the packet".

The runtime's raw output was discarded, so **the cause of that specific failure is not proven**. Nothing below claims it is.

## Proven contract contradictions

These were real regardless of what the runtime actually returned:

1. **Writer `changes:[]`.** Both writer result examples (`process/prompts.ts`, `process/application-prompts.ts`) ended with `"changes":[]`, but `packetChangeNotesSchema` is `.min(1)` when present. A runtime copying the example literally on a first draft is rejected. `packet-handoff.ts` separately said "Omit changes for a first draft", contradicting the example.
2. **Isolated writer empty documents.** The isolated example used `"resume":""` and `"coverLetter":""`; both are `.min(1)`.
3. **Reviewer summary placeholders.** `reviewSummaryShape` used `"assessment":""` and `"nextSteps":[""]`, both rejected if copied. It is shown inside the reviewer examples.

## Changes

- `packages/adapters/src/process/packet-handoff.ts`: `writerResultShape(revising)` omits `changes` for a first draft and supplies one non-empty placeholder note for a revision; `writerModeInstructions(revising)` tells the Writer which mode this run is in. `reviewSummaryShape` placeholders are now non-empty. Strict schemas are unchanged.
- `packages/adapters/src/process/prompts.ts`: legacy workflow Writer prompt uses the shared shape, revising when `card.packet` exists.
- `packages/adapters/src/process/application-prompts.ts`: isolated Writer prompt uses the shared shape, revising only when `draftingCard` keeps a packet (same adopted brief revision); a packet from an older brief is a first draft, as the drafting card already treats it.
- `packages/adapters/src/process/results.ts`: `parseWorkflowResult` now distinguishes `missing` (empty or empty-fence output), `invalid_json`, `schema` (with up to four dotted field paths from an allowlist of Pitchcrew's own result field names; array indexes, invented keys, values and Zod messages are dropped) and `wrong_role` (a recognizable other seat). Messages keep the "did not return a valid structured result" prefix, code `PITCHCREW_RUNTIME_RESULT_INVALID` (still `validation` in failure categories) and add `resultProblem`/`fields` properties locally. The "Check its model/sign-in" advice was removed because none of these categories is evidence of a sign-in or model problem. `parseResult` is unchanged for existing callers.
- `packages/ui/src/lib/job-step.ts`: `changes_requested` with no packet is `draft`, not `revise`, so the stage line reads "Writer drafts the packet". Gates, states and the queue are unchanged; the draft action was already the same button.
- `packages/ui/src/components/CardDetails/next-action.ts`: in that case the footer hint says "No packet has been saved yet. This drafts the first packet." (only when no launch blocker hint applies).

## Tests

- New `packages/adapters/test/workflow-result-contract.test.ts`: every workflow prompt variant's literal JSON example (legacy and isolated Writer first draft/revision, Reviewer, isolated review, Scout fit, packet evaluation) passes `runResultSchema`; first drafts omit `changes` and say so, revisions carry non-empty notes; stale-brief packets draft fresh; the schema still rejects `[]` and blank notes; diagnostics classify missing/invalid JSON/non-object/wrong role/schema, name known fields only, cap them, and never echo private text, values, indexes or "sign-in"/"model".
- `packages/ui/src/lib/__tests__/job-step.test.ts`: `changes_requested` with packet → `revise`, without → `draft`.
- `packages/ui/src/components/CardDetails/__tests__/next-action.test.ts`: footer hint for the failed-first-draft case and none for revisions.
- `packages/orchestrator/test/runtime-failure-diagnostics.test.ts`: expects the stable message prefix instead of the removed sign-in wording; privacy assertions unchanged.

## Objections and open items

- The fix removes three proven ways to fail; it does not prove the UX18 run failed for one of them. If the retry still fails, the new message will at least say whether the answer was missing, not JSON, the wrong seat, or which known field was invalid.
- Claude Code's extractor (`claude-code/index.ts`) returns any `result` string and ignores `is_error`, `subtype` and `structured_output`. An error terminal with prose text would now read "final answer was not valid JSON". Native `--json-schema` transport and terminal error handling were left out: they need the full success/missing/is_error/subtype/multiple-terminal matrix and were not clearly needed for the proven contradiction.
- Parent follow-up closed the related deep-review example gap: its skeleton now includes the required seven original perspectives, or the single assigned specialist perspective, with schema-valid placeholders. Two contract cases cover both sets; all 27 contract/privacy tests pass. This validates the prompt shape, not a live seven-perspective review.
- `ClayInterface/jobs.ts` `cardLine` (owned by another worker) still shows "Changes requested · Writer next" on the board card for the failed-first-draft case; it is truthful about state, but could say "No packet yet".

## Parent native review

After restarting the isolated scratch daemon, the same saved real Writer configuration completed one native Retry in 41 seconds and saved the first packet. The failed queue cleared and the next step became Reviewer review. Real Codex Reviewer then passed in 48 seconds with explicit limitations. Selecting Word in job details changed the persistent footer hint; its request produced DOCX plus Markdown files in Decisions. Both Word previews rendered readably; exact-file approval, local manual export and synthetic submission/Screening tracking completed through the native UI. The discarded original outputs' exact failure category remains unproven. Parent accepts the observed UX18 correction, subject to independent final review.
