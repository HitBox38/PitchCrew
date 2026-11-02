# Delegation rounds

Agreed design for a lead agent assigning subtasks to several crew agents at once and receiving every result in one turn. Terms are defined in [CONTEXT.md](../CONTEXT.md): delegation round, delegate result, collection turn. Implemented on 2026-11-02; [ADR 0004](adr/0004-delegation-rounds-share-the-lead-slot.md) records the scheduling decision.

## Why

Agents in one standalone group already run at the same time after an unaddressed user message. What is missing is coordination: a lead cannot ask three agents for separate work and get all three answers together. Today each `pitchcrew_invoke_agent` call is an independent follow-up, follow-ups on a job run one at a time because any run on the card blocks the next, and a delegate's reply never wakes the lead. Three delegations plus three replies exhaust the six-follow-up budget before the lead can synthesize.

## Agreed scope

- A **delegation round** has one lead, one to four unique delegates, one subtask per delegate and one collection turn. The lead cannot be its own delegate.
- Rounds exist in ordinary chat turns only: job chats, standalone conversations and routine occurrences. Workflow-stage runs (fit, draft, review) and deep-review participants cannot start rounds.
- Delegates run **chat turns only**, with their normal scoped tools. Workflow stages stay ordinary serialized follow-ups. On a job, delegates may run at the same time because none of them writes the packet; job-detail corrections keep failing closed while another card run is active.
- **No nesting.** A delegate's scoped MCP omits `pitchcrew_invoke_agent`, `pitchcrew_message_agent`, `pitchcrew_create_group`, `pitchcrew_invite_agent` and the round tool. Delegates keep `pitchcrew_ask_user`, progress reporting, memory and their other granted tools.

## Starting a round

**Agent-initiated.** `pitchcrew_delegate_round` accepts one to four `{ roleId, content, conversationId? }` entries and requires `invokeAgents`, like `pitchcrew_invoke_agent`. The round starts after the lead's current run completes, so the lead can tell the user whom it asked. The call rejects the whole round, naming the delegate, when any entry is a duplicate, the lead itself, a paused or retired role, a runtime that is unavailable, or a conversation the lead may not post in. Each subtask is saved as a lead message in the lead↔delegate agent DM (or the named group), exactly as `pitchcrew_invoke_agent` does today. Rounds are not exposed to the external MCP bridge.

**User-initiated.** `/delegate` in the composer opens a picker for one to four enabled crew agents, not limited to current members. The composer text becomes every delegate's subtask. The conversation's lead (the sole agent in a DM) collects. The user-initiated round is the initiating request; its collection turn is the chain's first follow-up.

## Budget and capacity

- An agent-initiated round, including its collection turn, costs **one** follow-up of the chain's six. A lead may run several rounds in one chain.
- A round keeps its job or standalone lane's single workspace slot. Delegates run under it and are bounded only by the four-per-round cap, matching deep review's concurrent child allowance. Delegates are counted as executing agents on the Queue page; the slot count does not change.
- Every delegate and the collection turn is an ordinary run with its own fixed 30-minute limit. There is no shared clock and no extension tool.
- Permissions are rechecked at dispatch as for other follow-ups. A delegate whose role or runtime became unavailable after creation settles as a failed delegate result.

## Settlement and collection

- The round settles when every delegate is completed, failed or cancelled. A failed delegate does not pause the queue; it arrives as a failed result with its reason.
- A delegate's `pitchcrew_ask_user` question holds the round, and the lane, until answered, under the existing question rules. The remaining delegates keep running or finish; the collection waits.
- The collection turn is a fresh lead run in the conversation where the round was requested, resuming the lead's native session where supported. Its prompt carries, per delegate: display name, status, the final reply text up to a fixed bound with visible truncation, the failure reason if any, and the DM or group conversation ID for `pitchcrew_read_conversation`. It is not saved as a user message.
- The lead's collection reply is an ordinary agent message in that conversation. Delegate results do not become lead memory, verified Profile evidence or packet evidence.

## Stop and recovery

- Stopping one delegate, from its DM or the queue card, cancels only that run. It arrives as a cancelled result and the round still settles.
- Stop on the originating conversation or job cancels every delegate and the collection and pauses the queue as today. Resume does not replay cancelled delegates.
- Removing a delegate from a group, retiring it or pausing its role cancels its delegate run under existing rules; the result is recorded as cancelled or failed.
- After a daemon restart, unstarted delegates stay queued and started ones follow the existing interrupted-follow-up recovery. The collection turn never runs before every delegate has settled.

## Visibility

- Each subtask and reply lives in the existing lead↔delegate DM or named group. No new conversation kind.
- The originating conversation's Crew work shows one **round card**: lead, one bead per delegate (plum running, primary completed, rose failed, empty socket queued or cancelled), each linking to its DM and exact run, and the collection state. The lead's turn trace shows a "Started a delegation round" step naming the delegates; the collection turn is labelled as collecting results.
- The Queue page and slot tray show delegates as executing agents under the lane's single running card, with readable states and the existing per-request recovery controls.
- Activity records the round start, each delegate result and the collection as attributed events with one product sentence each.

## Persistence

Event version 34 adds a `delegation_round` entity (lead, initiator, chain root, lead run or anchoring request, delegate task IDs with their DM threads, collection task ID, status) and optional `roundId` and `roundPart` (`delegate` or `collection`) fields on tasks. Versions 1–33 remain decodable. Crew follow-up limit checks count a round as one entry (`chainFollowUpCount` in core). Rounds live in SQLite entities, so snapshot revision covers them, and snapshots expose them as `delegationRounds`.

## Implementation notes

- `packages/orchestrator/src/crew/delegation-rounds.ts` validates and saves a round with its tasks in one transaction, decides task readiness (`taskParentReady`), builds the collection prompt, recomputes round status and lists open round roots so Stop reaches user-started rounds.
- `tasks.ts` lets delegates of one round share a job while blocking other work on that card, fills the collection task's prompt just before launch and never pauses the queue for a failed delegate.
- The gateway reports `delegate: true` from `execution_access`, the MCP CLI then omits delegation, grouping and deep-review tools, and the gateway rejects those actions regardless.
- User-initiated rounds are a chat request with empty deliveries and a `roundId`; its tasks use the request ID as parent anchor and the user's authority replaces the originating-role permission check.
- The shared chat prompt explains rounds to leads, tells delegates their boundaries and tells the collection turn what it received.

## Prompting

The shared runtime prompt for chat turns describes rounds, their one-follow-up cost, the four-delegate cap, the no-nesting rule and that delegates should not be asked to edit the packet. Default role instructions are unchanged, so no instruction update notice is produced.

## Verification

Deterministic orchestrator HTTP/MCP tests cover: concurrent delegates on one job holding one slot, rejection cases at creation, settlement with mixed completed/failed/cancelled delegates, question hold and continuation, per-delegate and lane-level Stop, restart recovery, budget accounting and the absence of delegation tools in delegate MCP configurations. UI tests cover the round card, queue representation and the `/delegate` picker with the Demo fixture. No live provider run is included.
