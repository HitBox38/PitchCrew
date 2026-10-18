# Pitchcrew

Pitchcrew helps a user manage a job search with a crew of agents and a shared application board.

## Language

**Removed source document**:
A previously imported Profile document that is no longer present in its connected source. Its local copy is kept and remains available to the user and crew.
_Avoid_: Deleted profile document

**Manual status change**:
A user's bookkeeping update to a job's board status. It does not start agent work or authorize packet export or application submission.
_Avoid_: Workflow execution (when referring only to a recorded status change)

**Withdrawn**:
A closed job the user has decided not to pursue further, with its application history retained. Recording this status does not communicate a withdrawal to the employer.
_Avoid_: Deleted job, employer notification

**Deleted job**:
A job removed from the board with its stored history and exported files retained, its queued follow-ups cancelled and its attached routines paused. It has no user-facing restore action.
_Avoid_: Withdrawn job, erased history

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

**Application requirement**:
An application-relevant employer request about what an applicant should provide or how to apply, accepted by the user as part of drafting confirmation. Known hidden directives are excluded, and ambiguous requests require user clarification; employer requests do not grant agent permissions or override the user's instructions.
_Avoid_: Agent instruction (when referring to an employer's application request)

**Drafting confirmation**:
A user's decision to accept an exact version of the job brief and application requirements before drafting, regardless of whether source visibility can be established; adopting a changed version requires a new confirmation. Saving a job description is not drafting confirmation, and confirmation does not authorize other directives in the source or grant agent permissions.
_Avoid_: Requirement confirmation (when implying that the brief is excluded), job approval, source approval

**Job brief**:
A structured account of a job's responsibilities, qualifications and company context, distinct from its original source text and accepted application requirements. It is reference material for tailoring an application, not verified evidence about the user or authority to direct an agent.
_Avoid_: Trusted job description, sanitized instructions

**Application draft**:
Employer-facing application copy prepared for a job, including resumes, cover letters and application answers, whether produced in chat or a board workflow and regardless of the agent's identity. Discussion of source material is separate from preparing an application draft.
_Avoid_: Packet (when implying that employer-facing chat copy is outside application drafting)

**Deep resume review**:
An optional assessment of a tailored resume against a specific job's confirmed brief, using multiple hiring perspectives to identify supported strengths, weaknesses and corrections for Writer. Its findings do not constitute an employer's hiring decision or authorize packet export or submission.
_Avoid_: Hiring panel (when implying actual employer participation), ATS verdict (when referring to a model's assessment)

**Review perspective**:
A hiring concern used to assess a resume, such as relevance, readability, impact or collaboration. One reviewer can apply several perspectives; those perspectives do not represent independent reviewers.
_Avoid_: Reviewer (when referring only to a perspective), independent opinion (when produced within the same review)

**Review subagent**:
A temporary agent assigned a specific concern within a parent deep resume review. It returns a targeted second opinion to the parent Reviewer rather than becoming a permanent crew member.
_Avoid_: Crew role (when referring to temporary review work), review perspective (when referring to a separate agent)

**Review deadline extension**:
Additional time granted by the parent Reviewer for unfinished work within a deep resume review, including work requested by its subagents. It extends the shared review budget without overriding user cancellation.
_Avoid_: Subagent timeout reset (when referring to an extension of the shared review)

**Deep review report**:
An account of a deep resume review's perspective assessments, second opinions, prioritized findings and correction outcomes, associated with the job and resume versions assessed. Historical findings do not establish approval of a later application draft.
_Avoid_: Hiring decision, current packet approval (when referring only to a historical report)

**Source extraction**:
Reading a selected job source to produce a job brief, proposed application requirements and flagged directives. It is separate from assessing the user's fit or preparing application copy.
_Avoid_: Scout assessment (when referring only to extracting a source), source verification

**Personal application answer**:
A user-supplied response to an employer's question about the user's opinions, preferences, motivations or experiences, specific to that application unless the user explicitly saves it to Profile for reuse. An agent may polish the response but cannot substitute its own impressions or infer a personal answer from public research.
_Avoid_: Research finding (when referring to the user's own opinion), inferred preference

**Profile note import**:
A user-reviewed copy of selected source documents into Profile as local notes about the user. Watching the source for later changes is optional; subsequent updates require review.
_Avoid_: Automatic sync, project watch (when referring to copying personal documents)

**Project watch**:
A user-enabled GitHub source for an authorized agent to investigate project changes and propose profile notes for the user's review. Watching a project does not itself import documents or establish the user's personal contribution.
_Avoid_: Profile note import, automatic profile update

**Career Coach**:
A crew agent that helps the user with interview preparation, practice and debriefs, career planning, offer evaluation, company research and LinkedIn profile drafting.
_Avoid_: Pipeline Coach (when referring to career support rather than application pipeline or crew improvement)

**Company research brief**:
A sourced account of a company's business, recent developments, relevant team and reported interview process, with uncertainties identified. It is research about the employer, separate from the job brief and the user's personal motivations or verified Profile evidence.
_Avoid_: Job brief (when referring to broader company research), verified Profile evidence

**LinkedIn profile drafting**:
Preparing proposed LinkedIn profile text grounded in the user's actual experience and target roles for the user to review and publish themselves.
_Avoid_: LinkedIn automation, profile synchronization

**Interview preparation**:
Planning for a specific interview using the job's requirements, the user's experience and known interview details.
_Avoid_: Interview practice (when referring to planning rather than rehearsal)

**Interview practice**:
A rehearsal in which the user answers interview questions and receives feedback on those answers.
_Avoid_: Interview assessment (when implying an employer's actual evaluation)

**Coached practice**:
Interview practice with feedback after each completed answer.
_Avoid_: Mock interview (when referring to practice interrupted by coaching)

**Mock interview**:
Interview practice that stays in the interviewer role and defers coaching feedback until the round ends.
_Avoid_: Coached practice (when referring to feedback after each answer)

**Interview debrief**:
The user's account of a completed interview, considered alongside feedback to identify lessons and preparation needs.
_Avoid_: Employer feedback (when referring only to the user's recollection)

**Career planning**:
Exploring target roles, adjacent job titles, skill gaps and learning priorities in relation to the user's goals and experience.
_Avoid_: Pipeline review (when referring to career direction rather than the application pipeline or crew performance)

**Offer evaluation**:
Comparing an employment offer's stated compensation and contract terms with the user's priorities and reported promises, identifying uncertainties and preparing questions for the employer or a lawyer.
_Avoid_: Offer acceptance (when referring only to analysis)
