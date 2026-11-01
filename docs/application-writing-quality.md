# Application writing quality and detector advisories

Product direction agreed on 2026-10-30 and refined on 2026-11-01 against the clay redesign (Decisions, stage beads and event version 32). Milestone 1 (writing improvements) is implemented as described under Implementation; milestone 2 (optional detector checks) remains planned, and its provider decisions are deferred.

## Purpose

Reduce generic application copy and give users visibility into actual AI-text detector findings. Writing quality remains the acceptance criterion; detector results are advisory.

## Agreed boundaries

- A detector result never blocks packet approval or export and never starts an automatic rewrite loop.
- A detector advisory requires an actual result from a named detector for the checked document version. Reviewer's observations about generic phrasing are separate writing-quality findings.
- External checks are optional and off by default. The user must see the service and exact text to be shared before explicitly authorizing a check.
- Only the selected application document text is shared. Profile files, the job brief, the packet note, registered claims and conversation history are outside that authorization.
- Checks run only when the user requests one from the packet's Decisions sheet or job details' Reviews section. Enabling a service does not authorize automatic checks of later drafts.
- Agents have no detector tool. The check is a user-only, session-protected daemon action; the agent gateway exposes no action that reads the detector key, starts a check or uploads text. Agents only see a saved advisory when the user asks Writer to revise.
- Before a check runs, its state is Not checked. Changing the checked text makes its saved result outdated; it does not trigger another upload.
- Detector results do not prove authorship or predict an employer's screening decision. Existing factual checks, packet rules, independent review and user approvals remain required.

## Initial document scope

Detector checks cover the cover letter and the form answers document, each checked and authorized separately. The packet stores form answers as one Markdown document, so the first detector version checks that document as a whole. Splitting form answers into individually checked answers needs structured per-answer storage that does not exist today and is deferred.

Resumes are excluded from the initial detector feature. Resume writing quality remains within the existing Writer, Reviewer and deep resume review flows, which this design does not change.

The minimum eligible document length and supported languages remain to be determined from provider requirements and evaluation on representative application materials. Combining unrelated short answers to reach a detector's minimum length is outside the agreed scope.

## Writing-quality approach

Strengthen the existing Writer and Reviewer by default rather than adding a separate Humanizer stage. Writer addresses interchangeable praise, stock enthusiasm and repetitive phrasing while preserving supported details and the user's writing preferences. Reviewer identifies remaining issues with specific passages and suggested corrections through the existing review flow.

Factual qualifications, exact source quotations, confirmed application requirements and packet rules retain precedence over stylistic changes. This writing-quality work is independent of optional external detector checks.

### Existing starter skills

The starter catalog already seeds a humanizer skill assigned to Reviewer and cover-letter, resume-bullet-writer and unslop skills assigned to Writer. They stay as optional, user-managed supplements: users can edit, reassign or delete them, and startup preserves those decisions. Milestone 1 guidance must not depend on them being present or reachable, because they are loaded from public GitHub sources and may be unavailable offline or removed by the user. Their assignments are not changed by this work. Where a starter skill conflicts with the bundled guidance, the bundled guidance, packet rules and factual contracts win because they are stated in the shared prompt.

### Where the guidance lives

- **Shared application prompt** (`packages/adapters/src/process/writing-quality.ts`, composed by `application-prompts.ts`): the enforced result rules. Style findings go in Reviewer's `suggestions`; blockers go in `feedback`. Writer never invents motivations or experiences to replace generic copy. This applies to every seat, every user and customized roles immediately, and is therefore the layer that carries every rule milestone 1 depends on.
- **Bundled career skills** (`packages/core/src/starter-skills/career-ops/`): the same guidance in readable form for tailoring and review, including the examples of interchangeable praise, stock enthusiasm and repetition. These are role-assigned Markdown that users can inspect and edit. Startup seeds them only into workspaces that do not already have them, and [career support](career-support.md) rules out startup overwriting saved skill text, so updated bundled wording reaches new workspaces and re-added skills only. Existing workspaces keep their saved copy and still receive the shared prompt rules.
- **Default Writer and Reviewer instructions** (`default-roles.ts`): unchanged in milestone 1. A default-instruction change reaches customized roles only through a user's Use new default decision and requires a history revision, so it is the wrong layer for guidance that must apply uniformly.

### Advisory and blocking findings

No new finding type, result field or event version is needed. The existing Reviewer result already separates the two:

- Generic phrasing alone is an advisory style finding. Reviewer reports it in `suggestions`, which the daemon saves as non-blocking `Warning:` notes alongside packet-rule warnings.
- Revision is required when an explicit user packet rule makes the issue a rule error, or when the copy leaves a required answer inadequately addressed. Reviewer reports that in `feedback`, which fails the review and returns the packet to Writer through `changes_requested`.

Whether a required answer is inadequately addressed is Reviewer's judgment recorded in feedback. The daemon continues to enforce only missing required personal answers and packet-rule errors; it does not score prose. For example, stock enthusiasm merits a suggested edit, while answering a required Why this company? question entirely with interchangeable praise warrants revision for inadequate requirement coverage.

### Reviewer summary and Writer change notes

Event version 32 already gives the user a packet-level handoff: a passing Reviewer writes a summary (assessment, highlights, limitations and next steps) bound to the packet digest, and a revising Writer writes change notes bound to the revised packet digest. Decisions opens every packet sheet with them, and job details' Reviews section shows the current packet's pair.

Milestone 1 uses that handoff rather than adding fields. Reviewer's summary assessment states the packet's writing quality in plain terms, and any remaining optional style suggestion goes in limitations so the user sees it where they decide. Writer's change notes name the passage each stylistic change replaced and the supported detail it now uses, so the user can tell a rewording from a factual change. Neither the summary nor the notes may claim a detector result, an employer outcome or an ATS verdict.

### Missing motivations

The existing prompt rule stands. A missing answer to a required personal question makes Writer ask the user through `pitchcrew_ask_user` with the requirement ID and end the turn. An optional personal question with no supported answer is omitted or answered only from supported evidence, and Writer records the omission in the packet note. Neither case permits invented motivations or experiences. Milestone 1 validation uses required questions for the ask case and optional questions for the omission case.

## Where the advisory appears

The Decisions packet sheet lists only checks that actually ran on the frozen files (document readability, document errors, required uploads). The detector joins that list as one row per eligible document:

- **Not checked** with a Check with {service} action when a service is configured. No row appears when no service is configured; the writing-quality flow never mentions detectors to users who have not set one up.
- **Checking** while the upload runs; the sheet's Approve packet and Request changes stay available because the result is advisory.
- **Result** with the service name, the document, the check time and the provider's passage details where supported.
- **Outdated** when the document text no longer matches the checked digest, with the same Check action.

Advisory rows never use the rose failure bead; a flagged result is a warning tone, and Not checked is an empty socket. Job details' Reviews section shows the same rows beside the Reviewer summary and Writer change notes. Decisions history keeps the saved result on decided packets. The Board's Needs you deck and chat's read-only Packet panel show the row's state but not the Check action; checks start only from Decisions or job details. Browser request and question sheets are unchanged.

## Acting on a detector advisory

A flagged detector row offers an explicit Ask Writer to revise action. It behaves like the sheet's existing Request changes: it opens or creates the job conversation with Writer and prefills a draft naming the flagged document and passage and asking for clearer, more specific wording that preserves factual support and qualifications. The user sends it; nothing runs until they do, matching the redesign's prefilled-draft pattern. It does not promise to lower a detector score. The revision then goes through the existing isolated correction path and returns to Reviewer, and Writer's change notes name the passage it reworded.

A correction that originates from a detector advisory is saved with `eligible: false`, so it never counts toward two-application preference learning; it is a reaction to a detector, not a user stylistic instruction. The user's explicit writing preferences still apply to the revision.

Changing the checked text makes the previous detector result outdated. A new detector check requires a separate user action and authorization; completing a revision does not start one automatically.

## Detector result binding

Each saved advisory binds the service name, the checked document (cover letter or form answers), the SHA-256 digest of that document's exact text, the job and the time of the check. Current/outdated state compares the saved document digest with the current document text, so editing the cover letter does not outdate a form answers result and the reverse. The whole-packet digest used by packet review evidence and export approvals is not reused for this purpose.

The authorization is single-use and bound to the same service and document digest. A check runs only for the authorized digest; if the document changes before the upload, the authorization is invalid and the user authorizes again after seeing the new text.

Saved advisories are card state in a new event version, following the version 32 precedent of binding Reviewer summaries and Writer change notes to a digest on the card. They are per job and per document version, appear in Decisions history and must survive replay, which a data-directory file could not provide. Earlier versions remain decodable; cards without advisories show no detector rows. Detector keys stay outside events, as described below.

## Implementation

### Milestone 1 (implemented)

- `writingQualityInstructions` in `packages/adapters/src/process/writing-quality.ts` adds a Writer paragraph (replace or omit interchangeable praise, stock enthusiasm and filler; vary phrasing but keep repeated technical terms; required missing motivation is a user question, optional is an omission noted in the packet note; preferences never change exact quotations or qualifications; change notes name each reworded passage) and a Reviewer paragraph (quote generic passages and suggest supported replacements in `suggestions`; `feedback` only for a packet rule error or a required answer answered entirely with interchangeable copy, saying which; never request invented motivations; state writing quality in the summary assessment and keep style suggestions in limitations; never claim a detector, ATS or employer result). It is composed into every isolated drafting and review prompt and omitted for fit, packet evaluation and deep-review perspective subagents, which never write or judge whole-packet prose.
- The bundled `career-application-tailoring` and `career-application-review` skills carry the same guidance in prose, subject to the seeding rule above.
- Default Writer and Reviewer instructions, the run result schema, the event log and the UI are unchanged.
- Contract tests: `packages/adapters/test/adapter.test.ts` checks which seats and purposes receive the guidance and its key rules; `packages/core/test/career-writing-quality.test.ts` pins the bundled skill wording. Representative before/after draft comparisons on live runtimes remain manual.

### Live validation (2026-11-01, Codex default model, fictional profile and job)

Prompts were generated by the real `promptFor` with and without the writing-quality paragraph and run tools-free through `codex exec`. Findings:

- Required motivation missing: both variants asked the user for the `why-fabrikam` answer instead of drafting one. The existing prompt already handled this; no regression.
- Required motivation answered: the old Writer opened with "I am applying for" and closed with "I would welcome the opportunity", then listed resume bullets verbatim. The new Writer connected each supported achievement to a named brief responsibility in prose and dropped the stock opener and closer. Exact quotations, dates and the unresolved "4+ years" gap survived in both.
- Generic packet (cover letter and required answer written entirely in interchangeable praise): both Reviewers failed it, because praise such as "industry leader" and "amazing culture" is also an unsupported factual assertion under the existing rules. Only the new Reviewer named the required-answer case as the blocking reason, quoted the passage and proposed a replacement from the brief's company context without inventing a motivation.
- Neither Reviewer used `suggestions` in these runs. In this fixture every generic passage also carried an unsupported personal or employer claim, so it was correctly blocking; a case with purely stylistic filler and no unsupported claim is still needed to observe an advisory-only finding.

Two runs per case on one runtime are indicative, not a measurement. Live provider quality remains outside automated verification.

## Delivery milestones

### Milestone 1: Writing improvements

Strengthen the shared application prompt and bundled career skills and validate results on representative application examples. Deliver the writing-quality approach above independently of any detector service. This milestone introduces no detector uploads, credentials, scores or check controls, and no change to default role instructions, the result schema or the event log.

Validation should compare before/after drafts for clearer, more specific prose while checking that:

- Interchangeable company praise and stock enthusiasm are removed or replaced only with supported, relevant details.
- A missing required personal motivation leads to a user question; a missing optional one leads to an omission noted in the packet note, never invented enthusiasm or experiences.
- Required technical terms and useful repeated terminology survive stylistic editing.
- Exact registered source quotations, scope limits, dates, titles and other factual qualifications remain intact.
- Explicit writing preferences are respected within the existing factual, requirement and packet-rule boundaries.
- Reviewer places style findings in suggestions and unsupported claims, rule violations and inadequately answered requirements in feedback, with passage-specific wording in both.
- Results are the same with the humanizer and unslop starter skills deleted.
- A passing Reviewer summary describes writing quality without claiming a detector, ATS or employer result, and Writer change notes identify each reworded passage.

Instruction/contract checks can verify the guidance and review boundaries. Representative draft comparisons are also needed to assess actual writing quality; passing automated checks alone does not establish that generated prose improved. Live runtime evaluation remains separate from automated verification.

### Milestone 2: Optional detector checks

Add the manual detector-check and revision experience only after selecting a provider and evaluating its suitability on representative application materials. Retain the consent, document scope, binding, cost and advisory boundaries above.

Resolve these details during that milestone:

- Provider selection, data-handling terms and API access requirements.
- Eligible document lengths and languages, with evaluation beyond merely satisfying an API's minimum input length.
- Presentation of provider-supported passage details and uncertainty.
- Handling unavailable, failed and unsupported checks without presenting them as a clean detector result.
- The exact event version number and card field shape for saved advisories, assigned when milestone 2 starts so it follows whatever version is current then.
- The provider's passage detail format and how much of it the Decisions row can show before opening the shared read-only file dialog.

## Detector access and cost

Optional external detection uses the user's own provider API account and key. The provider bills the user directly; Pitchcrew does not bundle or subsidize detector usage. Writing-quality improvements remain available without a detector account.

The key follows the connector credential pattern: stored in the data directory's connector credentials file, never in board events, snapshots, prompts, run folders or MCP configuration, and filtered from every role CLI environment. Removing the service deletes the key locally; provider-side revocation is the user's separate action. Settings > Writing holds the detector service section, since it concerns application drafts rather than agent accounts; it shows only whether a key is saved, never the key, and Find a setting indexes it.

## Initial investigation

The proposed [Turnitout repository](https://github.com/AhmadHassan-BTed/Turnitout-Humanizer) describes rewriting and evasion capabilities. It has not been selected as a dependency or detector provider. Its [proprietary license](https://github.com/AhmadHassan-BTed/Turnitout-Humanizer/blob/main/LICENSE) does not grant general reuse rights, and its advertised preservation and evasion guarantees have not been validated here.

Detector eligibility needs provider-specific investigation. For example, [Copyleaks documents a minimum text length](https://docs.copyleaks.com/mcp/scanning), while [GPTZero advises using descriptive portions of text and notes that procedural text can be flagged](https://gptzero.me/faq). Those statements do not establish accuracy on application materials; representative evaluation is still needed.
