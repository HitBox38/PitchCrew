# Pitchcrew

Pitchcrew helps a user manage a job search with a crew of agents and a shared application board.

## Language

**Conversation**:
A named exchange with its own message history, participants and optional job context. Separate conversations can cover different topics or jobs with the same agent or agents.
_Avoid_: Agent chat history (when referring to an individual conversation)

**Direct conversation (DM)**:
A conversation between the user and one agent, or between two agents. Agent-to-agent DMs are visible to the user as read-only conversations.
_Avoid_: Private agent conversation (when implying that the user cannot inspect it)

**Group conversation**:
A conversation with multiple participating agents, created by the user or an agent. The user can view the conversation.
_Avoid_: Crew conversation (when implying that every agent participates)

**Lead agent**:
The participant responsible for coordinating a group's work and summarizing its outcome. Other participants can contribute relevant input independently of the lead's delegation.
_Avoid_: Sole responder

**Agent memory**:
Persistent context saved locally for an individual agent, available across that agent's conversations. The agent recalls it when it judges it relevant or when the user asks it to.
_Avoid_: Conversation history (when referring to saved context across conversations)

**Memory sharing**:
An agent communicates relevant recalled context to another agent through a direct or group conversation. Each agent reads its own memory directly, while the user can inspect all agents' memories.
_Avoid_: Shared memory pool

**Continuation summary**:
A concise account of a work request, its decisions, completed work, remaining tasks and relevant sources, used when the user continues an agent collaboration. The original conversation history remains available.
_Avoid_: Agent memory (when referring to the summary of one continuing request)

**User input request**:
A durable agent question with choices or a custom answer, source run/conversation and pending, answered or cancelled state. Asking ends execution while the task waits; an answer queues only the asking agent’s continuation. It does not authorize restricted actions.
_Avoid_: Approval (when referring to a clarification), active runtime (while waiting without a process).
