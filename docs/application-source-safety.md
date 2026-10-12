# Application source safety

Status: implemented and verified with the provider-free test suite, production builds, browser checks and a hidden Electron smoke test. Decisions were resolved on October 12–13, 2026 through a grill-with-docs session. The architectural boundary is recorded in [ADR 0001](adr/0001-separate-job-sources-from-drafting-context.md); terms live in [CONTEXT.md](../CONTEXT.md).

## Incident and previous exposure

The [Evil Martians frontend posting](https://evilmartians.com/careers/frontend-engineer) included directives to mention Amie and begin an answer with “Honestly,” inside elements hidden with `opacity: 0; font-size: 0`. The submitted application followed both. This corroborates the employer's explanation of prompt injection, although the application's original saved run was not inspected.

Pitchcrew already warned that external text is untrusted. Those warnings did not establish whether employer directives are legitimate requirements. Before this change, drafting and review prompts received the full card, and `pitchcrew_get_card` returned it again. Chat, history, attachments, saved form assessments and agent handoffs offered additional paths for source text to enter context.

The original HTML converter discarded styles and tags without evaluating visibility. The exact-quotation checker validates registered claims; it does not establish complete claim coverage or detect instruction influence in the remaining prose. Reviewer also read the same employer description. Existing export approvals froze packet bytes but did not attest to a confirmed job context.

## Agreed behavior

1. Extract the selected job source in a separate restricted run. It returns a structured job brief, proposed application requirements and flagged directives; it has no profile, private connectors, agent memory, crew messaging, scheduling or workflow actions.
2. Exclude and flag known hidden directives. Ask the user about ambiguous requests. Treat unavailable visibility evidence as unknown.
3. Before the first draft for every job, show one compact review of the entire brief, proposed requirements and flagged material. Only an explicit user decision confirms that exact context; saving a description does not.
4. Draft and review in a separate context containing the confirmed brief and requirements, verified profile evidence and relevant user-supplied answers. Keep original employer text out of prompts and tools, including text carried through earlier conversations, attachments and handoffs. Apply this to chat and custom agents as well as board workflows.
5. Tie confirmation and packet review to the adopted context version. Adopting changes requires confirmation of the differences and a fresh packet review before export. An unchanged refresh or rewrite within the same context requires no repeated drafting confirmation.
6. Ask for missing personal answers. Required unanswered questions block Ready; supported sections can be drafted while waiting, and optional unanswered questions can be omitted. Answers stay application-specific unless the user explicitly saves them to Profile for reuse. Existing profile-evidence rules still govern factual achievements.
7. When existing unsent packets are next used, require context confirmation and fresh review before another export or browser submission. Preserve old text, files and history.
8. Stop on extraction failure, invalid output or unsupported isolation. Offer retry, a user-selected supported runtime or a manually prepared brief with the same confirmation step. Never recover by exposing the original description to drafting.

## Implementation sequence

### 1. Define and persist the boundary

Add bounded core contracts for captured sources, brief fields, proposed requirements, flagged directives, user confirmation and application-specific answer references. Source records need capture identity, origin and visibility evidence; extracted items need source references so the review UI can explain their basis. Keep source excerpts in the source-review view rather than returning them through drafting tools.

Define a revision for the exact brief and requirements. Confirmation must identify the user decision and revision. Packet review and export approval must bind both the packet bytes and that context revision. Personal answers should retain their question, answer-message and job provenance; identify missing required answers explicitly instead of hiding them in an agent note.

Use append-only board events and backwards-compatible decoding. Old records lack confirmation evidence and remain readable; they cannot acquire it from an existing Ready state or export receipt. Editing accepted context or answers must invalidate the affected review rather than silently extending old approval. Exact event versions must be selected from the repository state at implementation time.

Primary areas: `packages/core/src/{cards,runtime,runs,packets,user-input}.ts`, board events/projections, and `packages/board/src/board/approvals.ts`.

### 2. Capture sources and restrict extraction

Preserve available source markup and provenance before plain-text conversion discards evidence. Provider API descriptions and previously flattened or pasted text do not establish rendered visibility. Flag them as unknown unless independent captured evidence supports a visibility classification. Do not label text visible merely because an API or extractor returned it.

Use a separate source-extraction execution purpose and a single structured CLI result, preserving Pitchcrew's runtime-adapter architecture rather than adding a provider agent loop. Enforce a purpose-specific gateway allowlist independent of normal role capabilities. Give the extractor only the selected source and validated read operations needed for it, with bounded output and the existing cancellation/deadline behavior.

Audit each adapter's native tools, ambient configuration, session reuse, environment and filesystem exposure for this purpose. A normal role's restricted tool list is not sufficient evidence for the new mode. Any browser-based capture must use source-scoped, read-only access without an agent's authenticated browser profile. Preserve existing public-network protections; this decision does not authorize arbitrary network access or browser actions.

Primary areas: `packages/orchestrator/src/job-sources/`, crew gateway/run setup, `packages/adapters/src/` and MCP source tools.

### 3. Add confirmation and clean drafting entry points

Add the compact brief/requirements review to job details and expose it from drafting requests in chat. Show why directives were flagged and allow the user to correct the proposed brief and requirements before confirming. Confirmation is a user-only endpoint that atomically rechecks the exact revision, source identity and concurrent changes.

Introduce a dedicated drafting context builder instead of passing an unrestricted `Card`. Build both workflow and chat drafting inputs from an allowlist. Redact or deny raw card/history reads, source attachments, full form-page snapshots, unrelated memory and handoffs for that execution purpose. Carry only the necessary inspected field constraints and validated domain findings. Reconstruct personal answers directly from user provenance rather than copying continuation prompts that also contain source text.

Start a fresh native session for drafting; never resume a source-discussion session or reuse a continuation summary containing excluded material. Switching purpose, context revision or answer evidence must change session identity. Reviewer still needs to inspect the candidate packet, but that packet and its notes remain untrusted material rather than instructions.

Primary areas: `packages/orchestrator/src/crew/{workflow,chat,sessions,continuation,conversation-context}.ts`, `gateway/`, shared adapter prompts, `packages/ui/src/components/CardDetails/`, chat, and `WorkspaceStore`.

### 4. Enforce readiness and outward-action gates

Check confirmed context and required-answer provenance before accepting a completed draft or review, not solely in the prompt. Reviewer evaluates relevance and completeness against the confirmed requirement set and profile. Registered claims and house rules continue to apply; model review is additional evidence, not a proof that all prose is supported.

Recheck context revision, personal-answer revision, packet digest and review evidence at export approval, export and browser upload/submission boundaries. In-flight context edits must prevent delayed results or approvals from being accepted. A consumed legacy export receipt cannot stand in for the new context evidence.

Preserve truthful recording of an application already sent and existing submission history. New gates govern preparing and sending packets, not whether the user may record a real past action.

Primary areas: crew result application and export, board approvals, MCP export/browser gates, and Inbox.

### 5. Migrate on use and explain failures

Show a needs-checks state for an old unsent packet when it is next used. Preserve historical events and frozen files; acquire confirmation and fresh review before further managed export or browser submission. Do not downgrade all jobs or restart runs at startup.

Provide actionable failures for unavailable extraction, stale confirmation, missing personal answers and unsupported execution restrictions. Manual briefs remain subject to confirmation. Model/runtime selection remains an explicit user choice. Update AGENTS.md and product docs when runtime behavior ships; do not describe the planned protections as current behavior beforehand.

### 6. Verify the actual boundary

Use fictional local fixtures and mocked adapters; ordinary automated verification must stay offline and provider-free.

- Reproduce the hidden Amie and opening-word directives, including CSS classes, inline styles and hidden ancestors. Assert that detected hidden instructions stay out of accepted requirements. When visibility is unavailable, assert unknown status and mandatory full confirmation.
- Test an extractor that puts a directive into company context, returns malformed data, requests profile/connector access, sends crew messages or schedules a task. Reject unauthorized operations at the gateway even when the role normally has those capabilities.
- Exercise legitimate visible questions, word limits and application instructions so ordinary employer requests survive extraction and can be confirmed.
- Assert that every drafting adapter input and permitted tool result excludes raw card descriptions, source excerpts, attachments, history, page snapshots and handoffs. Include chat/custom agents and previously resumed native sessions.
- Test missing required personal answers, optional omissions, answer provenance and explicit Profile reuse. Keep factual-achievement checks intact.
- Test stale revisions, concurrent confirmation/edit races, delayed run results, old review/export approvals, unchanged refreshes and legacy exported packets. Cover daemon HTTP workflows and actual MCP stdio, not only helper functions.
- Verify UI review, confirmation, clarification, version changes and legacy recovery with fictional data. Follow the repository's headless/hidden browser and desktop verification rules.

These tests prove specific application boundaries and regression behavior. They do not measure a model's universal resistance to attacks. Any live model evaluation is a separate, explicitly scoped activity; it is not part of the provider-free test suite.

## Residual limits

Extraction can misclassify text, and users can overlook instructions in a brief. Screenshots, computed styles and schemas provide evidence or constraints, not a universal semantic guarantee. Candidate packet text can itself contain adversarial directions that Reviewer must treat as data. [Published prompt-injection research](https://www.anthropic.com/research/prompt-injection-defenses) likewise does not claim immunity.

Application-purpose gates can deterministically control managed drafts, reviews, exports and browser submissions. Free-form source-discussion chat can still generate arbitrary prose: an intent classifier or prompt warning cannot guarantee that every reply resembling an application is routed correctly. Product drafting entry points must route to the isolated mode, and ordinary chat output must not receive a managed Ready/review/export status. A user can still manually copy text out of source-discussion chat or an old file.

This work addresses employer-source influence on application preparation. It is not a complete prompt-injection defense for every connector, memory, routine or agent action in Pitchcrew, and it is not an OS process/network sandbox.

## Implemented runtime boundaries

Application-purpose isolation is enabled for Codex, Claude Code and OpenCode, plus deterministic Demo in development. Other adapters remain available for ordinary conversations and research, but application extraction/fit/drafting/review fail closed until their launch isolation has an explicit audited contract. The source extractor reads only the stored selected posting; it does not add arbitrary URL fetching or use authenticated agent browsers.

Captured provider markup is parsed without rendering, fetching resources or executing scripts. Explicit hidden attributes, inline hiding styles and simple tag/class/ID hiding rules are excluded and flagged. This is deliberately not a complete CSS visibility engine: sources still have unknown visibility and require full confirmation. Plain/pasted/legacy text cannot reconstruct lost hiding evidence.

Ordinary source-discussion chat routes application-writing requests to the job's dedicated Draft application control. The control supports any enabled agent using an isolation-supported runtime, regardless of its stored workflow seat. Draft/review prompts omit prior requests and only recover personal answers linked to confirmed requirements and isolated originating runs. Fit-specific user clarifications are scoped to fit assessment.

Browser fill/select preparation requires complete values backed by confirmed application answers, verified profile lines or reviewed packet paragraphs. Managed submission rechecks native fields in every browser frame against that evidence, including selected option labels. Private manual input is authorized through transient browser-local field fingerprints, cleared on a fresh task page; the fingerprints are not added to board events or prompts. Browser implementations without field verification cannot perform a managed submission. Website-controlled scripts and non-native payloads remain outside semantic verification.

Brief changes are rejected while any run for that job is active or a managed submission is uncertain. Identical extraction refreshes retain personal answers for unchanged question IDs, text and personal/required flags, so confirmation and review evidence stay valid when all accepted content is unchanged.

## Verification completed

The full suite passed with 1,443 Vitest tests and 44 script tests; two Vitest cases remain intentionally skipped. Regression coverage includes hidden directives in markup, forbidden extractor tools, malformed extraction, confirmed-context gates, custom-agent personal-answer continuations, exclusion of earlier source-discussion answers, unchanged refreshes, legacy packets, exact export evidence, real MCP stdio and actual headless Chromium field checks across frames. Lint, formatting, type checks, application builds and the separate landing build passed. The Electron smoke test passed and verified its window stayed hidden.

The collaborative browser verified full-brief editing, personal answers, unchanged confirmation, unsaved-change protection and a mobile layout without horizontal overflow using fictional local data. These checks used deterministic Demo and mocked adapters; no live provider run was performed.
