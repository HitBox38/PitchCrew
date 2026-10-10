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
- Each initiating user request or scheduled occurrence has a shared limit of six automatic follow-ups across its group work, delegated DMs and newly created conversations. Creating a conversation does not reset the limit. Initial participant evaluations are separate from this follow-up allowance.
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
- Each agent has one active turn across its conversations, routines and workflow runs. Different agents can run in parallel; waiting requests queue visibly and retain their own conversation context.
- Show which conversation is occupying a busy agent. Busy participants' pending requests wait for their turn rather than starting a second concurrent run for that agent.
- Dispatch each agent's oldest ready request across conversations and routines first. Users can move an urgent queued request forward with Make next.
- Steer applies only within the active conversation. A request from another conversation can be queued or use the explicitly labeled Stop current and send action; do not inject one conversation's request into another conversation's active session.
- Follow T3 Code's distinction between Queue (a later turn), Steer (input to the active turn) and Stop (interrupt the active work).
- Offer a configurable Queue/Steer preference and a shortcut for the opposite action on an individual message.
- Show queued messages near the composer with edit, remove, reorder and promote-to-Steer controls where supported.
- Runtimes with live steering offer Steer. Runtimes without it offer an explicitly labeled Interrupt and send action, which stops current work and starts the new request. Cancellation and restart are never presented as native steering.
- Stop group stops the group's related work chains, including active replies and delegated tasks in agent DMs. Pending agent follow-ups are cancelled; queued user messages remain saved and paused until the user resumes them.
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
- Provide Comfortable, Wide and Full reading-width preferences under Settings > General > Appearance. Keep the chat header focused on the conversation and runtime. Wide is the default; Full uses all available conversation space. Preserve the device-local choice when moving the control.
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
- Preserve the 30-minute per-turn execution deadline, per-agent serialization, application workflow state checks and user-only outward-action approvals.

## Design discussion status

The implemented conversation model retains unrestricted group size and six automatic follow-ups per initiating request. Version 15 persists conversations, queued delivery requests, agent memory and native session checkpoints without rewriting old events. Runtime contract tests cover session flags, fresh scoped MCP configuration, checkpoints and invalidation; deterministic HTTP/MCP workflows cover membership, DMs, memory, queues, continuation, cancellation and replay. Browser checks use isolated Demo data. No live provider run is included in automated verification.

Codex and Claude Code support native resume in the current adapters. Continue starts a refreshed session using the saved summary; native compaction commands are not integrated. No current adapter exposes native live steering, so the UI offers Queue and explicit Interrupt and send (Stop current and send for another conversation). Future adapter support must retain fresh per-turn credentials and the same permission boundaries.

### Chat side panels

Conversation settings, conversation runtime, agent memory and agent defaults open in one panel on the right of the chat workspace, opposite the shared app sidebar. On desktop the transcript and composer resize beside the panel and remain interactive. On narrow screens the panel overlays the chat within its existing viewport bounds. The panel has its own scrolling content, a visible close action and Escape dismissal; Base UI manages focus and dialog semantics without dimming or disabling the desktop conversation. Opening another editor replaces the current panel. Agent defaults retain their existing save, retirement and unsaved-change guards, including when switching panels or navigating. Changing conversations closes the panel. New conversation creation remains owned by the app shell.

The Conversation / Crew work tabs live in the chat header as a compact clay switch between the conversation identity and runtime actions. Crew work retains its attention count and the shared tabs retain arrow-key navigation and linked panels. The switch wraps below the title and actions when the chat lane is narrow, including beside an open right panel, rather than keeping a separate full-width navigation row.

## Structured user input

`pitchcrew_ask_user` saves one question per execution turn with its asking agent, original run and conversation, visible message, optional single/multiple choices, explanation and concise continuation notes (completed work and next steps, never private reasoning). Every question permits a custom text answer. It is distinct from plain attention messages and all existing approval gates. Version 16 events persist pending, answered and cancelled questions and their answer/continuation provenance.

A question appears as a clay card in the transcript and a collapsible answer area above the composer. The header and shared sidebar show Waiting for you; pending questions raise the existing input attention notification. Answered/cancelled questions leave notification attention while their transcript remains. The composer remains available for independent work. Multiple pending questions can be answered independently, and ordinary messages do not silently answer them.

The answer area uses a fixed-size agent avatar, compact choices in two columns when its own width permits, and a single-line custom answer field that grows with input. Long question content scrolls inside the clay card with the action row kept visible; the surrounding section does not add a scrollbar alongside the transcript. Narrow layouts stack choices and retain a readable text input and accessible collapsed header. A rounded question card rises directly from behind the existing message input, which supplies the foreground toaster surface. It uses the shared clay spring on arrival and returns behind that input on resolution. Bottom overlap space protects the actions and contains the accordion’s closing edge without a transient outer scrollbar. Existing conversations open instantly, snapshot updates do not replay the entrance, and reduced motion substitutes a short fade. Exiting forms become inert immediately so resolved questions cannot be submitted again during the departure.

Asking ends the CLI execution after the tool response can return, clearing unfinished previews and invalidating the interrupted native session. The run, originating delivery and delegated task remain waiting without a live process or running wall-clock budget. The asking agent’s later ordinary deliveries in that conversation wait, and queued descendants cannot run before the blocked task is complete. Other participants and conversations remain available. This uses a new execution with restored scoped context on answer; no adapter currently bridges native live question protocols.

User-only answer routes validate option IDs, single/multiple selection, nonblank text and current membership. The answer and a targeted continuation are saved in one transaction. Continuation rechecks current runtime/role settings and originating delegation permissions, preserves the original chain’s follow-up allowance, and resumes the original chat or workflow mode. Answers do not invoke the group, grant approvals, silently change capabilities or require the separate Continue/summarization action. Multiple successive questions keep dependent work blocked until the final continuation completes.

Agent DM questions appear in a writable parent conversation with matching membership and job scope, or a separate application conversation when necessary. The DM stays user read-only; a source-linked system message records the answer in the original DM context and continuation returns to that scope. Workflow questions apply no partial result and release the application owner; an interrupted Writer returns to changes_requested until the answered workflow starts again.

Pending questions and blocked tasks survive daemon restart and event replay. Answers saved before a restart retain paused continuations that the user can resume from the queue. Cancelling a question cancels its blocked continuation chain; stopping work, removing the asking agent or retiring it cancels affected questions and dependent work. A continuation that fails or is interrupted retains the saved answer and exposes its existing queue recovery controls. Plain notification tools remain available for interim updates and unstructured attention.
