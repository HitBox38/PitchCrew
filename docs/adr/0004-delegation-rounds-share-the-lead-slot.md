---
status: accepted
---

# Schedule delegation rounds as one unit of the lead's work

Design decision accepted on 2026-11-02. A lead agent could already run several follow-ups, but on a job they ran one at a time, each cost one of the chain's six follow-ups, and nothing returned the results to the lead together. A delegation round assigns one to four chat-only subtasks at once, lets those delegates run concurrently under the lane's single workspace slot, and wakes the lead once with every delegate result. The whole round, including that collection turn, costs one follow-up.

We considered charging one follow-up per delegate, which kept the arithmetic obvious but made a four-agent round plus its collection consume most of a chain. We considered giving each delegate its own workspace slot, which would have capped machine load at the configured limit but let a round stall behind unrelated jobs while its lane held a slot, and would have contradicted the existing rule that several runs in one queue use one slot. We considered allowing workflow-stage delegates, which would have reopened the per-job packet conflicts that [schedule work by job](0002-schedule-work-by-job.md) prevents. Chat-only delegates keep packet writes serialized while still letting research, inspection and connector reads happen in parallel.

Delegates cannot delegate, message or invite, so a round is bounded by its cap rather than by trust in prompts. A round settles when every delegate has completed, failed or been cancelled; failures arrive as results rather than pausing the queue, because the lead is the party that decides what a missing perspective means. See [delegation rounds](../delegation-rounds.md) for the agreed behavior.
