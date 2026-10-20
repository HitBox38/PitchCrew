# Workspace and job queues

Implemented in the shared browser/Electron workspace. See [the scheduling decision](adr/0002-schedule-work-by-job.md) for its architectural rationale.

## Agreed scope

Users can request individual board actions across several jobs, such as evaluating fit on five leads. Each queue entry targets one action on one job. Users can also explicitly queue successive stages within a job, such as **Draft application → Review packet**, before the earlier stage has produced its result.

Use T3 Code's nightly chat queue as the interaction reference.

## Independent job queues

Each job has an independent queue, analogous to independent conversations in T3 Code. The same crew agent can execute separate runs for different jobs concurrently. An agent's identity and runtime configuration do not imply a single execution slot across the workspace.

The collection is the **job queue**; a request for one board action on that job is a **queued board action**.

Board actions and all conversations attached to the same job share one visible execution order. Separate conversation histories remain intact. Ordinary queued requests execute one at a time for that job, preventing conflicting work on its packet; different jobs can execute independently, including through the same crew agent. Crew follow-ups and managed reviews stay within their initiating action as described below.

## Workspace concurrency

The workspace has a user-configurable concurrency limit, defaulting to **5** slots. A slot is used by an active job, standalone conversation, or routine occurrence without a job. Additional eligible work waits for capacity. This limit applies regardless of which crew agents or runtimes execute the work.

Conversations with no attached job each have an independent **standalone conversation queue** and use the same concurrency pool. For example, four active jobs and one active Career Coach conversation use all five default slots. Conversations attached to a job use that job's queue instead of consuming a separate queue slot.

A managed deep resume review occupies one workspace slot across its drafting, review, correction and recheck stages, including temporary review subagents. Child work retains its existing separate concurrency limits. Workspace slots limit active jobs, standalone conversations and background routine occurrences, rather than individual CLI processes. Waiting for user input, failure and explicit Stop retain the queue behavior described elsewhere in this document.

## Waiting for user input

When a job needs a user answer, its queue pauses and the job releases its workspace concurrency slot. Other jobs can continue or start. The remaining requests for the waiting job stay pending until the user answers.

Answering makes the job eligible to resume without interrupting running jobs; it joins the workspace waiting line as described below.

## Workspace queue and scheduling

The **workspace queue** orders eligible job queues and standalone conversation queues waiting for a free slot. By default, the longest-waiting eligible queue gets the next available slot. After an ordinary request finishes, a job or standalone conversation with more queued work rejoins the end of the waiting line. A job becoming eligible after a user answer also joins the waiting line; it does not interrupt running work.

A general workspace queue view lets the user change this order. If jobs A–E are running and F and G are waiting, moving G above F gives G the next available slot. Reordering waiting queues does not interrupt active requests.

The workspace queue orders work between jobs and standalone conversations. Each job queue separately orders the actions and attached chat requests within that job.

The general workspace queue view supports both levels: users reorder waiting jobs and standalone conversations at the top level, then expand an entry to inspect, reorder or remove its pending requests. Running requests are not moved by pending-work reordering. The same inner controls apply to standalone conversation queues.

## Queue page

The general workspace queue view lives on a dedicated **Queue** page in the Workspace sidebar, with a pending count. A shortcut in the board header opens it. **Working now** has a compact heading and a text count of occupied workspace slots; the count opens a bounded capacity-settings popover with a recessed numeric input and an explicit Save limit action. Lowering the limit lets active work finish before new work starts. Background routines appear as a quiet count beneath the running cards.

Independent job and conversation queues appear side by side on softly raised clay cards, with each executing agent's identity and latest public activity. Job cards separate the company from the role title; running state uses a small agent activity dot instead of colored card-top strips or repeated Working labels. Runtime names remain available to screen readers. The card menu offers Pause/Resume queue and Stop current work, while Open stays in the footer beside the request disclosure. Activity links open the exact conversation and run. Managed review seat reservations hold their queue's slot but are excluded from executing-agent counts. Multiple agent runs within one queue still consume only one workspace slot.

**Up next** contains eligible queues in their saved priority order. **On hold** separates paused queues, unanswered questions and prerequisite problems; these queues release their slots. Both groups retain keyboard and drag ordering within their group, and expandable request lists retain editing, removal, recovery and per-job ordering. Running request lists start collapsed; pending lists start expanded. Answer opens the waiting request's conversation.

All queue cards share the same raised clay fill, softly rounded rims and depth in both themes. Pending request lists, pause/block explanations, ordering controls and empty states use recessed surfaces. Section headings use plain counts, and held states use their text label without a colored top strip. The persistent widget trigger uses the same raised clay material.

The toolbar's queue widget remains available throughout the workspace, including when idle. Its compact capacity strip shows the same slot occupancy, alongside the ready count and on-hold count. Its keyboard-accessible popover shows all concurrent visible queues and their individual executing agents, a separate background routine count, held work and a link to the Queue page. The list scrolls within a bounded popover on small screens. It replaces the previous comma-separated running-agent ticker.

Routines without a job remain outside this view as specified below.

## Crew follow-ups

Agent-requested follow-ups needed to complete the current action remain grouped with that action and run before the job's next queued user request. Show them beneath the initiating action, with the existing shared six-follow-up limit retained. For example, corrections requested from Writer by Reviewer finish before the next queued user action begins.

The action is complete for workspace scheduling only after its related follow-up chain finishes. It retains the job's slot while that work is executing; waiting for user input, failure and explicit Stop retain the queue behavior described elsewhere in this document. Existing capability and prerequisite checks still govern each follow-up.

## Failed requests

A failed request pauses only its own job or standalone conversation queue and releases its workspace slot. The remaining requests stay saved. Other queues continue independently.

The failed entry offers **Retry** or **Skip and continue**. Failures are not automatically retried. Continuing after a skip does not waive the remaining requests' prerequisites or existing approval gates.

## Stop and resume

Explicitly stopping current work cancels that work and pauses its job or standalone conversation queue. Pending requests remain saved, and the queue releases its workspace slot. The user must choose **Resume** before it can dispatch more pending work. Other queues continue independently.

**Interrupt and send** cancels only the current job or standalone conversation's active action and its related follow-ups, puts the new message next, and continues the remaining queue after that message's work finishes. It does not stop other jobs using the same crew agent. The replacement begins after the cancelled work has released its resources and a workspace slot is available. Its failure or unmet prerequisites follow the ordinary queue rules.

## Scheduled routines

Routine occurrences attached to a job enter that job's visible queue and follow its ordering, pauses and workspace concurrency rules.

Routines without an attached job stay outside the new queues and the workspace queue view, even when they have a conversation for their history. They remain managed by the existing scheduler, count against the same five-slot default concurrency limit, and wait for capacity before starting.

When a slot opens, eligible visible queued work takes priority over routine occurrences without a job. The scheduler starts those background routines when capacity remains after eligible queued work is served. Already-running routines finish normally. A sustained visible backlog can postpone background routines.

## Successive stages and prerequisites

Users may explicitly add a later-stage action before its prerequisites exist. For example, Review packet can be queued behind Draft application before a packet exists. The review waits for a successful draft, and its prerequisites are checked again before execution.

Required user confirmations and existing approval gates remain in force. If a prerequisite is missing at dispatch, including after a skipped failure or a subsequent job change, only that job's queue pauses and releases its slot. Keep the pending actions and show an actionable explanation, such as **Confirm updated brief**. The queue waits until the prerequisite is resolved.

Reordering must preserve a valid sequence of prerequisites. If no packet exists and a queued Draft application supplies it, dragging Review packet above that draft is rejected: the row animates back to its previous position and the saved order remains unchanged. Explain the unmet prerequisite. Validation accounts for prerequisites that earlier queued actions are expected to produce, allowing the explicitly supported Draft → Review sequence.

The return animation follows the app's reduced-motion policy. A later prerequisite change blocks the affected queue as described above; it does not cause a previously saved valid order to animate back.

## Duplicate board requests

When a board shortcut's identical action for a job is already queued or running, clicking that shortcut again opens the existing queue entry rather than adding a duplicate. The user can request another occurrence after the earlier action finishes. Repeated chat messages remain separate requests.

An explicit **Add action** control supports intentional repeated stages, including **Review → Draft corrections → Review**. The second Review is a distinct pending action, with the same prerequisite checks as any other stage. This distinguishes deliberate sequence construction from accidental repeated shortcut clicks.

## Inputs at execution

Pending actions use the current valid Profile, job context and packet when execution starts, matching existing run behavior. For example, Writer uses Profile edits saved while its action was waiting. Job-context confirmation and all other action prerequisites are rechecked before launch.

Record the input versions actually used when the run starts, so its results can be understood against those inputs. Pending work does not freeze enqueue-time copies of Profile or packet contents. Existing checks on changes during a running action remain in force.

Pending work also follows the current agent settings and applicable conversation overrides at execution, including runtime and model. For example, switching Scout from Codex to Claude changes the runtime used by its waiting work. Running work keeps its recorded configuration. Recheck current permissions before every launch.

## Persistence and restart recovery

Queue requests, their inner and workspace ordering, and pause states persist across reloads and daemon restarts. Previously paused queues remain paused.

After restart, eligible pending requests that never started resume automatically as slots become available. Requests interrupted during execution pause their own queue and require **Retry** or **Skip and continue**. Recovery does not silently repeat an interrupted request or continue its later queued actions. Waiting questions remain waiting for an answer.

## Browser sessions

Parallel jobs using the same agent have independent browser sessions/tabs while sharing that agent's existing saved login profile. Each job can browse independently without requiring a fresh sign-in merely because it is a different job.

Manual takeover applies to the selected job's browser tab. Browser action approvals, inspected forms and submission evidence remain scoped to the appropriate job and run. Shared logins do not merge browsing control or grant approval for another job's actions.

## Implementation and verification

`crew/queue/` owns admission, saved ordering, prerequisites and the compact queue projection. Launch reservations prevent asynchronous setup from overbooking capacity. Conversation dispatch and crew follow-ups share admission, and a follow-up chain keeps its initiating queue's slot until it completes, waits, fails or stops. Native chat continuity remains scoped by conversation and participant; isolated workflow and managed-review runs retain separate directories.

Event version 24 adds `work_queue` and `queue_settings`; existing events remain replayable. Queue HTTP mutations require the same local UI session, client header, Host and Origin checks as other user actions. `GET /api/queue` reads the view, `PUT /api/queue/settings` changes capacity, `POST /api/queue/actions` adds a board action, `PUT /api/queue/:id` controls a queue and `PUT /api/queue/requests/:id/order` changes inner order. Existing chat-request routes retain editing, removal and explicit recovery.

Deterministic HTTP tests exercise same-agent concurrency, job-wide serialization, global priority, questions releasing capacity, scoped Stop/Resume, failed follow-up recovery, prerequisite rejection, duplicates, explicit repeats and restart replay. Headless UI tests cover keyboard ordering, rejected-order rollback, repeated actions, capacity changes, parallel agent runs versus queue slots, reserved seats, background occupancy, ready/on-hold grouping, exact-run activity links, widget keyboard focus and narrow dark/reduced-motion layouts. Browser tests cover one shared persistent login context with independent job pages, manual leases and closure. Automated verification makes no live provider calls.

## Reference behavior

Source inspection of T3 Code nightly `v0.1.1-nightly.20261019.3373`, commit `300a35670abc0f73662e17c9ce909bcc106be70f`, confirms:

- A collapsible list shows queued messages and their count.
- Users can reorder pending messages by dragging a grip or using arrow keys.
- Users can edit or remove pending messages.
- An explicit Steer action promotes a queued message into an active run when supported.
- Delivery order uses saved queue positions, falling back to original order. Automatic delegated completion messages have priority over ordinary queued messages.

Sources: [queue controls](https://github.com/pingdotgg/t3code/blob/300a35670abc0f73662e17c9ce909bcc106be70f/apps/web/src/components/chat/QueuedRunsControl.tsx), [delivery ordering](https://github.com/pingdotgg/t3code/blob/300a35670abc0f73662e17c9ce909bcc106be70f/apps/server/src/orchestration-v2/QueuedRunOrder.ts).

T3's reference queue belongs to a conversation. Pitchcrew applies that interaction to each job's shared queue across its attached conversations, with independent queues for standalone conversations. Pitchcrew's explicit interruption behavior is scoped to that job or standalone conversation as described above.
