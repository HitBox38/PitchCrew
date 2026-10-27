# Pitchcrew

Pitchcrew helps a user manage a job search with a crew of agents and a shared application board.

## Language

**Inbox request**:
A request for the user's decision or submission follow-up concerning an application packet or browser action, retained with its outcome when resolved.
_Avoid_: Email (when implying a message sent through an email service), notification (when referring to the decision request itself)

**Request attachment**:
A document or frozen browser evidence item included with an Inbox request for the user to inspect as part of that decision. Viewing an attachment does not approve the request or export the document.
_Avoid_: Chat attachment (when referring to a document included with an Inbox request)

**Unread Inbox request**:
An Inbox request the user has not opened or has marked unread. Read status is separate from whether the request still needs action.
_Avoid_: Pending approval (when referring only to whether a request has been read)

**Submission follow-up**:
An outstanding user step after packet approval, such as completing a manual application or verifying a submission outcome. Exporting files does not complete the follow-up.
_Avoid_: Pending approval (when the packet is already approved), submitted application (when applying has not been recorded)

**Agent-assisted submission**:
An application process in which a crew agent prepares the employer's form and submits it after the user approves the exact final submission action. Choosing this method does not itself approve the final submission.
_Avoid_: Unattended submission, automatic application (when implying no final user decision)

**Submission verification**:
The user's determination of whether an application was submitted, based on the employer's confirmation or other evidence. Approval to submit and an agent's report of success do not themselves establish a verified submission.
_Avoid_: Submission approval (when referring to checking the outcome), automatic success

**Submitter**:
A crew agent specializing in inspecting employer application forms, preparing applications with reviewed documents and carrying out user-approved submissions.
_Avoid_: Writer (when referring to the agent responsible for employer-form preparation and submission)

**Crew runtime**:
An installed agent CLI that Pitchcrew uses to carry out a crew agent's conversations and job workflows.
_Avoid_: Model provider (when referring to the local CLI), Pitchcrew app

**Runtime check**:
An assessment of a crew runtime's installation, compatibility and authentication status. Authentication may be confirmed, missing or unable to be verified; the assessment is separate from a completed model request.
_Avoid_: Test request, verified model access

**Runtime update**:
A user-requested upgrade of an installed crew runtime, with progress and an outcome visible in Pitchcrew.
_Avoid_: Pitchcrew app update, agent instruction update, skill update

**Removed source document**:
A previously imported Profile document that is no longer present in its connected source. Its local copy is kept and remains available to the user and crew.
_Avoid_: Deleted profile document

**Manual status change**:
A user's bookkeeping update to a job's board status. It does not start agent work or authorize packet export or application submission.
_Avoid_: Workflow execution (when referring only to a recorded status change)

**Workspace queue**:
The ordered waiting line of eligible job queues and standalone conversation queues competing for available workspace capacity. The user can change their order.
_Avoid_: Job queue (when referring to the order between different jobs)

**Job queue**:
An ordered collection of board actions and chat requests from all conversations attached to one job. Separate jobs have independent queues, even when their work uses the same crew agent.
_Avoid_: Agent queue (when implying that an agent serializes work across all jobs)

**Standalone conversation queue**:
An ordered collection of chat requests for a conversation with no attached job, excluding job-free routine occurrences. It is independent of other conversations and job queues.
_Avoid_: Agent queue (when implying that conversations with the same agent share one queue)

**Queued board action**:
A request in a job queue for one agent action on that job, such as evaluating fit on a lead.
_Avoid_: Action chain (when referring to a single requested board action)

**Crew follow-up**:
Additional work requested by a crew agent as part of an initiating request or routine occurrence. It belongs to that request's work rather than a separate user-queued action.
_Avoid_: Queued user action, review subagent

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

**Document verification**:
An assessment of an application document's readability, retained content and layout. Its findings do not establish factual accuracy, an employer's screening decision or permission to export.
_Avoid_: ATS verdict, factual verification, export approval

**Writing preferences**:
Guidance about the user's preferred tone, phrasing and presentation for application drafts, stated directly or inferred from the user's edits. It is separate from factual evidence about the user's experience.
_Avoid_: Verified Profile evidence, employer requirement (when referring to the user's preferred style)

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

**Gap analysis scope**:
The jobs selected by the user, directly or through role or tag filters, whose requirements inform career learning and evidence priorities. It can include relevant leads before an application is made.
_Avoid_: Entire job history (when referring to the user's chosen target set)

**Evidence gap**:
A requirement that the user's Profile does not currently demonstrate, without establishing that the user lacks the capability.
_Avoid_: Confirmed skill gap (when only supporting evidence is missing)

**Confirmed skill gap**:
A capability needed for the user's target work that the user is known to need to develop.
_Avoid_: Evidence gap, inferred inability

**Application coverage gap**:
Relevant experience supported by Profile that is missing from an application draft.
_Avoid_: Skill gap (when the experience already exists)

**Career action plan**:
A persistent set of prioritized next steps for addressing gaps in the user's target work, with supporting sources, completion criteria and progress. Completing a step does not itself establish verified evidence of a capability.
_Avoid_: Verified Profile evidence, application packet

**Offer evaluation**:
Comparing an employment offer's stated compensation and contract terms with the user's priorities and reported promises, identifying uncertainties and preparing questions for the employer or a lawyer.
_Avoid_: Offer acceptance (when referring only to analysis)

**Agent browser session**:
An agent's browsing workspace for one job or one standalone conversation. Sessions for different jobs have independent control even when the same agent uses them.
_Avoid_: Agent profile, global agent browser

**Saved sign-ins**:
An agent's retained website sign-ins and site storage, shared across that agent's browser sessions.
_Avoid_: Browser session, provider credentials

**Manual takeover**:
The user controls a selected agent browser session while that session's agent actions and inspection are paused. Returning control allows the agent to inspect the page again.
_Avoid_: Supervised mode, agent observation mode

**Supervised mode**:
Browser permission mode in which each agent interaction requires the user's exact-action approval.
_Avoid_: Manual takeover, read-only browsing

**Autonomous preparation**:
Browser permission mode allowing bounded application preparation on sites the user grants for the current task. Final submission still requires an exact user decision.
_Avoid_: Autonomous submission, unrestricted browsing

**Browser action approval**:
Authorization for one exact agent interaction in its reviewed application and page context. It is distinct from permission to prepare on a task site.
_Avoid_: Site grant, blanket browser permission
