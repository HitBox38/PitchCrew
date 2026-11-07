# Chat redesign

This document records decisions from the chat redesign discussion. The conversation model, queue, memory tools, structured user questions and UI described here are implemented. Native continuity is integrated for Codex and Claude Code; other adapters reconstruct context. Current adapters use explicit interruption instead of native live steering, and Continue uses summary-based session refresh rather than a native compaction command. Live provider execution remains outside automated verification.

## Agreed direction

- Use T3 Code as inspiration for interaction with an agent runtime, and Grok Bot as inspiration for agent collaboration in chat.
- Support separate, named conversations with their own histories, including multiple conversations involving the same agent.
- Create and navigate conversations in the shared app sidebar’s Conversations section. Chat has no separate inner sidebar.
- Support direct conversations between the user and one agent.
- Support group conversations with selected agents. Both users and agents can create groups.
- An agent joining an existing group can access the group's earlier messages and shared files, with relevant context loaded as needed. A visible conversation entry records when the agent joined.
- The user can add or remove any group participant. The lead can add agents when their expertise is needed; other participants request additions through the lead. Only the user removes participants.
- Removing a participant stops its work for that group, cancels its queued group turns and blocks further group access. Preserve its historical messages and keep unrelated conversation work running.
- Removing a participant does not erase its previously saved agent memories. The user manages those entries separately in the memory view.
- Support direct conversations between agents. The user can inspect those DMs as read-only conversations and intervenes through a separate chat rather than posting in the DM.
- Each conversation has at most one persistent attached job, which supplies context across messages and handoffs. General conversations can remain job-free; work on a different application uses a separate conversation.

## Agreed group response model

- Each group has a designated lead responsible for coordination, delegation and summarizing the result.
- The user chooses the lead when creating a group. An agent creating a group starts as its lead.
- The lead can autonomously transfer leadership to another available participant. A visible conversation entry records the handoff, and the user can change the lead themselves.
- If the lead is paused or its runtime is unavailable, other eligible participants can still respond. Show Choose new lead and let the user select a replacement; do not silently promote another participant. A busy lead waits in its queue and retains leadership.
- Other participants can independently contribute relevant findings, objections or offers to take work; they do not need to wait for delegation.
- Explicit mentions direct requests to the named participants, who are expected to respond.
- Participants can stay silent when they have nothing useful to add.
- Groups have no separate participant limit or size-based warning. The user can include any eligible agents in their workspace.
- An unaddressed user message gives each available participant one chance to contribute. Each evaluation uses a runtime call even if the participant chooses silence.
- A user message with explicit mentions calls only the named participants.
- Agent replies do not automatically trigger a new group-wide round. They continue exchanges through explicit mentions or delegation.
- Each initiating user request or scheduled occurrence has a shared limit of six automatic follow-ups across its group work, delegated DMs and newly created conversations. Creating a conversation does not reset the limit. Initial participant evaluations are separate from this follow-up allowance. A [delegation round](delegation-rounds.md), including its collection turn, counts as one follow-up.
- At the limit, show completed work, remaining tasks and a user-only Continue action that starts another bounded round.
- Continue first creates a concise continuation summary covering the request, decisions, completed work, outstanding tasks and relevant sources, reducing the context sent into the next round.
- Preserve full messages and attachments. Summaries link back to their sources, and participating agents can retrieve details as needed. Each agent receives context appropriate to its work and permitted conversations.
- Use supported native context compaction when available; otherwise start a refreshed runtime session with the continuation summary and necessary current context. Simply appending a summary to an unchanged full session does not reduce token usage.

## Agreed continuity direction

- Prefer native runtime session continuity where supported, with a separate session for each agent in each conversation. Runtimes without resumable sessions reconstruct context from saved conversation history.
- Runtime/model choices in chat are specific to the conversation and participant. Crew settings manage the agent's defaults; agent identity and local memory remain with the agent across runtime choices.
- Runtime, model and reasoning each offer Use agent default. Inherited fields remain omitted from saved overrides and resolve from current Crew settings at the next turn. Clearing all overrides restores full inheritance; existing explicit choices remain explicit. CLI default is a separate model/reasoning choice.
- Keep the reasoning override out of the main composer controls, accessible through Conversation runtime. Inheritance and CLI default remain accessible; explicit reasoning levels appear only for supported models, retaining keyboard and assistive-technology access.
- Each agent also has its own persistent context saved locally, called agent memory.
- Recall is on demand: the agent can retrieve its memory when it judges it needed, and the user can explicitly request recall.
- Agents can automatically save useful, durable notes to their own memory. Each note retains a source.
- The user has a memory view where they can inspect, edit and delete entries.
- Each agent reads its own memory directly. Agents share relevant recalled context through explicit DMs or group messages; they cannot directly search another agent's memory.
- The user can inspect every agent's memory.
- Memory edits take effect on the agent's next turn in both existing and new conversations. Recalled notes use the current version, and deleted entries stop being recalled.
- Refresh affected runtime sessions when required to apply memory changes. Saved conversation messages retain their original text.
- Organize memory as a searchable notebook per agent, accessible from chat and Crew. Each entry shows its source, last update and optional tags.
- Replies offer a collapsed Memory used section identifying notes recalled for that turn.
- Memory remains separate from assigned skills and verified Profile evidence. Saving or recalling a note does not authorize a capability, change role instructions or qualify a personal claim for application packets; existing user-reviewed evidence and proposal flows still apply.

## Agreed active-run messaging direction

- Keep the composer usable while agents work, with Queue as Pitchcrew's default follow-up behavior.
- A job shares one queue across its attached conversations and board actions; standalone conversations have independent queues. The same crew agent may execute unrelated jobs concurrently. The configurable workspace limit defaults to five active queues, with a managed deep review and its temporary children sharing one slot. See [workspace and job queues](board-action-queue.md).
- Show the current job or conversation activity. Pending requests wait for their own queue, while the agent remains available for other jobs.
- Dispatch the oldest eligible queue first. Users can change global priority on Queue and arrange requests within each job; automatic follow-ups finish before the next user action. Job-free routines yield to eligible visible queues.
- Steer applies only within the active conversation. A request from another conversation can be queued or use the explicitly labeled Stop current and send action; do not inject one conversation's request into another conversation's active session.
- Follow T3 Code's distinction between Queue (a later turn), Steer (input to the active turn) and Stop (interrupt the active work).
- Offer a configurable Queue/Steer preference and a shortcut for the opposite action on an individual message.
- Show queued messages near the composer with edit, remove, reorder and promote-to-Steer controls where supported.
- Runtimes with live steering offer Steer. Runtimes without it offer an explicitly labeled Interrupt and send action, which stops current work and starts the new request. Cancellation and restart are never presented as native steering.
- Stop cancels the current job or standalone conversation's related work chains, including active replies and delegated tasks in agent DMs. Pending agent follow-ups are cancelled; queued user messages remain saved and paused until the user resumes them.
- The group queue shows each user message once, with waiting, working and finished status per participant.
- Queued group messages can be edited until their first participant starts. After delivery begins, users can cancel remaining deliveries or send a correction rather than rewriting input that an agent has already received.
- Offer Stop agent to stop that participant's work and delegated branch for this request while independent participants continue. Preserve Stop group for cancelling all related work.
- Resuming a partially delivered request targets its paused, unfinished deliveries; do not repeat completed participant turns.

References checked on October 8, 2026: [T3 Code composer shortcuts](https://github.com/pingdotgg/t3code/blob/main/docs/user/keybindings.md), [primary actions](https://github.com/pingdotgg/t3code/blob/main/apps/web/src/components/chat/ComposerPrimaryActions.tsx), and [queue controls](https://github.com/pingdotgg/t3code/blob/main/apps/web/src/components/chat/QueuedRunsControl.tsx).

## Agreed layout requirement

- The composer has one Add context menu for message files and the conversation job. File limits appear in the menu; selected files appear as removable chips above the message. The persistent job has a separate linked Conversation chip and can be changed or removed before the first message. After work starts it is fixed, with a lock indicator; another job uses another conversation. Job selection searches the board by company or title. File-only sends, per-conversation drafts, paste/drop and queue/interrupt actions retain their behavior.

- Increase the chat page's width to use the full available workspace beside the app sidebar, following the requested T3 Code and Grok Bot direction.
- Current constraints are the general page's 1680px maximum and 40px horizontal padding, the transcript's 830px maximum and the composer's 766px maximum. Chat needs its own width treatment.
- Reduce the chat page's outer horizontal gutters and align the transcript and composer to the same width.
- Provide Comfortable, Wide and Full reading-width preferences under Settings > General > Appearance. New devices default to Comfortable; Full uses all available conversation space. Preserve the device-local choice when moving the control.
- Target approximately 46rem for Comfortable and 72rem for Wide, bounded by the available viewport. The outer chat workspace fills the available width in every mode.
- Further visual choices should feel true to Pitchcrew and can be made during implementation.

## Agreed conversation navigation

- The main conversation list includes user-to-agent chats, groups, routine conversations and application work conversations.
- Use one app sidebar for workspace and conversation navigation. Conversations has its own collapsible heading, search, creation and archive controls. The icon sidebar offers Open conversations and New conversation; mobile uses the same app sidebar drawer.
- Agent-to-agent DMs appear in a separate collapsible section so their traffic does not overwhelm the main list.
- Every conversation remains searchable and pinnable, including agent DMs.
- Groups link to their related agent DMs. Activity badges distinguish agents working from requests waiting in a queue.

## Agreed conversation lifecycle

- Users can archive conversations and restore them. Archiving preserves messages, attachments and conversation context.
- Archiving does not cancel active work or pause scheduled routines; those remain separate actions.
- New activity returns an archived conversation to its appropriate sidebar list.
- Archiving and restoring agent-to-agent DMs does not make their messages editable by the user.

## Agreed notifications

- Default notifications cover direct replies to the user, group summaries, routine outcomes and requests for user input or approval.
- Internal agent replies and agent-to-agent DMs update unread and activity badges without a separate toast or sound for every exchange.
- Users can opt into more notifications per conversation.

Width reference checked on October 8, 2026: [T3 Code's chat-width styles](https://github.com/pingdotgg/t3code/blob/main/apps/web/src/index.css).

## Visual direction

- Preserve Pitchcrew's paper/ink palette and existing light/dark themes.
- Preserve the 3D clay treatment as a central part of the product's identity, including tactile controls, selected conversation states and surface depth. Do not flatten the chat design.
- Improve hierarchy through spacing, typography, grouping and purposeful controls.
- Use the existing theme tokens: light paper #f2f1ec, surface #f8f7f3, ink #2b2d31 and action indigo #3a5482, with their existing dark-theme equivalents and role-color accents.
- Use Source Sans 3 for compact chat interface text and headings, retaining Pitchcrew's broader typographic identity where appropriate.
- Details beyond the retained palette, themes and depth are delegated to implementation judgment, guided by what feels true to Pitchcrew.

## Agreed history migration

- Preserve each existing user-to-agent chat as a normal named conversation that the user can continue.
- Preserve the old shared crew conversation as searchable, read-only Crew history. Future group and agent-to-agent exchanges use the new conversation model.
- Preserve all messages, attachments and historical job links. Do not infer topical groups or agent-to-agent DMs by splitting the old crew transcript.
- Existing direct chats retain their historical per-message job links without guessing a single current attached job from mixed history.

## Agreed routine conversations

- Each routine defaults to its own persistent named conversation, such as Daily job scan. Successive occurrences continue the same history.
- The user can choose an existing appropriate conversation instead, retaining its participants and attached job scope.
- A scheduled occurrence calls the routine's assigned agent. Posting into a group does not automatically call every member; other agents join through explicit delegation.
- Routine execution continues to use the assigned agent's saved settings and existing scheduling, capability and approval rules.

## Agreed application work conversations

- Each job has one persistent Application work conversation shared by the agents working on it.
- Board-started Scout assessments, Writer drafts and Reviewer decisions appear as concise updates linked to the saved board results. The board remains the source of truth for application state and packets.
- The user can discuss the work in this conversation, and retries continue the same history.

## Behavior before the redesign

- Conversations were identified by an agent's identity or the single shared crew conversation.
- Every agent-to-agent message or invocation queued a follow-up and posted into the shared crew conversation.
- Each chat turn started an isolated runtime call with the last 40 conversation messages; native runtime sessions were not resumed.
- Role capabilities governed agent messaging and invocation. Follow-ups waited for their parent, and each user-started chain was limited to six follow-ups.
- Chat results required a nonempty reply, without an intentional silence result.
- Runtime context included role instructions, assigned skills, shared profile notes, an optional attached job and recent conversation messages, without a separate agent-memory facility.
- The shared adapter contract had no method for injecting input into an active turn; chat sending rejected busy agents.
- Orchestration allowed only one running turn per agent across conversations, routines and workflow runs.
- Notification collection treated every saved agent message as a notification, including internal crew exchanges.

## Implementation requirements from existing boundaries

- Keep existing role capabilities and user approval gates. Agent-created groups and invitations require agent messaging permission; explicit task delegation requires invocation permission, and workflow launches still require workflow permission and valid job state. Membership never grants additional tools or enables a paused agent.
- Recheck participant membership, current capabilities and job scope before dispatching queued work and on scoped tool access. Removed participants cannot regain group access through a stale session or queued request.
- Native session continuity is conditional on maintaining fresh per-turn scoped tool access. Never reuse expired run credentials. If an adapter cannot safely refresh its tool configuration for a resumed session, reconstruct a new session from the permitted conversation context.
- Apply runtime/model, instruction, skill and permission changes at the next turn using current settings. Refresh affected sessions when changes cannot safely be applied in place; preserve the existing restriction on editing role settings during active work.
- Memory edits take effect next turn without interrupting current work. Saved messages retain their original content.
- Preserve the 30-minute per-turn execution deadline, per-job/conversation serialization, application workflow state checks and user-only outward-action approvals.

## Design discussion status

The implemented conversation model retains unrestricted group size and six automatic follow-ups per initiating request. Version 15 persists conversations, queued delivery requests, agent memory and native session checkpoints without rewriting old events. Runtime contract tests cover session flags, fresh scoped MCP configuration, checkpoints and invalidation; deterministic HTTP/MCP workflows cover membership, DMs, memory, queues, continuation, cancellation and replay. Browser checks use isolated Demo data. No live provider run is included in automated verification.

Codex and Claude Code support native resume in the current adapters. Continue starts a refreshed session using the saved summary; native compaction commands are not integrated. No current adapter exposes native live steering, so the UI offers Queue and explicit Interrupt and send (Stop current and send for another conversation). Future adapter support must retain fresh per-turn credentials and the same permission boundaries.

### Chat side panels

Conversation settings, conversation runtime, agent memory and agent defaults open in one panel on the right of the chat workspace, opposite the shared app sidebar. On desktop the transcript and composer resize beside the panel and remain interactive. On narrow screens the panel overlays the chat within its existing viewport bounds. The panel has its own scrolling content, a visible close action and Escape dismissal; Base UI manages focus and dialog semantics without dimming or disabling the desktop conversation. Opening another editor replaces the current panel. Agent defaults retain their existing save, retirement and unsaved-change guards, including when switching panels or navigating. Changing conversations closes the panel. New conversation creation remains owned by the app shell.

The Conversation / Crew work tabs live in the chat header as a compact clay switch between the conversation identity and runtime actions. Crew work retains its attention count and the shared tabs retain arrow-key navigation and linked panels. The switch wraps below the title and actions when the chat lane is narrow, including beside an open right panel, rather than keeping a separate full-width navigation row.

## Structured user input

`pitchcrew_ask_user` saves one question per execution turn with its asking agent, original run and conversation, visible message, optional single/multiple choices, explanation and concise continuation notes (completed work and next steps, never private reasoning). Every question permits a custom text answer. It is distinct from plain attention messages and all existing approval gates. Version 16 events persist pending, answered and cancelled questions and their answer/continuation provenance.

A question has a compact transcript record and one collapsible answer area above the composer. The header and shared sidebar show Waiting for you; pending questions raise the existing input attention notification. Answered/cancelled questions leave notification attention while their transcript remains. While answering, an empty idle composer yields to a Write a message for later action, which collapses the question and focuses the preserved composer. Existing drafts, attachments and active-run controls keep the composer visible. Multiple pending questions can be answered independently, and ordinary messages do not silently answer them.

The answer area uses a fixed-size agent avatar, compact choices in two columns when its own width permits, and a single-line custom answer field that grows with input. Long question content scrolls inside the clay card with the action row kept visible; the surrounding section does not add a scrollbar alongside the transcript. Narrow layouts stack choices and retain a readable text input and accessible collapsed header. A rounded question card rises directly from behind the existing message input, which supplies the foreground toaster surface. It uses the shared clay spring on arrival and returns behind that input on resolution. Bottom overlap space protects the actions and contains the accordion’s closing edge without a transient outer scrollbar. Existing conversations open instantly, snapshot updates do not replay the entrance, and reduced motion substitutes a short fade. Exiting forms become inert immediately so resolved questions cannot be submitted again during the departure.

Asking ends the CLI execution after the tool response can return, clearing unfinished previews and invalidating the interrupted native session. The run, originating delivery and delegated task remain waiting without a live process or running wall-clock budget. All later ordinary deliveries for that job or standalone conversation wait, and queued descendants cannot run before the blocked task is complete. Other jobs and standalone conversations remain available. This uses a new execution with restored scoped context on answer; no adapter currently bridges native live question protocols.

User-only answer routes validate option IDs, single/multiple selection, nonblank text and current membership. The answer and a targeted continuation are saved in one transaction. Continuation rechecks current runtime/role settings and originating delegation permissions, preserves the original chain’s follow-up allowance, and resumes the original chat or workflow mode. Answers do not invoke the group, grant approvals, silently change capabilities or require the separate Continue/summarization action. Multiple successive questions keep dependent work blocked until the final continuation completes.

Agent DM questions appear in a writable parent conversation with matching membership and job scope, or a separate application conversation when necessary. The DM stays user read-only; a source-linked system message records the answer in the original DM context and continuation returns to that scope. Workflow questions apply no partial result and release the application owner; an interrupted Writer returns to changes_requested until the answered workflow starts again.

Pending questions and blocked tasks survive daemon restart and event replay. Answered continuations that never started resume when eligible after restart; interrupted continuations require explicit recovery from the queue. Cancelling a question cancels its blocked continuation chain; stopping work, removing the asking agent or retiring it cancels affected questions and dependent work. A continuation that fails or is interrupted retains the saved answer and exposes its existing queue recovery controls. Plain notification tools remain available for interim updates and unstructured attention.

## Live turn activity

The conversation transcript places each agent's turn after its triggering message and before the answer. Each turn has one initially collapsed activity disclosure with step and public-update counts, including failed/interrupted counts. Live turns preview only the latest public commentary (up to three lines) and latest step; settled turns keep a failed step, or otherwise the latest interrupted step, visible. Expanding shows all saved public commentary and grouped action labels with running/completed/failed/interrupted outcomes and durations; earlier steps within long groups remain available through their existing disclosure. Each step offers its start time and outcome. Final replies lead visually, with a Copy action and timestamp below ordinary answer content; fine pointers reveal the footer on hover/focus and touch keeps it visible. Question records exclude Copy. Outcome-first disclosures and failed counts identify work without competing with the answer; expanded logs use a recessed tray. Normal paragraphs, lists and quotes are bounded to 76ch; tables and code keep the available lane width. The outcome disclosure retains elapsed duration and completed, stopped, failed or waiting state. Crew follow-ups retain their own role and turn identity. Existing history does not replay entrance animations, and reduced motion keeps disclosures immediate.

The daemon observes scoped tool lifecycles independently of the chosen runtime. It uses fixed action labels and never copies tool arguments or results into activity, including browser inputs, page contents, screenshots or private manual-takeover data. Native assistant text outside the required structured reply is public commentary; private thinking text stays excluded, with recognized native thinking events supplying phase markers only. `pitchcrew_report_progress` posts up to eight short public updates per chat turn without notification, message history, approval changes or agent invocation. Shared chat prompts ask for a few factual progress updates on multi-step tasks and retain the final JSON contract.

Live activity remains in memory, with at most 80 entries and 4,000 characters per commentary entry; the UI identifies truncation. Each settled run saves one bounded activity snapshot in its optional `activity` field. Failed, cancelled and user-question turns retain their trace; a step without an observed outcome becomes interrupted. The activity snapshot is separate from final conversation messages and runtime context. Abrupt daemon termination can lose in-flight activity; completed snapshots survive board replay. Older runs without activity remain readable without a fabricated trace.

The session-protected chat SSE connection sends saved activity on connection and active run updates thereafter. The renderer merges snapshots by run ID, preserves completed traces across reply-only frames, and restores active traces on reconnect or snapshot polling. Unchanged activity is omitted from reply token frames, and the existing coalescing, response backpressure and disconnect cleanup remain in place. No new telemetry contains activity text or tool data.

### Composer during a turn

A sent message appears once in the transcript, followed by one compact agent activity row. There is no status banner above the input and no repeated preparation paragraph. The empty composer swaps its Send control for a square Stop control with an accessible label and tooltip. When the user drafts a follow-up or attaches files, Send returns alongside Stop and a compact After reply / Interrupt selector; interrupt retains the existing explicit stop-and-send behavior. Busy agents in other conversations do not get a misleading Stop control for the current thread. Writable conversations use the composer for stopping; read-only crew history and DMs retain their existing header Stop control when work is active.

Only requests with queued, paused or failed deliveries appear above the composer, inside a keyboard-accessible follow-up disclosure with a bounded scrolling preview and an overflow cue. Its collapsed preference persists per conversation on this device; newly failed or paused deliveries reopen it. Running-only requests are already represented in the transcript. Mixed group requests remain visible while any delivery waits or needs attention. The open preview shows the existing edit, reorder, remove, resume and interrupt actions. Narrow composers use the icon-only Add context control while a follow-up is being drafted and keep the send controls together; browser preparation controls move into a labelled options popover below a 48rem chat-lane width. Responsive controls measure the actual composer width, including the Comfortable lane; drafted follow-ups and question-held sends use their own dispatch row below 60rem. The context/model group and dispatch group have stable positions; group routing remains visible and busy follow-up dispatch uses its own row below 32rem. Composer controls have 32px desktop and 44px touch targets. Real runtimes expose Enter/Shift+Enter guidance in the Send tooltip without a separate hint row. Stopping restores focus to the input.

## Long conversation histories

The transcript targets 50 message and turn-activity entries at a time, with up to one extra context row to keep a settled turn and its answer together. It opens on the latest entries and retains normal streaming and scroll-to-bottom behavior. A persistent, keyboard-accessible history bar shows the displayed range and offers Older, Newer and Latest. Older pages stay anchored by entry identity while new replies arrive. Paging never discards messages or tool activity from the conversation; browser find and text selection apply to the currently displayed page. Each page repeats the first visible entry’s day separator. Returning to Latest restores live following.

### Chat hierarchy follow-up

Server history and live rendering share ordering and page boundaries. A settled turn sits immediately before its own final answer, even when group agents finish in a different order. Presentation folds only proven automatic @mention forwards with matching run, thread, task recipient, text and references; saved messages and task deliveries remain intact. Never-started queued/paused/failed messages stay in the queue, with cancelled-before-start records marked Not sent when their request is available.

Pending questions keep one answer form above the composer. The matching transcript record is hidden while its dock is open and offers Answer question when the dock is closed. Automatic focus handoffs target the free-answer text field, never a one-click choice. An actively edited composer remains visible when its last text is deleted, including while choosing context or a question option; the latch ends on question collapse, resolution or navigation. Unavailable answer targets also keep it visible. Answer text, selections and in-flight response state survive chat navigation in memory, keyed by question ID; only an authoritative resolved status removes them. Collapsing one question never collapses a later question. Response failures preserve the answer and its owned focus with error context. Acknowledged saves with a failed refresh, or ambiguous network failures, offer a read-only status check before another submission. Acknowledged typed responses restore owned text focus; choice responses use a neutral target without opening a touch keyboard. External resolution preserves a different unsent response in a recovery tray and never redirects continued typing into a new message. Failure follow-up actions share the controlled reveal-and-focus path. Choice content uses its natural height up to a bounded scroll region with an overflow hint; free answers grow to a bounded height outside that region. Opening and growth reveal actions through the normal transition while deliberate scrolling retains control.

Queue attention changes retain editor identity, local drafts and focus. The header shows the saved pause reason: user-paused queues expose Resume all, and failed/interrupted work exposes a gated Retry for the head request. A request-level resume rejects non-head requests before changing state; explicit Send now and resume queue retains its reorder action. Head retry preserves completed recipients and resumes later never-started paused messages, stopping for separate review at another attempted failure. Row recovery lives in its options menu when the header already owns it. Exact diagnostics stay in Details with Copy. Successful recovery restores owned focus to the composer or Stop. Sends held by a paused queue say Sends after you resume with a matching accessible name, including on phones; question-held messages retain After your answer. Paused and failed requests also drive sidebar attention beads.

Phone chats give the job or conversation title the full top-bar lane and put labelled Chat/Work tabs in the existing row below. A compact current stage/next-action row replaces the full track on phones; the full job remains available through Job. The composer omits the duplicate locked job chip, retains group routing, and visibly names effective browser preparation mode in narrow lanes. Desktop header order stays stable when side panels open. Keyboard guidance lives in the Send tooltip, so focusing controls never resizes the composer.

New devices default to the Comfortable reading lane; saved width choices remain unchanged. Chat answers use 14/20 body type, outside list markers, a single task checkbox marker, bounded prose and wider tables/code. Tables retain one quiet copy action; one live announcer serves the active conversation rather than announcing every historical turn, and starts empty on navigation. Short windows compact secondary header/composer chrome and keep a readable transcript minimum; expanded queues have bounded previews and the chat column scrolls whenever all controls cannot fit. The browser keeps its independent viewport. Scroll to latest occupies a separate strip while active, clear of reading text. Manual verification for this pass uses an isolated production workspace and actual installed CLI runtimes; live providers remain outside CI.

### Dispatch and queue presentation

A user message enters the transcript at its first actual delivery time, derived from saved run/request relationships. Written timestamps remain unchanged in events and are available alongside delivery time. Server history, live updates and paging use the same shared presentation helpers. Automatic forwarded-reply folding uses a single indexed helper in both paths instead of correlated per-row history queries.

Queue rows offer full-message reading and a multiline editor that preserves references and saved attachments. Editing never touches the ordinary composer's draft or sends a message. New sends and queued edits use the same strict reference projection, retaining identity, trim-relative offsets and skill revision without sending display-only labels. An editor remains available if delivery starts, with Save gated and correction guidance. The queue summary distinguishes never-sent inputs from partially delivered group messages.

Historical failures are quiet records with a plain explanation, original copyable diagnostics and a Write a follow-up action. They do not announce themselves as new alerts. The conversation announcer tracks observed work per thread: newly failed or stopped turns announce that outcome, while old failures stay quiet on navigation. Token and commentary updates do not repeat its text. The transcript log explicitly disables its implicit live announcements. A visible open question publishes only its exact notification ID to suppress or close the redundant ready toast; route, modal and visibility changes clear that ownership, while bell/read/pending state stays unchanged.

Turn work durations exclude saved human-answer waits and idle gaps before or between continuation attempts. Their accessible description distinguishes answering time from continuation queue time. Saved answers show Answer saved rather than a stale Waiting for you outcome while their continuation proceeds. Shared job queues also explain their hold in a new attached chat with no local queued messages, linking to the actual blocking chat or Queue without presenting another chat's messages as local rows. Resume applies to a user pause; Retry applies to unfinished failed or interrupted work.

Messages with mentions or file citations retain the same GFM tables, task lists and strikethrough as ordinary Markdown. Inline references keep the text's line height, with larger pointer areas and visible keyboard focus. Short columns reveal Send when the active composer grows, retain a sticky chat heading and respect deliberate reading scrolls; pointer presses do not move their own target. Expanded queued text follows its height transition into view and then returns scrolling control to the reader.

Composer drafts now share one renderer-scoped store across routes, including atomic references and File objects. A send snapshots its payload and opens a fresh editable draft, so continued writing cannot be consumed by the earlier request. Only acknowledged submissions consume their snapshot; ambiguous sends keep separate drafts and offer a read-only refresh, never an automatic resend or a guessed receipt. Reviewing a kept draft swaps complete payloads and keeps the other draft intact. This is navigation durability within the renderer, not process-restart persistence.

Single-choice confirmation does not focus text entry during its delay. A corrected digit selects the latest choice, repeated keydown events are ignored, unrelated app controls do not answer questions, and custom single-answer typing clears a stale selection. HTTP rejection reasons stay visible; the same rejected payload is not silently offered as a successful queued answer. A question resolved elsewhere preserves a different unsent response and moves owned focus to that recovery surface. Multi-select layout uses the shared checkbox's intrinsic size rather than applying label flex to its root span.

Chat list renderers remove Streamdown's inside-marker utility so the actual cascade preserves hanging wrapped lines and nested paragraphs, with room for multi-digit ordered markers. Mention, file and draft-reference popovers have 12px padding; available agent mentions can open the existing Agent settings surface. In short coarse-pointer chats the sidebar temporarily starts as a rail, with explicit temporary toggles and the ordinary saved preference restored on exit. Short job sheets scroll their identity and section controls with their content while retaining the action footer.
