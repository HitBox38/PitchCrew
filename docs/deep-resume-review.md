# Deep resume review

Pitchcrew offers an optional deep review of a tailored resume for a specific job. One Reviewer applies all seven original hiring-panel perspectives, Writer makes supported corrections, and Reviewer independently rechecks the complete packet. These are simulated perspectives, not employer participation or an actual ATS test.

## Start a review

Use **Deep review resume** in job details, or request a deep resume review in chat, including `/hiring-panel`. The job must be shortlisted, awaiting changes, in review, agreed or awaiting export approval. Submitted and closed jobs are not rewritten. Both entry points use the same managed workflow and require the job's confirmed brief and requirements. If chat has no selected job, an inline question asks the user to choose one.

Enable an available Writer and Reviewer in Crew. Codex, Claude Code and OpenCode support isolated production application work; development Demo provides deterministic examples. The workflow uses the saved configurations for those workflow seats. It reserves both seats until it completes or waits for user information, preserving ordinary per-role serialization. Temporary child runs and deadline decisions belong to that owning workflow and use fresh isolated CLI executions, not shared native sessions.

If there is no resume, Writer creates the first tailored packet from verified Profile notes before review. A supplied file or chat answer does not automatically become verified Profile evidence. Existing packets must match the confirmed application context.

The start dialog can explicitly request second opinions and select any of the seven original perspectives or four additional specialties. Selecting no specific perspectives requests relevance and impact opinions. Pitchcrew schedules requested opinions within runtime capacity before the parent assessment; Reviewer can request further targeted opinions when useful. Ordinary chat requests can express the same preferences through the scoped tool, and direct `/hiring-panel` requests recognize explicit subagent requests and named perspectives. User requests and runtime alternatives survive job selection and missing-fact continuation.

## Seven original perspectives

| Perspective                        | Question                                                                                              | Verdict             |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| Automated screen                   | Is readable text, employment history, relevant terminology and contact information clear?             | PASS / REJECT       |
| Hiring manager: interview decision | What decides the first impression, which lines are weakest, and what should be asked in an interview? | INTERVIEW / NO      |
| Hiring manager: day-one readiness  | Does supported experience demonstrate ability to perform this role?                                   | HIRE / MAYBE / PASS |
| Rival applicant                    | Which weaknesses could a competitor challenge, without inventing another applicant?                   | HIRE / MAYBE / PASS |
| CEO                                | What impact and outcomes are supported by evidence?                                                   | HIRE / MAYBE / PASS |
| Recruiter                          | What does the top third communicate in a quick scan?                                                  | HIRE / MAYBE / PASS |
| Teammate                           | What evidence describes collaboration and working relationships?                                      | HIRE / MAYBE / PASS |

The four additional specialties are job relevance, recruiter readability, demonstrated impact and collaboration. They supplement the original seven; they do not replace them or require eleven separate executions. A single Reviewer applying seven perspectives is never described as seven independent reviewers. Plain text cannot establish whether original PDF columns, images or layout are machine-readable.

Strong resumes deserve honest assessments. Reviewers must not manufacture reasons to reject them or demand invented metrics. Findings quote actual resume text; a missing section is explicitly labeled `[MISSING: ...]`, not presented as a quotation. Exact duplicate findings are merged with perspective attribution, and blockers precede advisory suggestions. The parent resolves disagreements against verified Profile evidence and confirmed requirements rather than voting. Unresolved subjective trade-offs stay advisory.

## Targeted review subagents

Subagents are temporary, scoped second opinions rather than permanent Crew roles. Each receives a neutral concern, the candidate resume, confirmed job data and verified Profile evidence. Other packet documents, peer notes, earlier conclusions, memory, raw job sources and ordinary conversation history are not supplied. Child results identify their stage and candidate packet digest.

The normal allowance is up to two when escalation is useful; two is not a total cap. More can run when the agent identifies useful concerns and the selected runtime supports them. Audited Codex, Claude Code, OpenCode and development Demo adapters advertise four concurrent children per runtime per review. User-requested opinions beyond capacity are scheduled as slots become available. This describes isolated CLI launch support, not model entitlement or provider quota.

Children inherit Reviewer's saved runtime/model by default. The user can explicitly allow alternative runtime/model/reasoning combinations in the start dialog. Alternatives are saved with that review and never silently rewrite Crew settings. The parent can choose only those supplied alternatives. Current invocation permissions are checked on each delegation call.

Each child has a separate run directory, scoped capability, cancellation signal and saved result. Native shell, file, web and subagent tools remain disabled. Children cannot delegate, ask the user directly, export, submit, use connectors or change the shared deadline. The parent alone consolidates findings; child opinions do not establish facts or approve a packet.

Unavailable, failed, cancelled and unfinished opinions are recorded explicitly. Their technical failure does not independently block an otherwise valid packet; missing evidence, required answers and factual problems still do. Unperformed user-requested opinions cannot be presented as completed review. The parent can finish using available findings and must report the incomplete work.

## Shared execution budget

The whole flow starts with a shared 30-minute wall-clock budget, including the initial draft, assessment, corrections, recheck and temporary children. The parent Reviewer can extend it by 1–30 minutes per scoped call, explaining the unfinished work. Repeated justified extensions are supported; there is no fixed total extension ceiling. Existing child CLI processes observe extensions at the previous deadline.

Children request time through the parent. During an active parent assessment, pending requests appear with child results. While Writer or the app's requested-opinion scheduler is working, a separate parent Reviewer decision turn considers a time request with only application reads and the extension tool. That decision cannot delegate, rewrite or approve the packet.

Missing information uses the existing durable question flow. Execution ends while waiting, the remaining budget is saved, and answering continues the appropriate stage in a fresh execution. A final-recheck question resumes the recheck without replaying completed corrections or replacing the original assessment. A required personal answer that changes the confirmed brief sends the packet through Writer correction and a new recheck; the original assessment retains its earlier context revision. Other changed briefs or candidate bytes require a fresh review. Profile evidence is reread and validated. User cancellation always wins and stops the parent, all children and seat reservations. Ordinary CLI/ACP turns retain their fixed 30-minute timeout.

## Corrections and approval

A deep-review request authorizes the full assessment → Writer correction → Reviewer recheck flow. No separate manual handoff is needed. Writer is skipped when no correction is necessary. Reviewer rechecks the entire packet, including evidence, required personal answers, consistency and packet house rules. Mechanical errors remain authoritative even if the model returns `passed: true`.

Registered claims require exact verified Profile quotations, and all prose remains subject to independent factual review. Unknown facts prompt questions rather than invention or employer-facing `[ADD]` placeholders. Answers about new factual achievements still require verified Profile evidence. Only answers recovered from this isolated review with checked user-message provenance reach its continuation; earlier source discussions do not.

Advisory findings and optional suggestions cannot independently fail a packet. Blocking findings and unresolved requirements prevent agreement. Final review evidence binds the current confirmed context and exact packet bytes; stale context, packet or Profile inputs reject the result. Export and submission retain their existing separate user approvals.

## Reports and history

The job's **Reviews** section contains paged report history, the original and final seven assessments, attributed severity-ranked findings, packet blockers and advice, independent child results, deadline extensions and original/improved resume text. Chat receives a concise summary with the priority findings and before/after heuristic screen verdicts. Reports identify the packet, context and evidence versions they assessed, and historical reports do not establish readiness of a later packet.

The arbitrary `.hiring-panel/` directory from the standalone skill is replaced by job-linked application history. Downloads use the existing approval-gated packet export flow. Report bodies are fetched only when opened, with ten reports and twenty child results per page; compact workspace snapshots omit full review prose. Indexed SQLite projections and append-only version 21 events preserve replay and older event decoding. The bundled, editable `hiring-panel` starter skill is assigned to Reviewer and works offline; importing it does not grant capabilities.

A restart marks interrupted work incomplete and retains completed artifacts. Pending questions remain resumable; stopped work does not restart automatically. Deleting a job cancels its waiting reviews, questions and queued deep-review requests while preserving historical reports.

## Verification

Provider-free fixtures exercise the managed stages, all seven perspectives, advisory versus blocking results, more than two children, runtime capacity, user-selected opinions, explicit model alternatives, current capabilities, child and budget-tool isolation over actual MCP stdio, missing-fact continuation, final-recheck continuation, stale evidence/packet rejection, shared cancellation, deadline extensions, projection replay and compact report delivery. Headless browser coverage follows the job action through runtime choices, requested opinions, completed reports, saved resume versions and mobile layout.

These checks establish workflow behavior and execution boundaries. They do not measure whether a model gives better hiring advice than ordinary review. Live provider execution and a human quality comparison remain separate from automated verification.

See [roles](roles.md), [runtime setup](runtimes.md), [application source safety](application-source-safety.md) and [the glossary](../CONTEXT.md).
